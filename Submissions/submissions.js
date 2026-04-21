// ===========================================
// SUBMISSIONS PAGE - COMPLETE WITH MAP INTEGRATION
// FIXED: Supabase update for approve/reject
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
    } else {
        const dashboardUser = localStorage.getItem('dashboardUser');
        if (dashboardUser) {
            const user = JSON.parse(dashboardUser);
            document.getElementById('userName').textContent = user.name || 'User';
            document.getElementById('userRole').textContent = user.role || 'User';
            document.getElementById('userAvatar').textContent = user.initials || 'U';
        }
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
        loadSampleData();
        return;
    }
    
    try {
        window._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
        const { data: farms, error } = await window._supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
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
                    geometry: fixedGeometry,
                    submission_data: farm.submission_data,
                    validation_status: farm.validation_status,
                    rejection_reason: farm.rejection_reason
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
        loadSampleData();
    }
}

// ===========================================
// SAMPLE DATA (Fallback)
// ===========================================
function loadSampleData() {
    console.log('📊 Loading sample submissions data');
    
    allSubmissions = [
        { id: '1', farmerId: 'F12345', farmerName: 'Koffi Jean', cooperative: 'GCC Cooperative', supplier: 'GCC', area: 2.5, status: 'approved', enumerator: 'EN001', updatedBy: 'Admin', submissionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), geometry: null },
        { id: '2', farmerId: 'F12346', farmerName: 'Konan Marie', cooperative: 'SITAPA Cooperative', supplier: 'SITAPA', area: 1.8, status: 'pending', enumerator: 'EN002', updatedBy: 'Field Officer', submissionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), geometry: null },
        { id: '3', farmerId: 'F12347', farmerName: 'N\'Guessan Paul', cooperative: 'COOP-CI', supplier: 'Other', area: 3.2, status: 'rejected', enumerator: 'EN003', updatedBy: 'Validator', submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), geometry: null }
    ];
    
    updateFilterOptions();
    applyFilters();
    showNotification('Using sample data (demo mode)', 'info');
}

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

function updateStats() {
    const pending = filteredSubmissions.filter(s => s.status === 'pending').length;
    const validated = filteredSubmissions.filter(s => s.status === 'approved' || s.status === 'validated').length;
    const rejected = filteredSubmissions.filter(s => s.status === 'rejected').length;
    const total = filteredSubmissions.length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('validatedCount').textContent = validated;
    document.getElementById('rejectedCount').textContent = rejected;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('totalRecords').textContent = total;
}

function renderTableView() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredSubmissions.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;">No submissions found</td></tr>';
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
                        <button class="action-btn validate" onclick="approveSubmission('${sub.id}')">
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
                    ${submissions.filter(s => s.status === 'approved').length} approved • 
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

function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, filteredSubmissions.length);
    
    document.getElementById('showingStart').textContent = start;
    document.getElementById('showingEnd').textContent = end;
    
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;
    
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
    
    pageNumbers.innerHTML = html || '<span class="page-number active">1</span>';
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTableView();
    updatePagination();
}

function toggleView() {
    const tableView = document.getElementById('tableView');
    const groupView = document.getElementById('groupView');
    const toggleBtn = document.getElementById('toggleViewBtn');
    
    if (currentView === 'table') {
        tableView.style.display = 'none';
        groupView.style.display = 'block';
        currentView = 'group';
        toggleBtn.innerHTML = '<i class="fas fa-table"></i> Table View';
        renderGroupView();
    } else {
        tableView.style.display = 'block';
        groupView.style.display = 'none';
        currentView = 'table';
        toggleBtn.innerHTML = '<i class="fas fa-layer-group"></i> Group View';
        renderTableView();
        updatePagination();
    }
}

// ===========================================
// MAP INTEGRATION FOR SUBMISSION REVIEW
// ===========================================

function viewSubmission(id) {
    const submission = allSubmissions.find(s => s.id == id);
    if (!submission) return;
    
    showModalWithMap(submission);
}

