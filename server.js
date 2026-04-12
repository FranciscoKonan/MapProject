require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// Essential middleware - ORDER MATTERS!
app.use(cors()); // Simplest CORS setup
app.use(express.json());

// Load environment variables
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  KOBO_TOKEN,
  ASSET_UID,
  PORT: ENV_PORT
} = process.env;

// Log what we have (for debugging)
console.log('📋 Environment check:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌'}`);
console.log(`   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? '✅' : '❌'}`);
console.log(`   KOBO_TOKEN: ${KOBO_TOKEN ? '✅' : '❌'}`);
console.log(`   ASSET_UID: ${ASSET_UID ? '✅' : '❌'}`);

// Initialize Supabase (don't fail if credentials missing - API routes will handle errors)
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('✅ Supabase client initialized');
} else {
  console.warn('⚠️ Supabase credentials missing - API will return mock data');
}

// ========== ROUTES ==========
// Define ALL routes BEFORE any error handlers

// TEST ROUTE - Must be first and simplest
app.get('/api/test', (req, res) => {
  console.log('✅ /api/test HIT -', new Date().toISOString());
  res.json({ 
    status: 'ok', 
    message: 'Backend is running',
    timestamp: new Date().toISOString()
  });
});

// STATUS ROUTE
app.get('/api/status', async (req, res) => {
  console.log('📊 /api/status HIT');
  
  // If no Supabase, return mock data
  if (!supabase) {
    return res.json({ 
      status: 'online', 
      farmsCount: 0,
      note: 'Supabase not configured',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const { count, error } = await supabase
      .from('farms')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    res.json({ 
      status: 'online', 
      farmsCount: count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status error:', error.message);
    res.json({ 
      status: 'online', 
      farmsCount: 0, 
      error: error.message 
    });
  }
});

// POLYGONS ROUTE
app.get('/api/polygons', async (req, res) => {
  console.log('🗺️ /api/polygons HIT');
  
  // If no Supabase, return empty GeoJSON
  if (!supabase) {
    return res.json({
      type: "FeatureCollection",
      features: []
    });
  }
  
  try {
    const { data, error } = await supabase
      .from('farms_geojson')
      .select('*');
    
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
    
    res.json({
      type: "FeatureCollection",
      features: features
    });
  } catch (error) {
    console.error('Polygons error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// SYNC ROUTE (placeholder)
app.get('/sync-kobo', (req, res) => {
  console.log('🔄 /sync-kobo HIT');
  res.json({ 
    status: 'Sync endpoint ready', 
    message: 'Sync functionality coming soon' 
  });
});

// ROOT ROUTE
app.get('/', (req, res) => {
  res.json({
    name: 'MappingTrace API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /',
      'GET /api/test',
      'GET /api/status', 
      'GET /api/polygons',
      'GET /sync-kobo'
    ]
  });
});

// Add this near your other routes
app.get('/api/alerts', (req, res) => {
    console.log('📢 /api/alerts called');
    res.json([]); // Return empty array for now
});

// 404 handler - MUST be last
app.use((req, res) => {
  console.log(`❌ 404 - Not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: 'Endpoint not found',
    available: ['/', '/api/test', '/api/status', '/api/polygons', '/sync-kobo']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = ENV_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 Root: http://localhost:${PORT}/`);
  console.log(`📍 Test: http://localhost:${PORT}/api/test`);
  console.log(`📍 Status: http://localhost:${PORT}/api/status`);
  console.log(`📍 Polygons: http://localhost:${PORT}/api/polygons`);
  console.log(`📍 Sync: http://localhost:${PORT}/sync-kobo\n`);
});

