require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const wellknown = require('wellknown');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Load environment variables
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
 * Sync Kobo data to Supabase
 */
async function syncKobo() {
  try {
    console.log('🔄 Starting Kobo sync at:', new Date().toISOString());
    
    const records = await fetchKoboSubmissions();
    console.log(`📊 Fetched ${records.length} records from Kobo`);

    let successCount = 0;
    let errorCount = 0;

    for (const record of records) {
      const id = record._uuid || record._id;
      if (!id) continue;

      console.log(`📝 Processing record: ${id}`);
      
      const polygonString = record.Polygon || record.polygon;
      const geojson = koboPolygonToGeoJSON(polygonString);
      const wkt = geojson ? wellknown.stringify(geojson) : null;

      try {
        const { error } = await supabase.rpc('upsert_farm_geom', {
          p_id: id,
          p_farmer_name: record.Farmer_Name || record.farmer_name || 'Unknown',
          p_farmer_id: record.Farmer_ID || record.farmer_id,
          p_submission_date: record.Submission_Date || record.submission_date,
          p_cooperative_name: record.Cooperative_Name || record.cooperative_name,
          p_area: parseFloat(record.Area || record.area) || null,
          p_geom_wkt: wkt
        });

        if (error) {
          console.error('❌ RPC error:', error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error('❌ Error:', err.message);
        errorCount++;
      }
    }

    console.log(`✅ Sync completed: ${successCount} updated, ${errorCount} failed`);
    
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
  }
}

// ===========================================
// API ENDPOINTS
// ===========================================

app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', version: 'v2' });
});

app.get('/api/status', async (req, res) => {
  try {
    const { count } = await supabase.from('farms').select('*', { count: 'exact', head: true });
    res.json({ status: 'online', farmsCount: count || 0 });
  } catch (error) {
    res.json({ status: 'online', farmsCount: 0 });
  }
});

app.get('/api/polygons', async (req, res) => {
  try {
    const { data, error } = await supabase.from('farms_geojson').select('*');
    if (error) throw error;
    
    const features = (data || []).map(row => ({
      type: "Feature",
      geometry: row.geometry,
      properties: {
        id: row.id,
        farm_id: row.farm_id,
        farmer_name: row.farmer_name,
        farmer_id: row.farmer_id,
        cooperative_name: row.cooperative_name,
        area: row.area,
        status: row.status || 'pending'
      }
    }));
    
    res.json({ type: "FeatureCollection", features: features });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATED: Real Kobo sync endpoint
app.get('/sync-kobo', async (req, res) => {
  try {
    await syncKobo();
    res.json({ status: 'Sync completed', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Sync endpoint error:', error);
    res.status(500).json({ error: 'Sync failed', details: error.message });
  }
});

// Auto-sync every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('⏰ Running scheduled sync...');
  await syncKobo();
});

app.get('/', (req, res) => {
  res.json({
    name: 'MappingTrace API',
    version: '1.0.0',
    status: 'running',
    endpoints: ['GET /', 'GET /api/test', 'GET /api/status', 'GET /api/polygons', 'GET /sync-kobo']
  });
});

app.get('/api/alerts', (req, res) => {
  res.json([]);
});

const PORT = ENV_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 Kobo v2 API integration active`);
});
