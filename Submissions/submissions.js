// ===========================================
// SUBMISSIONS PAGE - MAPPINGTRACE
// ===========================================

console.log('🚀 Submissions page loading...');

// Global variables
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;
let rowsPerPage = 10;
let sortColumn = 'submission_date';
let sortDirection = 'desc';
let supabaseClient = null;

const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 Submissions DOM loaded');
    loadUserData();
    initSupabaseAndLoad();
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

function initSupabaseAndLoad(retryCount = 0) {
    console.log('🔧 Initializing Supabase...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 20) {
            console.log(`⏳ Waiting for Supabase... (${retryCount + 1}/20)`);
            setTimeout(() => initSupabaseAndLoad(retryCount + 1), 500);
            return;
        }
        console.error('❌ Supabase library failed to load');
        showNotification('Database connection issue. Please refresh.', 'error');
        return;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabase = supabaseClient;
        console.log('✅ Supabase client created');
        
        checkSessionAndLoadSubmissions();
        
    } catch (error) {
        console.error('❌ Supabase init error:', error);
        if (retryCount < 5) {
            setTimeout(() => initSupabaseAndLoad(retryCount + 1), 1000);
        }
    }
}

async function checkSessionAndLoadSubmissions() {
    try {
        console.log('🔐 Checking session...');
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
            return;
        }
        
        if (!session) {
            console.log('⚠️ No active session, redirecting to login');
            showNotification('Please login to view submissions', 'warning');
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
            return;
        }
        
        console.log('👤 User logged in:', session.user.email);
        await loadSubmissionsFromSupabase();
        
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// ===========================================
// LOAD SUBMISSIONS
// ===========================================

async function loadSubmissionsFromSupabase() {
    console.log('📡 Loading submissions from Supabase farms table...');
    showNotification('Loading submissions...', 'info');
    
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr><td colspan="8" style="text-align:center;padding:60px;">
                <i class="fas fa-spinner fa-spin" style="font-size:48px;color:#2c6e49;"></i>
                <p style="margin-top:15px;">Loading submissions from database...</p>
            </td></tr>
        `;
    }
    
    try {
        const { data: farms, error } = await supabaseClient
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        console.log('Raw farms data:', farms);
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms from database`);
            
            allSubmissions = farms.map(farm => ({
                id: farm.id,
                farmer_id: farm.farmer_id || farm.id,
                farmer_name: farm.farmer_name || 'Unknown Farmer',
                cooperative: farm.cooperative_name || farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                area: parseFloat(farm.area) || 0,
                status: farm.status || 'pending',
                enumerator: farm.enumerator || 'N/A',
                submission_date: farm.submission_date || farm.created_at,
                created_at: farm.created_at,
                geometry: farm.geometry
            }));
            
            console.log(`📊 Processed ${allSubmissions.length} submissions`);
            
            updateSupplierFilter();
            applyFiltersAndRender();
            
            showNotification(`Loaded ${allSubmissions.length} submissions`, 'success');
            
        } else {
            console.log('⚠️ No farms found in database');
            tableBody.innerHTML = `
                <tr><td colspan="8" style="text-align:center;padding:60px;">
                    <i class="fas fa-check-circle" style="font-size:48px;color:#22c55e;"></i>
                    <h3>No Submissions Found</h3>
                    <p style="color:#64748b;">No farms have been submitted yet.</p>
                </td></tr>
            `;
        }
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        showNotification('Error loading submissions: ' + error.message, 'error');
        
        if (tableBody) {
            tableBody.innerHTML = `
                <tr><td colspan="8" style="text-align:center;padding:60px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#dc2626;"></i>
                    <h3>Error Loading Data</h3>
                    <p style="color:#64748b;">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top:15px;padding:8px 16px;background:#2c6e49;color:white;border:none;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </td></tr>
            `;
        }
    }
}

// ===========================================
// FILTER AND SORT FUNCTIONS
// ===========================================

function updateSupplierFilter() {
    const suppliers = [...new Set(allSubmissions.map(s => s.supplier))];
    const supplierSelect = document.getElementById('supplierFilter');
    if (supplier