function showModalWithMap(submission) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const hasGeometry = submission.geometry && submission.geometry.coordinates;
    let mapHtml = '';
    let leafletCoords = null;
    
    if (hasGeometry) {
        leafletCoords = submission.geometry.coordinates;
        
        mapHtml = `
            <div class="modal-section">
                <div class="modal-section-title">
                    <i class="fas fa-map-marker-alt"></i> Farm Location Map (Satellite View)
                </div>
                <div id="submissionMap"></div>
                <div class="map-info">
                    <i class="fas fa-info-circle"></i> 
                    <strong>Decision Support:</strong> Use satellite imagery to verify farm boundaries, 
                    check vegetation, crop health, and assess accessibility before approving or rejecting.
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
                    <p style="font-size: 12px;">The farm polygon or point coordinates are missing.</p>
                </div>
            </div>
        `;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-file-alt"></i> Submission Review - Decision Making</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <div class="modal-section-title">
                        <i class="fas fa-user-farmer"></i> Farmer Information
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Farmer ID:</div>
                        <div class="modal-value">${escapeHtml(submission.farmerId)}</div>
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Farmer Name:</div>
                        <div class="modal-value">${escapeHtml(submission.farmerName)}</div>
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Cooperative:</div>
                        <div class="modal-value">${escapeHtml(submission.cooperative)}</div>
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Supplier:</div>
                        <div class="modal-value">${escapeHtml(submission.supplier)}</div>
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Enumerator:</div>
                        <div class="modal-value">${escapeHtml(submission.enumerator)}</div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <div class="modal-section-title">
                        <i class="fas fa-chart-line"></i> Farm Data
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Declared Area:</div>
                        <div class="modal-value"><strong>${submission.area.toFixed(2)} hectares</strong></div>
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Current Status:</div>
                        <div class="modal-value">
                            <span class="status-badge ${submission.status}">${submission.status}</span>
                        </div>
                    </div>
                    <div class="modal-row">
                        <div class="modal-label">Submission Date:</div>
                        <div class="modal-value">${new Date(submission.submissionDate).toLocaleString()}</div>
                    </div>
                </div>
                
                ${mapHtml}
                
                ${submission.status === 'pending' ? `
                    <div class="modal-actions">
                        <button class="modal-btn approve" onclick="approveSubmission('${submission.id}')">
                            <i class="fas fa-check"></i> Approve Submission
                        </button>
                        <button class="modal-btn reject" onclick="rejectSubmission('${submission.id}')">
                            <i class="fas fa-times"></i> Reject Submission
                        </button>
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">
                            Cancel
                        </button>
                    </div>
                ` : `
                    <div class="modal-actions">
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">
                            Close
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    if (hasGeometry && leafletCoords) {
        setTimeout(() => {
            initSubmissionMap(leafletCoords, submission);
        }, 100);
    }
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function initSubmissionMap(coordinates, submission) {
    const mapContainer = document.getElementById('submissionMap');
    if (!mapContainer) return;
    
    if (currentMap) {
        currentMap.remove();
    }
    
    let center;
    
    if (coordinates[0] && Array.isArray(coordinates[0][0])) {
        let allLons = [];
        let allLats = [];
        coordinates[0].forEach(coord => {
            allLons.push(coord[0]);
            allLats.push(coord[1]);
        });
        center = [(Math.min(...allLats) + Math.max(...allLats)) / 2, 
                   (Math.min(...allLons) + Math.max(...allLons)) / 2];
    } else if (coordinates[0] && Array.isArray(coordinates[0])) {
        center = [coordinates[0][1], coordinates[0][0]];
    } else {
        center = [coordinates[1], coordinates[0]];
    }
    
    currentMap = L.map('submissionMap', {
        attributionControl: false
    }).setView(center, 18);
    
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(currentMap);
    
    if (coordinates[0] && Array.isArray(coordinates[0][0])) {
        const polygon = L.polygon(coordinates, {
            color: '#FF9800',
            weight: 3,
            fillColor: '#FF9800',
            fillOpacity: 0.35
        }).addTo(currentMap);
        
        polygon.bindPopup(`
            <b>${escapeHtml(submission.farmerName)}</b><br>
            <b>Farm ID:</b> ${escapeHtml(submission.farmerId)}<br>
            <b>Area:</b> ${submission.area.toFixed(2)} ha<br>
            <b>Status:</b> ${submission.status}
        `);
        
        const bounds = polygon.getBounds();
        if (bounds.isValid()) {
            currentMap.fitBounds(bounds);
        }
    } else if (coordinates[0] && Array.isArray(coordinates[0])) {
        const polyline = L.polyline(coordinates, {
            color: '#FF9800',
            weight: 3
        }).addTo(currentMap);
        
        const bounds = polyline.getBounds();
        if (bounds.isValid()) {
            currentMap.fitBounds(bounds);
        }
    } else {
        const marker = L.marker([coordinates[1], coordinates[0]]).addTo(currentMap);
        marker.bindPopup(`
            <b>${escapeHtml(submission.farmerName)}</b><br>
            <b>Farm ID:</b> ${escapeHtml(submission.farmerId)}<br>
            <b>Area:</b> ${submission.area.toFixed(2)} ha<br>
            <b>Status:</b> ${submission.status}
        `);
        marker.openPopup();
    }
    
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(currentMap);
    L.control.zoom({ position: 'topright' }).addTo(currentMap);
}

// ===========================================
// APPROVE/REJECT FUNCTIONS - FIXED FOR SUPABASE
// ===========================================

async function approveSubmission(id) {
    console.log(`✅ Approving submission ${id}...`);
    
    if (!confirm('Are you sure you want to APPROVE this submission?')) return;
    
    const submission = allSubmissions.find(s => s.id == id);
    if (!submission) {
        console.error('Submission not found:', id);
        showNotification('Submission not found!', 'error');
        return;
    }
    
    // Close modal if open
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    // Get current user name
    const userName = document.getElementById('userName')?.textContent || 'Admin';
    
    if (window._supabase && supabaseReady) {
        try {
            showNotification('Updating database...', 'info');
            
            // Update in Supabase
            const { data, error } = await window._supabase
                .from('farms')
                .update({ 
                    status: 'approved',
                    validation_status: 'approved',
                    validated_by: userName,
                    validated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            
            console.log('Supabase update successful:', data);
            showNotification('Submission approved in database!', 'success');
            
            // Update local data
            submission.status = 'approved';
            submission.validation_status = 'approved';
            submission.validated_by = userName;
            submission.validated_at = new Date().toISOString();
            
        } catch (error) {
            console.error('Error updating Supabase:', error);
            showNotification('Error updating database: ' + error.message, 'error');
            return;
        }
    } else {
        // Fallback: local update only
        console.warn('Supabase not ready, updating locally only');
        submission.status = 'approved';
        showNotification('Submission approved (local only - database not connected)', 'warning');
    }
    
    // Refresh the view
    applyFilters();
    showNotification('Submission approved successfully!', 'success');
}

async function rejectSubmission(id) {
    console.log(`❌ Rejecting submission ${id}...`);
    
    const reason = prompt('Please enter rejection reason:', 'Invalid or incomplete data');
    if (!reason) return;
    
    const submission = allSubmissions.find(s => s.id == id);
    if (!submission) {
        console.error('Submission not found:', id);
        showNotification('Submission not found!', 'error');
        return;
    }
    
    // Close modal if open
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    // Get current user name
    const userName = document.getElementById('userName')?.textContent || 'Admin';
    
    if (window._supabase && supabaseReady) {
        try {
            showNotification('Updating database...', 'info');
            
            // Update in Supabase
            const { data, error } = await window._supabase
                .from('farms')
                .update({ 
                    status: 'rejected',
                    validation_status: 'rejected',
                    rejection_reason: reason,
                    validated_by: userName,
                    validated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select();
            
            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }
            
            console.log('Supabase update successful:', data);
            showNotification('Submission rejected in database!', 'info');
            
            // Update local data
            submission.status = 'rejected';
            submission.validation_status = 'rejected';
            submission.rejection_reason = reason;
            submission.validated_by = userName;
            submission.validated_at = new Date().toISOString();
            
        } catch (error) {
            console.error('Error updating Supabase:', error);
            showNotification('Error updating database: ' + error.message, 'error');
            return;
        }
    } else {
        // Fallback: local update only
        console.warn('Supabase not ready, updating locally only');
        submission.status = 'rejected';
        showNotification('Submission rejected (local only - database not connected)', 'warning');
    }
    
    // Refresh the view
    applyFilters();
    showNotification('Submission rejected!', 'info');
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showNotification(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    
    const colors = {
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FFC107',
        info: '#2196F3'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${colors[type]};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadSubmissions());
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', () => applyFilters());
    
    const supplierSearch = document.getElementById('supplierSearchInput');
    if (supplierSearch) {
        supplierSearch.addEventListener('input', (e) => {
            supplierSearchTerm = e.target.value.toLowerCase();
            updateSupplierFilter();
            applyFilters();
        });
    }
    
    const coopSearch = document.getElementById('coopSearchInput');
    if (coopSearch) {
        coopSearch.addEventListener('input', (e) => {
            coopSearchTerm = e.target.value.toLowerCase();
            updateCooperativeFilter();
            applyFilters();
        });
    }
    
    const supplierFilter = document.getElementById('supplierFilter');
    if (supplierFilter) supplierFilter.addEventListener('change', () => applyFilters());
    
    const cooperativeFilter = document.getElementById('cooperativeFilter');
    if (cooperativeFilter) cooperativeFilter.addEventListener('change', () => applyFilters());
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', () => applyFilters());
    
    const toggleBtn = document.getElementById('toggleViewBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleView());
    
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTableView(); updatePagination(); } });
    
    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => { const total = Math.ceil(filteredSubmissions.length / rowsPerPage); if (currentPage < total) { currentPage++; renderTableView(); updatePagination(); } });
    
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            applyFilters();
        });
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (window._supabase) await window._supabase.auth.signOut();
            localStorage.clear();
            window.location.href = '../login.html';
        });
    }
}

// Expose global functions
window.viewSubmission = viewSubmission;
window.approveSubmission = approveSubmission;
window.rejectSubmission = rejectSubmission;
window.goToPage = goToPage;
window.toggleView = toggleView;
window.applyFilters = applyFilters;

console.log('✅ Submissions page ready with working Supabase updates');
