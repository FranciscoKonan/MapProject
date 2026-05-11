// ===========================================
// SUBMISSIONS - WITH MAP VISUALIZATION
// Loads farms from Supabase with map view
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
let currentMap = null;

const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 Submissions DOM loaded');
    loadUserData();
    initSupabase();
    setupEventListeners();
});

function loadUserData() {
    const userData = localStorage.getItem('mappingtrace_user');
    if (userData) {
        const user = JSON.parse(userData);
        const userNameEl = document.getElementById('userName');
        const userRoleEl = document.getElementById('userRole');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) userNameEl.textContent = user.fullName || 'User';
        if (userRoleEl) userRoleEl.textContent = user.role || 'User';
        if (userAvatarEl) userAvatarEl.textContent = user.avatar || 'U';
    }
}

function initSupabase(retryCount = 0) {
    console.log('🔧 Initializing Supabase...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 20) {
            console.log(`⏳ Waiting for Supabase... (${retryCount + 1}/20)`);
            setTimeout(() => initSupabase(retryCount + 1), 500);
            return;
        }
        console.error('❌ Supabase library failed to load');
        showNotification('Supabase library failed to load. Please refresh.', 'error');
        return;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabase = supabaseClient;
        console.log('✅ Supabase client created');
        checkSessionAndLoad();
    } catch (error) {
        console.error('❌ Supabase init error:', error);
        if (retryCount < 5) {
            setTimeout(() => initSupabase(retryCount + 1), 1000);
        }
    }
}

