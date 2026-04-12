// ===========================================
// MAPPINGTRACE BACKEND - COMPLETE VERSION
// ===========================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const wellknown = require('wellknown');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://franciscokonan.github.io',
        'https://*.onrender.com',
        'https://*.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());

// ===========================================
// ENVIRONMENT VARIABLES
// ===========================================

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    KOBO_TOKEN,
    ASSET_UID,
    PORT: ENV_PORT
} = process.env;

console.log('📋 Environment check:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌'}`);
console.log(`   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? '✅' : '❌'}`);
console.log(`   KOBO_TOKEN: ${KOBO_TOKEN ? '✅' : '❌'}`);
console.log(`   ASSET_UID: ${ASSET_UID ? '✅' : '❌'}`);

// ===========================================
// SUPABASE CLIENT
// ===========================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const KOBO_API_BASE = 'https://kf.kobotoolbox.org/api/v2';

// ===========================================
// KOBO V2 API FUNCTIONS
// ===========================================

/**
 * Convert Kobo Polygon string to GeoJSON Polygon
 */
function koboPolygonToGeoJSON(polygonString) {
    if (!polygonString) return null;
    try {
        const coords = polygonString.split(';').map(pt => {
            const parts = pt.trim().split(/\s+/);
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            return [lon, lat];
        });
        if (coords.length > 0) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
        }
        return { type: 'Polygon', coordinates: [coords] };
    } catch (err) {
        console.error('Polygon parse error:', err.message);
        return null;
    }
}

/**
 * Fetch submissions from Kobo v2 API
 */
async function fetchKoboSubmissions() {
    try {
        console.log('📡 Fetching from Kobo v2 API...');
        const response = await axios.get(
            `${KOBO_API_BASE}/assets/${ASSET_UID}/data/`,
            {
                headers: {
                    'Authorization': `Token ${KOBO_TOKEN}`,
                    'Accept': 'application/json'
                },
                params: {
                    limit: 1000
                }
            }
        );
        return response.data.results || [];
    } catch (error) {
        console.error('❌ Kobo v2 API error:', error.response?.data || error.message);
        return [];
    }
}

/**
 * Check if a submission already exists in Supabase
 */
async function submissionExists(koboId) {
    try {
        const { data, error } = await supabase
            .from('farms')
            .select('id')
            .eq('kobo_submission_id', koboId.toString())
            .maybeSingle();

        if (error) {
            console.error('Error checking existence:', error.message);
            return false;
        }
        return data !== null;
    } catch (err) {
        console.error('Error in submissionExists:', err.message);
        return false;
    }
}

/**
 * Sync Kobo data to Supabase with deduplication
 */
async function syncKobo() {
    const startTime = Date.now();
    console.log('🔄 Starting Kobo sync at:', new Date().toISOString());

    try {
        const records = await fetchKoboSubmissions();
        console.log(`📊 Fetched ${records.length} records from Kobo`);

        let newCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        for (const record of records) {
            const koboId = record._id.toString();
            const uuid = record._uuid || record._id;

            // Check for duplicate
            const exists = await submissionExists(koboId);
            if (exists) {
                console.log(`⚠️ Skipping duplicate: ${koboId}`);
                duplicateCount++;
                continue;
            }

            // Process new record
            const polygonString = record.Polygon || record.polygon;
            const geojson = koboPolygonToGeoJSON(polygonString);
            const wkt = geojson ? wellknown.stringify(geojson) : null;

            const farmData = {
                farm_id: uuid,
                farmer_name: record.Farmer_Name || record.farmer_name || 'Unknown',
                farmer_id: record.Farmer_ID || record.farmer_id,
                submission_date: record.Submission_Date || record.submission_date || new Date().toISOString().split('T')[0],
                cooperative_name: record.Cooperative_Name || record.cooperative_name,
                area: record.Area ? parseFloat(record.Area) : (record.area ? parseFloat(record.area) : null),
                status: (record.Status || record.status || 'pending').toLowerCase(),
                kobo_submission_id: koboId,
                synced_at: new Date().toISOString()
            };

            // Add geometry if available
            if (geojson) {
                farmData.geometry = geojson;
            }

            try {
                const { error } = await supabase
                    .from('farms')
                    .insert([farmData]);

                if (error) {
                    console.error('❌ Insert error:', error.message);
                    errorCount++;
                } else {
                    console.log(`✅ Inserted: ${farmData.farmer_name} (${koboId})`);
                    newCount++;
                }
            } catch (err) {
                console.error('❌ Error inserting record:', err.message);
                errorCount++;
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Sync completed in ${duration}s: ${newCount} new, ${duplicateCount} duplicates, ${errorCount} failed`);

        return { newCount, duplicateCount, errorCount, duration };

    } catch (err) {
        console.error('❌ Sync failed:', err.message);
        throw err;
    }
}

// ===========================================
// DATABASE SETUP FUNCTIONS
// ===========================================

/**
 * Ensure required columns exist in farms table
 */
