// ===========================================
// QUALITY ALERTS - COMPLETE JAVASCRIPT
// ===========================================

console.log('🚀 Quality Alerts page loading...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let rowsPerPage = 10;
let uniqueSuppliers = [];
let uniqueCooperatives = [];
let supplierSearchTerm = '';
let coopSearchTerm = '';
let supabaseReady = false;

// ===========================================
// ALERT GENERATION FUNCTIONS
// ===========================================

// Function to generate alerts from farm data
function generateAlertsFromFarms(farms) {
    const alerts = [];
    
    farms.forEach(farm => {
        // Check for missing data
        if (!farm.farmer_name || farm.farmer_name === 'Unknown' || !farm.farmer_id) {
            alerts.push({
                id: `missing_${farm.id}`,
                farmId: farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || 'N/A',
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'data',
                severity: 'high',
                title: 'Missing Data',
                description: `Farm missing required information: ${!farm.farmer_name ? 'Farmer name, ' : ''}${!farm.farmer_id ? 'Farmer ID' : ''}`,
                status: 'new',
                date: new Date().toISOString()
            });
        }
        
        // Check for area mismatch (if area is 0 or very small)
        if (!farm.area || farm.area < 0.1) {
            alerts.push({
                id: `area_${farm.id}`,
                farmId: farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || 'N/A',
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'area',
                severity: 'medium',
                title: 'Area Mismatch',
                description: `Farm area is ${farm.area || 0} ha. Area seems unusually small or missing.`,
                status: 'new',
                date: new Date().toISOString()
            });
        }
        
        // Check for invalid geometry
        if (farm.geometry) {
            try {
                const geom = typeof farm.geometry === 'string' ? JSON.parse(farm.geometry) : farm.geometry;
                
                // Check for self-intersection (simplified check)
                if (geom.type === 'Polygon' && geom.coordinates[0] && geom.coordinates[0].length > 3) {
                    // Check if polygon is closed properly
                    const first = geom.coordinates[0][0];
                    const last = geom.coordinates[0][geom.coordinates[0].length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        alerts.push({
                            id: `boundary_${farm.id}`,
                            farmId: farm.id,
                            farmerName: farm.farmer_name || 'Unknown',
                            farmerId: farm.farmer_id || 'N/A',
                            cooperative: farm.cooperative || 'Unassigned',
                            supplier: farm.supplier || 'Unknown',
                            type: 'boundary',
                            severity: 'critical',
                            title: 'Boundary Issue',
                            description: 'Farm polygon is not properly closed. This may cause calculation errors.',
                            status: 'new',
                            date: new Date().toISOString()
                        });
                    }
                }
            } catch (e) {
                alerts.push({
                    id: `geometry_${farm.id}`,
                    farmId: farm.id,
                    farmerName: farm.farmer_name || 'Unknown',
                    farmerId: farm.farmer_id || 'N/A',
                    cooperative: farm.cooperative || 'Unassigned',
                    supplier: farm.supplier || 'Unknown',
                    type: 'data',
                    severity: 'high',
                    title: 'Invalid Geometry',
                    description: 'Farm geometry data is corrupted or invalid.',
                    status: 'new',
                    date: new Date().toISOString()
                });
            }
        } else if (farm.status !== 'rejected') {
            // Check for missing geometry
            alerts.push({
                id: `no_geom_${farm.id}`,
                farmId: farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || 'N/A',
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'data',
                severity: 'high',
                title: 'Missing Geometry',
                description: 'Farm has no geometry data. Cannot display on map.',
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    // Check for overlapping farms (simplified - would need spatial analysis)
    // This is a simplified version - full overlap detection would require Turf.js
    for (let i = 0; i < farms.length; i++) {
        for (let j = i + 1; j < farms.length; j++) {
            if (farms[i].supplier === farms[j].supplier && 
                farms[i].cooperative === farms[j].cooperative) {
                // Potential overlap alert
                alerts.push({
                    id: `overlap_${farms[i].id}_${farms[j].id}`,
                    farmId: `${farms[i].id}, ${farms[j].id}`,
                    farmerName: `${farms[i].farmer_name} & ${farms[j].farmer_name}`,
                    farmerId: `${farms[i].farmer_id}, ${farms[j].farmer_id}`,
                    cooperative: farms[i].cooperative,
                    supplier: farms[i].supplier,
                    type: 'overlap',
                    severity: 'medium',
                    title: 'Potential Farm Overlap',
                    description: `Farms from same supplier/cooperative may overlap. Please verify boundaries.`,
                    status: 'new',
                    date: new Date().toISOString()
                });
                break;
            }
        }
    }
    
    return alerts;
}

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 DOM Content Loaded');
    
    // Load user data from localStorage
    const userData = localStorage.getItem('mappingtrace_user');
    if (userData) {
        const user = JSON.parse(userData);
        document.getElementById('userName').textContent = user.fullName || 'User';
        document.getElementById('userRole').textContent = user.role || 'User';
        document.getElementById('userAvatar').textContent = user.avatar || 'U';
    }
    
    // Listen for Supabase ready
    window.addEventListener('supabase-ready', function() {
        console.log('✅ Supabase ready, loading alerts...');
        supabaseReady = true;
        loadFarmsAndGenerateAlerts();
    });
    
    // Check if already ready
    if (window.supabase) {
        console.log('✅ Supabase already ready');
        supabaseReady = true;
        loadFarmsAndGenerateAlerts();
    }
    
    // Setup event listeners
    setupEventListeners();
});

// ===========================================
// LOAD FARMS AND GENERATE ALERTS
// ===========================================
async function loadFarmsAndGenerateAlerts() {
    console.log('📡 Loading farms to generate alerts...');
    showNotification('Loading farm data...', 'info');
    
    try {
        if (!window.supabase || !window.supabase.auth) {
            console.error('❌ Supabase not available');
            loadSampleAlerts();
            return;
        }
        
        // Check session
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            console.log('⚠️ No active session');
            window.location.href = '../login.html';
            return;
        }
        
        // Fetch farms
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms, generating alerts...`);
            
            // Transform farms data
            const transformedFarms = farms.map(farm => ({
                id: farm.id,
                farmer_id: farm.farmer_id,
                farmer_name: farm.farmer_name,
                cooperative: farm.cooperative,
                supplier: farm.supplier,
                area: farm.area,
                status: farm.status,
                geometry: farm.geometry
            }));
            
            // Generate alerts from farms
            allAlerts = generateAlertsFromFarms(transformedFarms);
            
            console.log(`✅ Generated ${allAlerts.length} alerts`);
            
            // Update filter options
            updateFilterOptions();
            
            // Apply filters and render
            applyFilters();
            
            showNotification(`Found ${allAlerts.length} quality alerts`, allAlerts.length > 0 ? 'warning' : 'success');
            
        } else {
            console.log('⚠️ No farms found');
            loadSampleAlerts();
        }
        
    } catch (error) {
        console.error('Error loading farms:', error);
        showNotification('Error loading data', 'error');
        loadSampleAlerts();
    }
}

// ===========================================
// SAMPLE ALERTS (Fallback)
// ===========================================
function loadSampleAlerts() {
    console.log('📊 Loading sample alerts');
    
    allAlerts = [
        {
            id: '1',
            farmId: 'F12345',
            farmerName: 'Koffi Jean',
            farmerId: 'F12345',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            type: 'overlap',
            severity: 'critical',
            title: 'Farm Overlap Detected',
            description: 'This farm overlaps with farm F12346 by approximately 0.5 hectares.',
            status: 'new',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '2',
            farmId: 'F12346',
            farmerName: 'Konan Marie',
            farmerId: 'F12346',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            type: 'boundary',
            severity: 'high',
            title: 'Boundary Issue',
            description: 'Farm boundary is not properly closed. The polygon is open.',
            status: 'new',
            date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '3',
            farmId: 'F12347',
            farmerName: 'N\'Guessan Paul',
            farmerId: 'F12347',
            cooperative: 'COOP-CI',
            supplier: 'Other',
            type: 'area',
            severity: 'medium',
            title: 'Area Mismatch',
            description: 'Reported area (3.2 ha) differs significantly from calculated area (2.8 ha).',
            status: 'acknowledged',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '4',
            farmId: 'F12348',
            farmerName: 'Yao Michel',
            farmerId: 'F12348',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            type: 'data',
            severity: 'high',
            title: 'Missing Data',
            description: 'Farmer name is missing from the submission.',
            status: 'new',
            date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '5',
            farmId: 'F12349',
            farmerName: 'Traore Amadou',
            farmerId: 'F12349',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            type: 'overlap',
            severity: 'low',
            title: 'Minor Overlap',
            description: 'Small overlap with adjacent farm (0.05 ha).',
            status: 'resolved',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
    
    updateFilterOptions();
    applyFilters();
    showNotification('Using sample alerts (demo mode)', 'info');
}

// ===========================================
// UPDATE FILTER OPTIONS
// ===========================================
function updateFilterOptions() {
    uniqueSuppliers = [...new Set(allAlerts.map(a => a.supplier))].sort();
    uniqueCooperatives = [...new Set(allAlerts.map(a => a.cooperative))].sort();
    
    updateSupplierFilter();
    updateCooperativeFilter();
}

function updateSupplierFilter() {
    const select = document.getElementById('alertSupplierFilter');
    if (!select) return;
    
    const filtered = uniqueSuppliers.filter(s => 
        s.toLowerCase().includes(supplierSearchTerm)
    );
    
    let options = '<option value="all">All Suppliers</option>';
    filtered.forEach(s => {
        options += `<option value="${s}">${s}</option>`;
    });
    select.innerHTML = options;
}

function updateCooperativeFilter() {
    const select = document.getElementById('alertCoopFilter');
    if (!select) return;
    
    const filtered = uniqueCooperatives.filter(c => 
        c.toLowerCase().includes(coopSearchTerm)
    );
    
    let options = '<option value="all">All Cooperatives</option>';
    filtered.forEach(c => {
        options += `<option value="${c}">${c}</option>`;
    });
    select.innerHTML = options;
}

// ===========================================
// APPLY FILTERS
// ===========================================
function applyFilters() {
    const type = document.getElementById('alertTypeFilter')?.value || 'all';
    const severity = document.getElementById('alertSeverityFilter')?.value || 'all';
    const supplier = document.getElementById('alertSupplierFilter')?.value || 'all';
    const cooperative = document.getElementById('alertCoopFilter')?.value || 'all';
    const status = document.getElementById('alertStatusFilter')?.value || 'all';
    
    filteredAlerts = allAlerts.filter(alert => {
        if (type !== 'all' && alert.type !== type) return false;
        if (severity !== 'all' && alert.severity !== severity) return false;
        if (supplier !== 'all' && alert.supplier !== supplier) return false;
        if (cooperative !== 'all' && alert.cooperative !== cooperative) return false;
        if (status !== 'all' && alert.status !== status) return false;
        return true;
    });
    
    // Sort by date (newest first)
    filteredAlerts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Update stats
    updateStats();
    
    // Update export count
    document.getElementById('exportCount').textContent = `${filteredAlerts.length} alerts`;
    
    // Reset to first page
    currentPage = 1;
    
    // Render alerts
    renderAlerts();
    updatePagination();
}

// ===========================================
// UPDATE STATS
// ===========================================
function updateStats() {
    const critical = filteredAlerts.filter(a => a.severity === 'critical').length;
    const high = filteredAlerts.filter(a => a.severity === 'high').length;
    const medium = filteredAlerts.filter(a => a.severity === 'medium').length;
    const low = filteredAlerts.filter(a => a.severity === 'low').length;
    const total = filteredAlerts.length;
    
    document.getElementById('criticalCount').textContent = critical;
    document.getElementById('highCount').textContent = high;
    document.getElementById('mediumCount').textContent = medium;
    document.getElementById('lowCount').textContent = low;
    document.getElementById('totalAlerts').textContent = total;
    
    // Update notification badge
    const newAlerts = filteredAlerts.filter(a => a.status === 'new').length;
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = newAlerts;
        badge.style.display = newAlerts > 0 ? 'flex' : 'none';
    }
}

// ===========================================
// RENDER ALERTS
// ===========================================
function renderAlerts() {
    const container = document.getElementById('alertsList');
    if (!container) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredAlerts.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <i class="fas fa-check-circle" style="font-size: 48px; color: #22c55e; margin-bottom: 15px;"></i>
                <h3>No Quality Alerts</h3>
                <p style="color: #64748b;">All farms are in good quality. No alerts found.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageData.map(alert => `
        <div class="alert-item ${alert.status}" onclick="viewAlertDetails('${alert.id}')">
            <div class="alert-header">
                <div class="alert-severity ${alert.severity}">
                    <i class="fas ${getSeverityIcon(alert.severity)}"></i>
                </div>
                <div class="alert-title">
                    ${escapeHtml(alert.title)}
                    <span class="alert-badge ${alert.status}">${alert.status}</span>
                </div>
                <div class="alert-date">${formatDate(alert.date)}</div>
            </div>
            <div class="alert-details">
                <p><strong>Farm:</strong> ${escapeHtml(alert.farmerName)} (${escapeHtml(alert.farmerId)})</p>
                <p><strong>${alert.type === 'overlap' ? 'Farms' : 'Supplier'}:</strong> ${escapeHtml(alert.supplier)} • ${escapeHtml(alert.cooperative)}</p>
                <p>${escapeHtml(alert.description)}</p>
            </div>
            <div class="alert-actions">
                ${alert.status === 'new' ? `
                    <button class="alert-action-btn acknowledge" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'acknowledged')">
                        <i class="fas fa-check"></i> Acknowledge
                    </button>
                    <button class="alert-action-btn resolve" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'resolved')">
                        <i class="fas fa-check-double"></i> Resolve
                    </button>
                    <button class="alert-action-btn ignore" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'ignored')">
                        <i class="fas fa-times"></i> Ignore
                    </button>
                ` : alert.status === 'acknowledged' ? `
                    <button class="alert-action-btn resolve" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'resolved')">
                        <i class="fas fa-check-double"></i> Mark Resolved
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// ===========================================
// PAGINATION
// ===========================================
function updatePagination() {
    const totalPages = Math.ceil(filteredAlerts.length / rowsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    }
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredAlerts.length / rowsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderAlerts();
    updatePagination();
}

// ===========================================
// ALERT ACTIONS
// ===========================================
function updateAlertStatus(alertId, newStatus) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (alert) {
        alert.status = newStatus;
        
        // Update in filtered list
        const filteredAlert = filteredAlerts.find(a => a.id === alertId);
        if (filteredAlert) filteredAlert.status = newStatus;
        
        applyFilters();
        showNotification(`Alert ${newStatus}`, 'success');
    }
}

function viewAlertDetails(alertId) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    showAlertModal(alert);
}

function showAlertModal(alert) {
    // Remove existing modal
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const severityColors = {
        critical: '#dc2626',
        high: '#f97316',
        medium: '#eab308',
        low: '#22c55e'
    };
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header" style="background: linear-gradient(135deg, ${severityColors[alert.severity]}, ${severityColors[alert.severity]}cc);">
                <h3>
                    <i class="fas ${getSeverityIcon(alert.severity)}"></i>
                    ${escapeHtml(alert.title)}
                </h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-row">
                    <div class="modal-label">Farm:</div>
                    <div class="modal-value">${escapeHtml(alert.farmerName)} (${escapeHtml(alert.farmerId)})</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Supplier:</div>
                    <div class="modal-value">${escapeHtml(alert.supplier)}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Cooperative:</div>
                    <div class="modal-value">${escapeHtml(alert.cooperative)}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Alert Type:</div>
                    <div class="modal-value">${alert.type.toUpperCase()}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Severity:</div>
                    <div class="modal-value">
                        <span class="alert-badge ${alert.severity}" style="background: ${severityColors[alert.severity]}; color: white;">${alert.severity.toUpperCase()}</span>
                    </div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Status:</div>
                    <div class="modal-value">
                        <span class="alert-badge ${alert.status}">${alert.status}</span>
                    </div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Date:</div>
                    <div class="modal-value">${new Date(alert.date).toLocaleString()}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Description:</div>
                    <div class="modal-value">${escapeHtml(alert.description)}</div>
                </div>
                ${alert.status === 'new' ? `
                    <div class="modal-actions">
                        <button class="modal-btn acknowledge" onclick="updateAlertStatus('${alert.id}', 'acknowledged'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check"></i> Acknowledge
                        </button>
                        <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check-double"></i> Resolve
                        </button>
                        <button class="modal-btn ignore" onclick="updateAlertStatus('${alert.id}', 'ignored'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-times"></i> Ignore
                        </button>
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">
                            Cancel
                        </button>
                    </div>
                ` : alert.status === 'acknowledged' ? `
                    <div class="modal-actions">
                        <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check-double"></i> Mark Resolved
                        </button>
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">
                            Close
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
    
    // Close on overlay click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// ===========================================
// EXPORT FUNCTIONS
// ===========================================
function exportToCSV() {
    const headers = ['ID', 'Farm Name', 'Farm ID', 'Supplier', 'Cooperative', 'Type', 'Severity', 'Status', 'Description', 'Date'];
    const rows = filteredAlerts.map(alert => [
        alert.id,
        alert.farmerName,
        alert.farmerId,
        alert.supplier,
        alert.cooperative,
        alert.type,
        alert.severity,
        alert.status,
        alert.description,
        new Date(alert.date).toLocaleString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `quality_alerts_${new Date().toISOString().split('T')[0]}.csv`);
    showNotification('Exported to CSV', 'success');
}

function exportToJSON() {
    const data = filteredAlerts.map(alert => ({
        id: alert.id,
        farmName: alert.farmerName,
        farmId: alert.farmerId,
        supplier: alert.supplier,
        cooperative: alert.cooperative,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        description: alert.description,
        date: alert.date
    }));
    
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    saveAs(blob, `quality_alerts_${new Date().toISOString().split('T')[0]}.json`);
    showNotification('Exported to JSON', 'success');
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================
function getSeverityIcon(severity) {
    const icons = {
        critical: 'fa-skull-crossbones',
        high: 'fa-exclamation-triangle',
        medium: 'fa-exclamation',
        low: 'fa-info-circle'
    };
    return icons[severity] || 'fa-bell';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str
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
        top: 20px;
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

// ===========================================
// EVENT LISTENERS
// ===========================================
function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadFarmsAndGenerateAlerts());
    }
    
    // Apply filters
    const applyBtn = document.getElementById('applyFiltersBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => applyFilters());
    }
    
    // Clear filters
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('alertTypeFilter').value = 'all';
            document.getElementById('alertSeverityFilter').value = 'all';
            document.getElementById('alertSupplierFilter').value = 'all';
            document.getElementById('alertCoopFilter').value = 'all';
            document.getElementById('alertStatusFilter').value = 'all';
            document.getElementById('supplierSearch').value = '';
            document.getElementById('coopSearch').value = '';
            supplierSearchTerm = '';
            coopSearchTerm = '';
            updateSupplierFilter();
            updateCooperativeFilter();
            applyFilters();
        });
    }
    
    // Filter change listeners
    document.getElementById('alertTypeFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertSeverityFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertSupplierFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertCoopFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertStatusFilter')?.addEventListener('change', () => applyFilters());
    
    // Search listeners
    const supplierSearch = document.getElementById('supplierSearch');
    if (supplierSearch) {
        supplierSearch.addEventListener('input', (e) => {
            supplierSearchTerm = e.target.value.toLowerCase();
            updateSupplierFilter();
            applyFilters();
        });
    }
    
    const coopSearch = document.getElementById('coopSearch');
    if (coopSearch) {
        coopSearch.addEventListener('input', (e) => {
            coopSearchTerm = e.target.value.toLowerCase();
            updateCooperativeFilter();
            applyFilters();
        });
    }
    
    // Pagination
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderAlerts(); updatePagination(); } });
    
    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => { const total = Math.ceil(filteredAlerts.length / rowsPerPage); if (currentPage < total) { currentPage++; renderAlerts(); updatePagination(); } });
    
    // Export buttons
    document.getElementById('exportCSV')?.addEventListener('click', () => exportToCSV());
    document.getElementById('exportJSON')?.addEventListener('click', () => exportToJSON());
    
    // Mark all as acknowledged
    const markAllBtn = document.getElementById('markAllReadBtn');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', () => {
            if (confirm('Mark all new alerts as acknowledged?')) {
                allAlerts.forEach(alert => {
                    if (alert.status === 'new') alert.status = 'acknowledged';
                });
                applyFilters();
                showNotification('All alerts marked as acknowledged', 'success');
            }
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (window.supabase) await window.supabase.auth.signOut();
            localStorage.clear();
            window.location.href = '../login.html';
        });
    }
}

// ===========================================
// EXPOSE GLOBAL FUNCTIONS
// ===========================================
window.viewAlertDetails = viewAlertDetails;
window.updateAlertStatus = updateAlertStatus;
window.goToPage = goToPage;
window.applyFilters = applyFilters;
window.exportToCSV = exportToCSV;
window.exportToJSON = exportToJSON;

console.log('✅ Quality Alerts page ready');
