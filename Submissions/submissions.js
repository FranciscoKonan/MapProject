// ===========================================
// SUBMISSIONS PAGE - COMPLETE WITH MAP INTEGRATION
// Fixed pagination and responsive background
// ===========================================

console.log('🚀 Submissions page loading...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;
let rowsPerPage = 10;
let currentSort = { column: 'submissionDate', direction: 'desc' };
let currentView = 'table';
let uniqueSuppliers = [];
let uniqueCooperatives = [];
let supplierSearchTerm = '';
let coopSearchTerm = '';
let supabaseReady = false;
let currentMap = null;
let supabaseClient = null;

// ===========================================
// SUPABASE CONFIGURATION
// ===========================================
const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

// ===========================================
// COORDINATE CONVERSION FUNCTIONS
// ===========================================

function convertToLeafletCoords(coords) {
    if (!coords || !Array.isArray(coords)) return coords;
    
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords[1], coords[0]];
    }
    
    return coords.map(item => convertToLeafletCoords(item));
}

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 DOM Content Loaded');
    loadUserData();
    initSupabase();
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

function initSupabase(retryCount = 0) {
    console.log('🔧 Initializing Supabase...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 15) {
            console.log(`⏳ Waiting for Supabase library... (${retryCount + 1}/15)`);
            setTimeout(() => initSupabase(retryCount + 1), 500);
            return;
        }
        console.error('❌ Supabase library failed to load');
        showNotification('Supabase library failed to load', 'error');
        loadSampleData();
        return;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window._supabase = supabaseClient;
        supabaseReady = true;
        console.log('✅ Supabase initialized successfully');
        loadSubmissions();
    } catch (error) {
        console.error('❌ Supabase init error:', error);
        loadSampleData();
    }
}