async function setupDatabase() {
    console.log('🔧 Checking database setup...');

    // Check if kobo_submission_id column exists
    const { error: checkError } = await supabase
        .from('farms')
        .select('kobo_submission_id')
        .limit(1);

    if (checkError && checkError.message.includes('column "kobo_submission_id" does not exist')) {
        console.log('📝 Adding kobo_submission_id column...');
        const { error: alterError } = await supabase.rpc('add_kobo_submission_id_column');
        if (alterError) {
            console.warn('⚠️ Could not add column via RPC, please run SQL manually:');
            console.log(`
                ALTER TABLE farms 
                ADD COLUMN IF NOT EXISTS kobo_submission_id TEXT UNIQUE,
                ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP;
            `);
        }
    }

    console.log('✅ Database check complete');
}

// ===========================================
// API ENDPOINTS
// ===========================================

// Health check
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Backend is running',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Status endpoint
app.get('/api/status', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('farms')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        // Get last sync info
        const { data: lastSync } = await supabase
            .from('farms')
            .select('synced_at')
            .order('synced_at', { ascending: false })
            .limit(1)
            .single();

        res.json({
            status: 'online',
            farmsCount: count || 0,
            lastSync: lastSync?.synced_at || null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Status error:', error.message);
        res.json({ status: 'online', farmsCount: 0, error: error.message });
    }
});

// Polygons endpoint (GeoJSON)
app.get('/api/polygons', async (req, res) => {
    console.log('🗺️ /api/polygons called');

    try {
        const { data, error } = await supabase
            .from('farms')
            .select('id, farm_id, farmer_name, farmer_id, cooperative_name, area, status, geometry, submission_date');

        if (error) throw error;

        const features = (data || [])
            .filter(row => row.geometry)
            .map(row => ({
                type: "Feature",
                geometry: row.geometry,
                properties: {
                    id: row.id,
                    farm_id: row.farm_id,
                    farmer_name: row.farmer_name,
                    farmer_id: row.farmer_id,
                    cooperative_name: row.cooperative_name,
                    area: row.area,
                    status: row.status || 'pending',
                    submission_date: row.submission_date
                }
            }));

        res.json({
            type: "FeatureCollection",
            features: features
        });
    } catch (error) {
        console.error('Polygons error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Alerts endpoint
app.get('/api/alerts', async (req, res) => {
    console.log('🔔 /api/alerts called');

    try {
        // Get overlapping farms
        const { data, error } = await supabase
            .from('farms')
            .select('farm_id, farmer_name, geometry')
            .not('geometry', 'is', null);

        if (error) throw error;

        // Simple overlap detection (can be enhanced with PostGIS)
        const alerts = [];
        for (let i = 0; i < data.length; i++) {
            for (let j = i + 1; j < data.length; j++) {
                // This is a placeholder - actual overlap detection
                // should use PostGIS ST_Intersects function
                if (data[i].geometry && data[j].geometry) {
                    // Add alert logic here
                }
            }
        }

        res.json(alerts);
    } catch (error) {
        console.error('Alerts error:', error.message);
        res.json([]);
    }
});

// Kobo sync endpoint
app.get('/sync-kobo', async (req, res) => {
    console.log('🔄 Manual sync triggered');

    try {
        const result = await syncKobo();
        res.json({
            status: 'success',
            message: 'Sync completed',
            stats: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Sync endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Sync failed',
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'MappingTrace API',
        version: '2.0.0',
        status: 'running',
        endpoints: [
            'GET /',
            'GET /api/test',
            'GET /api/status',
            'GET /api/polygons',
            'GET /api/alerts',
            'GET /sync-kobo'
        ],
        documentation: 'https://github.com/FranciscoKonan/MapProject'
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ 404 - Not found: ${req.method} ${req.url}`);
    res.status(404).json({
        error: 'Endpoint not found',
        available: ['/', '/api/test', '/api/status', '/api/polygons', '/api/alerts', '/sync-kobo']
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ===========================================
// SCHEDULED SYNC
// ===========================================

// Run every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ Running scheduled sync...');
    await syncKobo();
});

// Run once on startup
setTimeout(async () => {
    console.log('🚀 Running initial sync on startup...');
    await setupDatabase();
    await syncKobo();
}, 5000);

// ===========================================
// START SERVER
// ===========================================

const PORT = ENV_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}/`);
    console.log(`📍 Test: http://localhost:${PORT}/api/test`);
    console.log(`📍 Status: http://localhost:${PORT}/api/status`);
    console.log(`📍 Polygons: http://localhost:${PORT}/api/polygons`);
    console.log(`📍 Alerts: http://localhost:${PORT}/api/alerts`);
    console.log(`📍 Sync: http://localhost:${PORT}/sync-kobo`);
    console.log(`\n✅ Kobo v2 API integration active`);
    console.log(`✅ Deduplication enabled`);
    console.log(`✅ Auto-sync every 30 minutes\n`);
});

module.exports = app;
