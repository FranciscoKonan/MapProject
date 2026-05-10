// ===========================================
// QUALITY ALERTS - Same pattern as Dashboard
// ===========================================

console.log('🚀 Quality Alerts page loading...');

let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let rowsPerPage = 10;
let allFarms = [];
let currentMap = null;

const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

// Wait for global Supabase (same as Dashboard)
function waitForSupabase(callback, retries = 0) {
    if (window.supabase && window.supabase.auth) {
        callback();
    } else if (retries < 20) {
        setTimeout(() => waitForSupabase(callback, retries + 1), 500);
    } else {
        console.error('Supabase not available');
        showNotification('Database connection issue. Using sample data.', 'warning');
        loadSampleData();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 Quality Alerts DOM loaded');
    loadUserData();
    waitForSupabase(initQualityAlerts);
    setupEventListeners();
});

function loadUserData() {
    const userData = localStorage.getItem('mappingtrace_user');
    if (userData) {
        const user = JSON.parse(userData);
        document.getElementById('userName').textContent = user.fullName || 'User';
        document.getElementById('userRole').textContent = user.role || 'User';
        document.getElementById('userAvatar').textContent = user.avatar || 'U';
    }
}

async function initQualityAlerts() {
    console.log('🔧 Initializing Quality Alerts with Supabase...');
    
    try {
        // Check session
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            console.log('⚠️ No active session');
            showNotification('Please login to view alerts', 'warning');
            setTimeout(() => window.location.href = '../login.html', 2000);
            return;
        }
        
        console.log('👤 User logged in:', session.user.email);
        await loadFarmsFromDatabase();
        
    } catch (error) {
        console.error('Init error:', error);
        loadSampleData();
    }
}

async function loadFarmsFromDatabase() {
    console.log('📡 Loading farms from Supabase...');
    showNotification('Loading farm data...', 'info');
    
    try {
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms`);
            
            allFarms = farms.map(farm => ({
                id: farm.id,
                farmer_id: farm.farmer_id || farm.id,
                farmer_name: farm.farmer_name || 'Unknown Farmer',
                farmerName: farm.farmer_name || 'Unknown Farmer',
                cooperative: farm.cooperative_name || farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                area: farm.area || 0,
                status: farm.status || 'pending',
                geometry: farm.geometry,
                created_at: farm.created_at
            }));
            
            generateAlertsFromFarms();
            updateFilterOptions();
            applyFilters();
            
            showNotification(`Loaded ${allFarms.length} farms, ${allAlerts.length} alerts`, 
                           allAlerts.length > 0 ? 'warning' : 'success');
        } else {
            console.log('⚠️ No farms found');
            loadSampleData();
        }
        
    } catch (error) {
        console.error('Error loading farms:', error);
        loadSampleData();
    }
}

// [Rest of the functions remain the same as the previous quality-alerts.js]
// Including: generateAlertsFromFarms, convertToLeafletCoords, 
// viewAlertOnMap, showOverlapMapModal, initOverlapMap, etc.
// (Keeping the same functionality but matching Dashboard styling)