async function checkSessionAndLoad() {
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
// LOAD SUBMISSIONS FROM SUPABASE
// ===========================================

async function loadSubmissionsFromSupabase() {
    console.log('📡 Loading submissions from Supabase farms table...');
    showNotification('Loading submissions...', 'info');
    
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr><td colspan="8" style="text-align:center;padding:60px;">
                <i class="fas fa-spinner fa-spin" style="font-size:48px;color:#2c6e49;"></i>
                <p style="margin-top:15px;">Loading farms from database...</p>
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
            
            updateFilterOptions();
            applyFilters();
            
            const pendingCount = allSubmissions.filter(s => s.status === 'pending').length;
            showNotification(`Loaded ${allSubmissions.length} submissions (${pendingCount} pending)`, 'success');
            
            const badge = document.getElementById('notificationBadge');
            if (badge && pendingCount > 0) {
                badge.style.display = 'block';
            } else if (badge) {
                badge.style.display = 'none';
            }
            
        } else {
            console.log('⚠️ No farms found in database');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr><td colspan="8" style="text-align:center;padding:60px;">
                        <i class="fas fa-check-circle" style="font-size:48px;color:#22c55e;"></i>
                        <h3>No Submissions Found</h3>
                        <p style="color:#64748b;">No farms have been submitted yet.</p>
                    </td></tr>
                `;
            }
            updateStats();
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
// CONVERT COORDINATES FOR LEAFLET
// ===========================================

function convertToLeafletCoords(coords) {
    if (!coords || !Array.isArray(coords)) return coords;
    
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords[1], coords[0]];
    }
    
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        return coords.map(ring => ring.map(point => [point[1], point[0]]));
    }
    
    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        return coords.map(point => [point[1], point[0]]);
    }
    
    return coords;
}

// ===========================================
// FILTER FUNCTIONS
// ===========================================

function updateFilterOptions() {
    const suppliers = [...new Set(allSubmissions.map(s => s.supplier || 'Unknown'))];
    
    const supplierSelect = document.getElementById('supplierFilter');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="all">All Suppliers</option>' + 
            suppliers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredSubmissions = allSubmissions.filter(sub => {
        if (searchTerm && !sub.farmer_name.toLowerCase().includes(searchTerm) && 
            !sub.farmer_id.toLowerCase().includes(searchTerm) &&
            !sub.cooperative.toLowerCase().includes(searchTerm)) {
            return false;
        }
        if (supplier !== 'all' && sub.supplier !== supplier) return false;
        if (status !== 'all' && sub.status !== status) return false;
        return true;
    });
    
    // Apply sorting
    filteredSubmissions.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        
        if (sortColumn === 'submission_date') {
            valA = new Date(valA);
            valB = new Date(valB);
        } else if (sortColumn === 'area') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    updateStats();
    currentPage = 1;
    renderTable();
    updatePagination();
}

function updateStats() {
    const total = filteredSubmissions.length;
    const validated = filteredSubmissions.filter(s => s.status === 'validated').length;
    const pending = filteredSubmissions.filter(s => s.status === 'pending').length;
    const rejected = filteredSubmissions.filter(s => s.status === 'rejected').length;
    
    const totalEl = document.getElementById('totalSubmissions');
    const validatedEl = document.getElementById('validatedCount');
    const pendingEl = document.getElementById('pendingCount');
    const rejectedEl = document.getElementById('rejectedCount');
    
    if (totalEl) totalEl.textContent = total;
    if (validatedEl) validatedEl.textContent = validated;
    if (pendingEl) pendingEl.textContent = pending;
    if (rejectedEl) rejectedEl.textContent = rejected;
}

function renderTable() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredSubmissions.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        tableBody.innerHTML = `
            <tr><td colspan="8" style="text-align:center;padding:60px;">
                <i class="fas fa-inbox" style="font-size:48px;color:#94a3b8;"></i>
                <p style="margin-top:15px;color:#64748b;">No submissions found</p>
            </td></tr>
        `;
        return;
    }
    
    tableBody.innerHTML = pageData.map(sub => `
        <tr>
            <td><strong>${escapeHtml(sub.farmer_name)}</strong></td>
            <td>${escapeHtml(sub.farmer_id)}</td>
            <td>${escapeHtml(sub.cooperative)}</td>
            <td>${escapeHtml(sub.supplier)}</td>
            <td>${sub.area.toFixed(2)}</td>
            <td>${formatDate(sub.submission_date)}</td>
            <td><span class="status-badge ${sub.status}">${sub.status}</span></td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="viewOnMap('${sub.id}')">
                    <i class="fas fa-map-marker-alt"></i> View Map
                </button>
                <button class="action-btn view" onclick="viewSubmissionDetails('${sub.id}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
                ${sub.status === 'pending' ? `
                    <button class="action-btn validate" onclick="updateStatus('${sub.id}', 'validated')">
                        <i class="fas fa-check"></i> Validate
                    </button>
                    <button class="action-btn reject" onclick="updateStatus('${sub.id}', 'rejected')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    applyFilters();
}

// ===========================================
// MAP VIEW FUNCTION
// ===========================================

function viewOnMap(submissionId) {
    const submission = allSubmissions.find(s => s.id === submissionId);
    if (!submission) {
        showNotification('Submission not found', 'error');
        return;
    }
    
    if (!submission.geometry || !submission.geometry.coordinates) {
        showNotification('No map data available for this submission', 'warning');
        return;
    }
    
    showSubmissionMapModal(submission);
}

function showSubmissionMapModal(submission) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    // Determine color based on status
    const statusColor = submission.status === 'validated' ? '#22c55e' : 
                        submission.status === 'pending' ? '#eab308' : '#ef4444';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-map-marked-alt"></i> Farm Location - ${escapeHtml(submission.farmer_name)}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Farmer Name:</div><div class="modal-value">${escapeHtml(submission.farmer_name)}</div></div>
                        <div class="modal-row"><div class="modal-label">Farmer ID:</div><div class="modal-value">${escapeHtml(submission.farmer_id)}</div></div>
                        <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(submission.cooperative)}</div></div>
                        <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(submission.supplier)}</div></div>
                        <div class="modal-row"><div class="modal-label">Area:</div><div class="modal-value">${submission.area.toFixed(2)} ha</div></div>
                        <div class="modal-row"><div class="modal-label">Status:</div><div class="modal-value"><span class="status-badge ${submission.status}">${submission.status}</span></div></div>
                    </div>
                </div>
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-draw-polygon"></i> Farm Boundary</div>
                    <div id="submissionMap"></div>
                    <div class="map-info">
                        <i class="fas fa-info-circle"></i> 
                        <strong>Farm boundary displayed on map.</strong> Use + / - buttons to zoom, click and drag to pan.
                        <br>Color code: <span style="color:#22c55e;">■ Green</span> = Validated, 
                        <span style="color:#eab308;">■ Yellow</span> = Pending, 
                        <span style="color:#ef4444;">■ Red</span> = Rejected
                    </div>
                </div>
                <div class="modal-actions">
                    ${submission.status === 'pending' ? `
                        <button class="modal-btn primary" onclick="updateStatus('${submission.id}', 'validated'); document.querySelector('.modal-overlay')?.remove()">
                            <i class="fas fa-check"></i> Validate
                        </button>
                        <button class="modal-btn danger" onclick="updateStatus('${submission.id}', 'rejected'); document.querySelector('.modal-overlay')?.remove()">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => initSubmissionMap(submission, statusColor), 150);
}

function initSubmissionMap(submission, statusColor) {
    const mapContainer = document.getElementById('submissionMap');
    if (!mapContainer) return;
    
    if (currentMap) currentMap.remove();
    
    // Create map
    currentMap = L.map('submissionMap').setView([7.539989, -5.547080], 14);
    L.control.zoom({ position: 'topright' }).addTo(currentMap);
    
    // Google Satellite tiles
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(currentMap);
    
    // Draw farm polygon
    if (submission.geometry?.coordinates) {
        try {
            const coords = convertToLeafletCoords(submission.geometry.coordinates);
            let polygon;
            
            if (coords[0] && Array.isArray(coords[0][0])) {
                polygon = L.polygon(coords, {
                    color: statusColor,
                    weight: 3,
                    fillColor: statusColor,
                    fillOpacity: 0.4
                }).addTo(currentMap);
            } else {
                polygon = L.polygon(coords, {
                    color: statusColor,
                    weight: 3,
                    fillColor: statusColor,
                    fillOpacity: 0.4
                }).addTo(currentMap);
            }
            
            // Calculate center and zoom
            if (polygon.getBounds && polygon.getBounds().isValid()) {
                currentMap.fitBounds(polygon.getBounds(), { padding: [50, 50] });
            }
            
            // Add popup
            polygon.bindPopup(`
                <b>${escapeHtml(submission.farmer_name)}</b><br>
                Area: ${submission.area.toFixed(2)} ha<br>
                Status: ${submission.status}
            `).openPopup();
            
        } catch(e) {
            console.warn('Error drawing polygon:', e);
            showNotification('Error displaying farm boundary', 'error');
        }
    }
    
    // Add scale bar
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(currentMap);
}

// ===========================================
// SUBMISSION DETAILS MODAL
// ===========================================

function viewSubmissionDetails(submissionId) {
    const submission = allSubmissions.find(s => s.id === submissionId);
    if (!submission) return;
    
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-tractor"></i> Submission Details</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-user"></i> Farmer Information</div>
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Farmer Name:</div><div class="modal-value">${escapeHtml(submission.farmer_name)}</div></div>
                        <div class="modal-row"><div class="modal-label">Farmer ID:</div><div class="modal-value">${escapeHtml(submission.farmer_id)}</div></div>
                        <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(submission.cooperative)}</div></div>
                        <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(submission.supplier)}</div></div>
                    </div>
                </div>
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-chart-pie"></i> Farm Metrics</div>
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Area:</div><div class="modal-value">${submission.area.toFixed(2)} hectares</div></div>
                        <div class="modal-row"><div class="modal-label">Status:</div><div class="modal-value"><span class="status-badge ${submission.status}">${submission.status}</span></div></div>
                        <div class="modal-row"><div class="modal-label">Enumerator:</div><div class="modal-value">${escapeHtml(submission.enumerator)}</div></div>
                        <div class="modal-row"><div class="modal-label">Submission Date:</div><div class="modal-value">${new Date(submission.submission_date).toLocaleString()}</div></div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn secondary" onclick="viewOnMap('${submission.id}'); this.closest('.modal-overlay').remove()">
                        <i class="fas fa-map-marker-alt"></i> View on Map
                    </button>
                    ${submission.status === 'pending' ? `
                        <button class="modal-btn primary" onclick="updateStatus('${submission.id}', 'validated'); document.querySelector('.modal-overlay')?.remove()">
                            <i class="fas fa-check"></i> Validate
                        </button>
                        <button class="modal-btn danger" onclick="updateStatus('${submission.id}', 'rejected'); document.querySelector('.modal-overlay')?.remove()">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ===========================================
// CRUD OPERATIONS
// ===========================================

async function updateStatus(submissionId, newStatus) {
    console.log(`Updating submission ${submissionId} to ${newStatus}`);
    
    try {
        const { error } = await supabaseClient
            .from('farms')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', submissionId);
        
        if (error) throw error;
        
        // Update local data
        const submission = allSubmissions.find(s => s.id === submissionId);
        if (submission) submission.status = newStatus;
        
        showNotification(`Submission ${newStatus} successfully`, 'success');
        applyFilters();
        
        // Close any open modal
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error updating status: ' + error.message, 'error');
    }
}

// ===========================================
// EXPORT FUNCTION
// ===========================================

function exportToCSV() {
    if (filteredSubmissions.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    const headers = ['Farmer Name', 'Farmer ID', 'Cooperative', 'Supplier', 'Area (ha)', 'Status', 'Enumerator', 'Submission Date'];
    const rows = filteredSubmissions.map(sub => [
        sub.farmer_name,
        sub.farmer_id,
        sub.cooperative,
        sub.supplier,
        sub.area.toFixed(2),
        sub.status,
        sub.enumerator,
        new Date(sub.submission_date).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `submissions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Export completed successfully', 'success');
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / 3600000);
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showNotification(message, type = 'info') {
    const colors = { success: '#4CAF50', error: '#F44336', warning: '#FFC107', info: '#2196F3' };
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const notification = document.createElement('div');
    notification.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;background:${colors[type]};color:white;border-radius:8px;z-index:10001;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    notification.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const supplierFilter = document.getElementById('supplierFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (searchInput) searchInput.value = '';
    if (supplierFilter) supplierFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';
    
    applyFilters();
}

function refreshData() {
    loadSubmissionsFromSupabase();
}

function setupEventListeners() {
    const applyBtn = document.getElementById('applyFiltersBtn');
    const clearBtn = document.getElementById('clearFiltersBtn');
    const exportBtn = document.getElementById('exportBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshTableBtn = document.getElementById('refreshTableBtn');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const searchInput = document.getElementById('searchInput');
    const supplierFilter = document.getElementById('supplierFilter');
    const statusFilter = document.getElementById('statusFilter');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (applyBtn) applyBtn.addEventListener('click', () => applyFilters());
    if (clearBtn) clearBtn.addEventListener('click', () => clearFilters());
    if (exportBtn) exportBtn.addEventListener('click', () => exportToCSV());
    if (refreshBtn) refreshBtn.addEventListener('click', () => refreshData());
    if (refreshTableBtn) refreshTableBtn.addEventListener('click', () => refreshData());
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); updatePagination(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => { const total = Math.ceil(filteredSubmissions.length / rowsPerPage); if (currentPage < total) { currentPage++; renderTable(); updatePagination(); } });
    if (searchInput) searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') applyFilters(); });
    if (supplierFilter) supplierFilter.addEventListener('change', () => applyFilters());
    if (statusFilter) statusFilter.addEventListener('change', () => applyFilters());
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (supabaseClient) await supabaseClient.auth.signOut();
            localStorage.clear();
            window.location.href = '../login.html';
        });
    }
}

// Make functions global
window.sortTable = sortTable;
window.viewOnMap = viewOnMap;
window.viewSubmissionDetails = viewSubmissionDetails;
window.updateStatus = updateStatus;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportToCSV = exportToCSV;
window.refreshData = refreshData;

console.log('✅ Submissions page ready with map visualization');