// ===========================================
// LOAD SUBMISSIONS FROM SUPABASE
// ===========================================
async function loadSubmissions() {
    console.log('📡 Loading submissions from farms table...');
    showNotification('Loading submissions...', 'info');
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            console.log('⚠️ No active session');
            showNotification('Please login to view submissions', 'warning');
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
            return;
        }
        
        const { data: farms, error } = await supabaseClient
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase select error:', error);
            throw error;
        }
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms from database`);
            
            allSubmissions = farms.map(farm => {
                let fixedGeometry = farm.geometry;
                if (fixedGeometry && fixedGeometry.coordinates) {
                    try {
                        fixedGeometry = {
                            type: fixedGeometry.type,
                            coordinates: convertToLeafletCoords(fixedGeometry.coordinates)
                        };
                    } catch (e) {
                        console.warn('Could not fix geometry:', e);
                    }
                }
                
                return {
                    id: farm.id,
                    farmerId: farm.farmer_id || farm.id,
                    farmerName: farm.farmer_name || 'Unknown Farmer',
                    cooperative: farm.cooperative_name || farm.cooperative || 'Unassigned',
                    supplier: farm.supplier || 'Unknown',
                    area: farm.area || 0,
                    status: farm.status || 'pending',
                    enumerator: farm.enumerator || 'N/A',
                    updatedBy: farm.validated_by || farm.enumerator || 'System',
                    submissionDate: farm.submission_date || farm.created_at || new Date().toISOString(),
                    geometry: fixedGeometry
                };
            });
            
            updateFilterOptions();
            applyFilters();
            showNotification(`Loaded ${allSubmissions.length} submissions`, 'success');
        } else {
            console.log('⚠️ No farms found in database');
            loadSampleData();
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        showNotification('Error loading submissions: ' + error.message, 'error');
        loadSampleData();
    }
}

// ===========================================
// SAMPLE DATA (Fallback)
// ===========================================
function loadSampleData() {
    console.log('📊 Loading sample submissions data');
    
    allSubmissions = [
        { id: '1', farmerId: 'F12345', farmerName: 'Koffi Jean', cooperative: 'GCC Cooperative', supplier: 'GCC', area: 2.5, status: 'pending', enumerator: 'EN001', updatedBy: 'Admin', submissionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), geometry: null },
        { id: '2', farmerId: 'F12346', farmerName: 'Konan Marie', cooperative: 'SITAPA Cooperative', supplier: 'SITAPA', area: 1.8, status: 'pending', enumerator: 'EN002', updatedBy: 'Field Officer', submissionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), geometry: null },
        { id: '3', farmerId: 'F12347', farmerName: 'N\'Guessan Paul', cooperative: 'COOP-CI', supplier: 'Other', area: 3.2, status: 'rejected', enumerator: 'EN003', updatedBy: 'Validator', submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), geometry: null },
        { id: '4', farmerId: 'F12348', farmerName: 'Yao Michelle', cooperative: 'GCC Cooperative', supplier: 'GCC', area: 5.1, status: 'validated', enumerator: 'EN001', updatedBy: 'Admin', submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), geometry: null },
        { id: '5', farmerId: 'F12349', farmerName: 'Traore Amadou', cooperative: 'SITAPA Cooperative', supplier: 'SITAPA', area: 4.2, status: 'pending', enumerator: 'EN002', updatedBy: 'Field Officer', submissionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), geometry: null }
    ];
    
    updateFilterOptions();
    applyFilters();
    showNotification('Using sample data (demo mode) - Database not connected', 'warning');
}

// ===========================================
// FILTER FUNCTIONS
// ===========================================
function updateFilterOptions() {
    uniqueSuppliers = [...new Set(allSubmissions.map(s => s.supplier))].sort();
    uniqueCooperatives = [...new Set(allSubmissions.map(s => s.cooperative))].sort();
    updateSupplierFilter();
    updateCooperativeFilter();
}

function updateSupplierFilter() {
    const select = document.getElementById('supplierFilter');
    if (!select) return;
    
    const filtered = uniqueSuppliers.filter(s => 
        s.toLowerCase().includes(supplierSearchTerm)
    );
    
    let options = '<option value="all">All Suppliers</option>';
    filtered.forEach(s => {
        options += `<option value="${s}">${escapeHtml(s)}</option>`;
    });
    select.innerHTML = options;
}

function updateCooperativeFilter() {
    const select = document.getElementById('cooperativeFilter');
    if (!select) return;
    
    const filtered = uniqueCooperatives.filter(c => 
        c.toLowerCase().includes(coopSearchTerm)
    );
    
    let options = '<option value="all">All Cooperatives</option>';
    filtered.forEach(c => {
        options += `<option value="${c}">${escapeHtml(c)}</option>`;
    });
    select.innerHTML = options;
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const cooperative = document.getElementById('cooperativeFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredSubmissions = allSubmissions.filter(sub => {
        if (searchTerm) {
            const matches = sub.farmerId.toLowerCase().includes(searchTerm) ||
                           sub.farmerName.toLowerCase().includes(searchTerm);
            if (!matches) return false;
        }
        if (supplier !== 'all' && sub.supplier !== supplier) return false;
        if (cooperative !== 'all' && sub.cooperative !== cooperative) return false;
        if (status !== 'all' && sub.status !== status) return false;
        return true;
    });
    
    sortSubmissions();
    updateStats();
    currentPage = 1;
    
    if (currentView === 'table') {
        renderTableView();
        updatePagination();
    } else {
        renderGroupView();
    }
}

function sortSubmissions() {
    filteredSubmissions.sort((a, b) => {
        let aVal = a[currentSort.column];
        let bVal = b[currentSort.column];
        
        if (currentSort.column === 'area') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (currentSort.column === 'submissionDate') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function sortTable(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    applyFilters();
}

window.sortTable = sortTable;

function updateStats() {
    const pending = filteredSubmissions.filter(s => s.status === 'pending').length;
    const validated = filteredSubmissions.filter(s => s.status === 'validated').length;
    const rejected = filteredSubmissions.filter(s => s.status === 'rejected').length;
    const total = filteredSubmissions.length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('validatedCount').textContent = validated;
    document.getElementById('rejectedCount').textContent = rejected;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('totalRecords').textContent = total;
    
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        const newAlerts = filteredSubmissions.filter(s => s.status === 'pending').length;
        badge.style.display = newAlerts > 0 ? 'block' : 'none';
    }
}

// ===========================================
// RENDER FUNCTIONS
// ===========================================
function renderTableView() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredSubmissions.slice(start, end);
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:60px;">No submissions found</td></tr>';
        document.getElementById('showingStart').textContent = '0';
        document.getElementById('showingEnd').textContent = '0';
        return;
    }
    
    tbody.innerHTML = pageData.map(sub => `
        <tr>
            <td>${escapeHtml(sub.farmerId)}</td>
            <td>${escapeHtml(sub.farmerName)}</td>
            <td>${escapeHtml(sub.cooperative)}</td>
            <td>${escapeHtml(sub.supplier)}</td>
            <td>${sub.area.toFixed(2)}</td>
            <td><span class="status-badge ${sub.status}">${sub.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewSubmission('${sub.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${sub.status === 'pending' ? `
                        <button class="action-btn validate" onclick="validateSubmission('${sub.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn reject" onclick="rejectSubmission('${sub.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
    
    // Update showing stats
    const showingStart = filteredSubmissions.length === 0 ? 0 : start + 1;
    const showingEnd = Math.min(end, filteredSubmissions.length);
    document.getElementById('showingStart').textContent = showingStart;
    document.getElementById('showingEnd').textContent = showingEnd;
    document.getElementById('totalRecords').textContent = filteredSubmissions.length;
}

function renderGroupView() {
    const container = document.getElementById('groupViewContent');
    if (!container) return;
    
    const groups = {};
    filteredSubmissions.forEach(sub => {
        if (!groups[sub.supplier]) {
            groups[sub.supplier] = [];
        }
        groups[sub.supplier].push(sub);
    });
    
    if (Object.keys(groups).length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;">No submissions found</div>';
        return;
    }
    
    container.innerHTML = Object.entries(groups).map(([supplier, submissions]) => `
        <div class="group-card">
            <div class="group-header">
                <div class="group-title">
                    <i class="fas fa-building"></i> ${escapeHtml(supplier)}
                </div>
                <div class="group-stats">
                    ${submissions.length} farms • 
                    ${submissions.filter(s => s.status === 'validated').length} validated • 
                    ${submissions.filter(s => s.status === 'pending').length} pending • 
                    ${submissions.filter(s => s.status === 'rejected').length} rejected
                </div>
            </div>
            <div class="group-items">
                ${submissions.map(sub => `
                    <div class="group-item" onclick="viewSubmission('${sub.id}')">
                        <div class="group-item-name">${escapeHtml(sub.farmerName)}</div>
                        <div class="group-item-details">
                            ID: ${escapeHtml(sub.farmerId)}<br>
                            Area: ${sub.area.toFixed(2)} ha<br>
                            Status: <span class="status-badge ${sub.status}">${sub.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ===========================================
// PAGINATION FUNCTIONS - FIXED
// ===========================================
function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
    
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;
    
    if (totalPages <= 1) {
        pageNumbers.innerHTML = '<span class="page-number active">1</span>';
        return;
    }
    
    let html = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (startPage > 1) {
        html += `<span class="page-number" onclick="goToPage(1)">1</span>`;
        if (startPage > 2) html += `<span class="page-dots">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<span class="page-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</span>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-dots">...</span>`;
        html += `<span class="page-number" onclick="goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbers.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    
    if (currentView === 'table') {
        renderTableView();
        updatePagination();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        if (currentView === 'table') {
            renderTableView();
            updatePagination();
        }
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        if (currentView === 'table') {
            renderTableView();
            updatePagination();
        }
    }
}

window.prevPage = prevPage;
window.nextPage = nextPage;
window.goToPage = goToPage;

function toggleView() {
    const tableView = document.getElementById('tableView');
    const groupView = document.getElementById('groupView');
    const toggleBtn = document.getElementById('toggleViewBtn');
    
    if (currentView === 'table') {
        tableView.style.display = 'none';
        groupView.style.display = 'block';
        currentView = 'group';
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-table"></i>';
        renderGroupView();
    } else {
        tableView.style.display = 'block';
        groupView.style.display = 'none';
        currentView = 'table';
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-layer-group"></i>';
        renderTableView();
        updatePagination();
    }
}

window.toggleView = toggleView;

function refreshData() {
    currentPage = 1;
    loadSubmissions();
}

window.refreshData = refreshData;

// ===========================================
// MAP INTEGRATION FOR SUBMISSION REVIEW
// ===========================================

function viewSubmission(id) {
    const submission = allSubmissions.find(s => s.id == id);
    if (!submission) return;
    showModalWithMap(submission);
}

window.viewSubmission = viewSubmission;

function showModalWithMap(submission) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const hasGeometry = submission.geometry && submission.geometry.coordinates;
    let mapHtml = '';
    
    if (hasGeometry) {
        mapHtml = `
            <div class="modal-section">
                <div class="modal-section-title">
                    <i class="fas fa-map-marker-alt"></i> Farm Location Map (Satellite View)
                </div>
                <div id="submissionMap" style="height: 350px; border-radius: 8px; margin-top: 10px;"></div>
                <div class="map-info" style="margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 8px; font-size: 12px;">
                    <i class="fas fa-info-circle"></i> 
                    <strong>Decision Support:</strong> Use satellite imagery to verify farm boundaries.
                </div>
            </div>
        `;
    } else {
        mapHtml = `
            <div class="modal-section">
                <div class="modal-section-title">
                    <i class="fas fa-map-marker-alt"></i> Farm Location
                </div>
                <div style="padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center; color: #999;">
                    <i class="fas fa-draw-polygon" style="font-size: 48px; margin-bottom: 10px;"></i>
                    <p>No location data available for this submission.</p>
                </div>
            </div>
        `;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;';
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:900px;width:90%;max-height:90vh;overflow-y:auto;">
            <div style="padding:20px;background:linear-gradient(135deg,#1e293b,#0f172a);color:white;display:flex;justify-content:space-between;align-items:center;border-radius:16px 16px 0 0;">
                <h3 style="margin:0;"><i class="fas fa-file-alt"></i> Submission Review</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;">✕</button>
            </div>
            <div style="padding:24px;">
                <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-weight:600;margin-bottom:15px;color:#2c6e49;"><i class="fas fa-user-farmer"></i> Farmer Information</div>
                    <div style="display:flex;padding:4px 0;"><div style="width:130px;font-weight:600;">Farmer ID:</div><div>${escapeHtml(submission.farmerId)}</div></div>
                    <div style="display:flex;padding:4px 0;"><div style="width:130px;font-weight:600;">Farmer Name:</div><div>${escapeHtml(submission.farmerName)}</div></div>
                    <div style="display:flex;padding:4px 0;"><div style="width:130px;font-weight:600;">Cooperative:</div><div>${escapeHtml(submission.cooperative)}</div></div>
                    <div style="display:flex;padding:4px 0;"><div style="width:130px;font-weight:600;">Supplier:</div><div>${escapeHtml(submission.supplier)}</div></div>
                </div>
                
                <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-weight:600;margin-bottom:15px;color:#2c6e49;"><i class="fas fa-chart-line"></i> Farm Data</div>
                    <div style="display:flex;padding:4px 0;"><div style="width:130px;font-weight:600;">Declared Area:</div><div><strong>${submission.area.toFixed(2)} hectares</strong></div></div>
                    <div style="display:flex;padding:4px 0;"><div style="width:130px;font-weight:600;">Current Status:</div><div><span class="status-badge ${submission.status}">${submission.status}</span></div></div>
                </div>
                
                ${mapHtml}
                
                ${submission.status === 'pending' ? `
                    <div style="display:flex;gap:12px;margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0;">
                        <button onclick="validateSubmission('${submission.id}')" style="flex:1;padding:10px;background:#22c55e;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">✓ Validate</button>
                        <button onclick="rejectSubmission('${submission.id}')" style="flex:1;padding:10px;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">✗ Reject</button>
                        <button onclick="this.closest('.modal-overlay').remove()" style="flex:1;padding:10px;background:#e2e8f0;border:none;border-radius:8px;cursor:pointer;">Cancel</button>
                    </div>
                ` : `
                    <div style="display:flex;gap:12px;margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0;">
                        <button onclick="this.closest('.modal-overlay').remove()" style="flex:1;padding:10px;background:#e2e8f0;border:none;border-radius:8px;cursor:pointer;">Close</button>
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    if (hasGeometry && submission.geometry.coordinates) {
        setTimeout(() => {
            initSubmissionMap(submission.geometry.coordinates, submission);
        }, 100);
    }
}

function initSubmissionMap(coordinates, submission) {
    const mapContainer = document.querySelector('#submissionMap');
    if (!mapContainer) return;
    
    if (currentMap) {
        currentMap.remove();
    }
    
    let center;
    if (coordinates[0] && Array.isArray(coordinates[0][0])) {
        let allLats = [], allLons = [];
        coordinates[0].forEach(coord => { allLons.push(coord[0]); allLats.push(coord[1]); });
        center = [(Math.min(...allLats) + Math.max(...allLats)) / 2, (Math.min(...allLons) + Math.max(...allLons)) / 2];
    } else if (coordinates[0] && Array.isArray(coordinates[0])) {
        center = [coordinates[0][1], coordinates[0][0]];
    } else {
        center = [coordinates[1], coordinates[0]];
    }
    
    currentMap = L.map('submissionMap').setView(center, 18);
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(currentMap);
    
    if (coordinates[0] && Array.isArray(coordinates[0][0])) {
        const polygon = L.polygon(coordinates, { color: '#FF9800', weight: 3, fillColor: '#FF9800', fillOpacity: 0.35 }).addTo(currentMap);
        polygon.bindPopup(`<b>${escapeHtml(submission.farmerName)}</b><br>Area: ${submission.area.toFixed(2)} ha`);
        currentMap.fitBounds(polygon.getBounds());
    } else if (coordinates[0] && Array.isArray(coordinates[0])) {
        const polyline = L.polyline(coordinates, { color: '#FF9800', weight: 3 }).addTo(currentMap);
        currentMap.fitBounds(polyline.getBounds());
    } else {
        L.marker([coordinates[1], coordinates[0]]).addTo(currentMap).bindPopup(`<b>${escapeHtml(submission.farmerName)}</b>`).openPopup();
    }
}

// ===========================================
// VALIDATE/REJECT FUNCTIONS
// ===========================================

async function validateSubmission(id) {
    if (!confirm('Are you sure you want to VALIDATE this submission?')) return;
    
    const submission = allSubmissions.find(s => s.id == id);
    if (!submission) return;
    
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    
    if (!supabaseReady || !supabaseClient) {
        showNotification('Database not connected', 'error');
        return;
    }
    
    try {
        showNotification('Updating database...', 'info');
        await supabaseClient.from('farms').update({ status: 'validated' }).eq('id', id);
        submission.status = 'validated';
        applyFilters();
        showNotification('Submission validated successfully!', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function rejectSubmission(id) {
    const reason = prompt('Please enter rejection reason:', 'Invalid or incomplete data');
    if (!reason) return;
    
    const submission = allSubmissions.find(s => s.id == id);
    if (!submission) return;
    
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    
    if (!supabaseReady || !supabaseClient) {
        showNotification('Database not connected', 'error');
        return;
    }
    
    try {
        showNotification('Updating database...', 'info');
        await supabaseClient.from('farms').update({ status: 'rejected' }).eq('id', id);
        submission.status = 'rejected';
        applyFilters();
        showNotification('Submission rejected!', 'info');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

window.validateSubmission = validateSubmission;
window.rejectSubmission = rejectSubmission;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function showNotification(message, type = 'info') {
    const colors = { success: '#4CAF50', error: '#F44336', warning: '#FFC107', info: '#2196F3' };
    const notification = document.createElement('div');
    notification.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;background:${colors[type]};color:white;border-radius:8px;z-index:10001;font-size:14px;font-weight:500;`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function setupEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', () => loadSubmissions());
    document.getElementById('searchInput')?.addEventListener('input', () => applyFilters());
    document.getElementById('supplierFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('cooperativeFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('statusFilter')?.addEventListener('change', () => applyFilters());
    
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (supabaseClient) await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

window.applyFilters = applyFilters;

console.log('✅ Submissions page ready');
