// ===========================================
// QUALITY ALERTS - RECEIVES ALERTS FROM DASHBOARD
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
    
    // Listen for alerts from dashboard
    window.addEventListener('alerts-updated', function(event) {
        console.log('📢 Received alerts-updated event');
        const newAlerts = event.detail?.alerts || window.globalAlertsData || [];
        updateAlerts(newAlerts);
    });
    
    // Also listen for alternative event name
    window.addEventListener('dashboard-alerts-updated', function(event) {
        console.log('📢 Received dashboard-alerts-updated event');
        const newAlerts = event.detail?.alerts || window.dashboardAlerts || [];
        updateAlerts(newAlerts);
    });
    
    // Check if alerts already exist
    checkForExistingAlerts();
    
    // Setup event listeners
    setupEventListeners();
});

function checkForExistingAlerts() {
    // Check multiple possible sources
    let alerts = null;
    
    if (window.globalAlertsData && window.globalAlertsData.length > 0) {
        alerts = window.globalAlertsData;
        console.log('✅ Found alerts in window.globalAlertsData');
    } else if (window.dashboardAlerts && window.dashboardAlerts.length > 0) {
        alerts = window.dashboardAlerts;
        console.log('✅ Found alerts in window.dashboardAlerts');
    } else if (window.alertsData && window.alertsData.length > 0) {
        alerts = window.alertsData;
        console.log('✅ Found alerts in window.alertsData');
    }
    
    if (alerts) {
        updateAlerts(alerts);
    } else {
        console.log('⏳ No alerts found yet, polling...');
        startPolling();
    }
}

function startPolling() {
    let pollCount = 0;
    const pollInterval = setInterval(() => {
        pollCount++;
        
        let alerts = null;
        if (window.globalAlertsData && window.globalAlertsData.length > 0) {
            alerts = window.globalAlertsData;
        } else if (window.dashboardAlerts && window.dashboardAlerts.length > 0) {
            alerts = window.dashboardAlerts;
        } else if (window.alertsData && window.alertsData.length > 0) {
            alerts = window.alertsData;
        }
        
        if (alerts) {
            console.log('✅ Alerts found after polling');
            updateAlerts(alerts);
            clearInterval(pollInterval);
        } else if (pollCount > 15) {
            console.log('⚠️ No alerts found after 30 seconds, loading sample data');
            loadSampleAlerts();
            clearInterval(pollInterval);
        }
    }, 2000);
}

// ===========================================
// UPDATE ALERTS FROM DASHBOARD
// ===========================================

function updateAlerts(dashboardAlerts) {
    if (!dashboardAlerts || dashboardAlerts.length === 0) {
        console.log('No alerts from dashboard, using sample data');
        loadSampleAlerts();
        return;
    }
    
    console.log(`✅ Received ${dashboardAlerts.length} alerts from dashboard`);
    
    // Transform dashboard alerts to our format
    allAlerts = dashboardAlerts.map(alert => ({
        id: alert.id,
        farmId: alert.farm_id || alert.farmId,
        farmerName: alert.farmer_name || alert.farmerName || 'Unknown',
        farmerId: alert.farm_id || alert.farmId,
        cooperative: alert.cooperative || 'Unassigned',
        supplier: alert.supplier || 'Unknown',
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description || alert.message,
        status: alert.status || 'new',
        date: alert.date,
        affectedFarmName: alert.affected_farm_name || alert.affectedFarmerName,
        overlapArea: alert.overlapArea || alert.overlap_area,
        overlapPercent: alert.overlap_percent,
        selfIntersectionCount: alert.self_intersection_count || alert.selfIntersectionCount,
        farms: alert.farms
    }));
    
    // Update filter options
    updateFilterOptions();
    
    // Apply filters and render
    applyFilters();
    
    // Update notification badge
    const newAlerts = allAlerts.filter(a => a.status === 'new').length;
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.textContent = newAlerts;
        badge.style.display = newAlerts > 0 ? 'flex' : 'none';
    }
    
    // Show notification
    if (allAlerts.length > 0) {
        showNotification(`${allAlerts.length} quality alerts found`, 'warning');
    } else {
        showNotification('No quality alerts', 'success');
    }
}

// ===========================================
// SAMPLE ALERTS (Fallback)
// ===========================================
function loadSampleAlerts() {
    console.log('📊 Loading sample alerts');
    
    allAlerts = [
        {
            id: 'sample-1',
            farmId: 'F12345',
            farmerName: 'Koffi Jean',
            farmerId: 'F12345',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            type: 'overlap',
            severity: 'critical',
            title: 'CRITICAL Overlap: 6.2ha',
            description: 'Farm "Koffi Jean" overlaps with farm "Konan Marie". Overlap area: 6.2 ha (42% of smaller farm).',
            status: 'new',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            overlapArea: 6.2,
            overlapPercent: 42,
            affectedFarmName: 'Konan Marie'
        },
        {
            id: 'sample-2',
            farmId: 'F12346',
            farmerName: 'Konan Marie',
            farmerId: 'F12346',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            type: 'self-intersection',
            severity: 'high',
            title: 'HIGH Self-Intersection: 3.2ha (3 points)',
            description: 'Self-intersecting polygon detected with 3 intersection point(s). Area affected: 3.2 ha.',
            status: 'new',
            date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            selfIntersectionCount: 3
        },
        {
            id: 'sample-3',
            farmId: 'F12347',
            farmerName: 'N\'Guessan Paul',
            farmerId: 'F12347',
            cooperative: 'COOP-CI',
            supplier: 'Other',
            type: 'self-intersection',
            severity: 'medium',
            title: 'MEDIUM Self-Intersection: 1.8ha (2 points)',
            description: 'Self-intersecting polygon detected with 2 intersection point(s).',
            status: 'acknowledged',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            selfIntersectionCount: 2
        },
        {
            id: 'sample-4',
            farmId: 'F12348',
            farmerName: 'Yao Michel',
            farmerId: 'F12348',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            type: 'data',
            severity: 'high',
            title: 'Missing Geometry Data',
            description: 'Farm has no geometry data. Cannot display on map or calculate area.',
            status: 'new',
            date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'sample-5',
            farmId: 'F12349',
            farmerName: 'Traore Amadou',
            farmerId: 'F12349',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            type: 'overlap',
            severity: 'low',
            title: 'LOW Overlap: 0.8ha',
            description: 'Small overlap with adjacent farm: 0.8 ha (5% of smaller farm).',
            status: 'resolved',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            overlapArea: 0.8,
            overlapPercent: 5,
            affectedFarmName: 'Adjacent Farm'
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
    
    // Sort by severity and date
    filteredAlerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.date) - new Date(a.date);
    });
    
    updateStats();
    
    const exportCount = document.getElementById('exportCount');
    if (exportCount) exportCount.textContent = `${filteredAlerts.length} alerts`;
    
    currentPage = 1;
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
                <p style="color: #64748b;">All farms meet quality standards. No alerts found.</p>
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
                <p><strong>Farm:</strong> ${escapeHtml(alert.farmerName)}${alert.affectedFarmName ? ` & ${escapeHtml(alert.affectedFarmName)}` : ''}</p>
                <p><strong>Supplier:</strong> ${escapeHtml(alert.supplier)} • <strong>Cooperative:</strong> ${escapeHtml(alert.cooperative)}</p>
                ${alert.overlapArea ? `<p><strong>Overlap Area:</strong> ${alert.overlapArea} ha (${alert.overlapPercent}%)</p>` : ''}
                ${alert.selfIntersectionCount ? `<p><strong>Self-Intersection Points:</strong> ${alert.selfIntersectionCount}</p>` : ''}
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
        
        // Also update in global alerts if available
        if (window.globalAlertsData) {
            const globalAlert = window.globalAlertsData.find(a => a.id === alertId);
            if (globalAlert) globalAlert.status = newStatus;
        }
        if (window.dashboardAlerts) {
            const dashboardAlert = window.dashboardAlerts.find(a => a.id === alertId);
            if (dashboardAlert) dashboardAlert.status = newStatus;
        }
        
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
            <div class="modal-header" style="background: ${severityColors[alert.severity]};">
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
                    <div class="modal-value">${escapeHtml(alert.farmerName)}</div>
                </div>
                ${alert.affectedFarmName ? `
                <div class="modal-row">
                    <div class="modal-label">Affected Farm:</div>
                    <div class="modal-value">${escapeHtml(alert.affectedFarmName)}</div>
                </div>
                ` : ''}
                <div class="modal-row">
                    <div class="modal-label">Supplier:</div>
                    <div class="modal-value">${escapeHtml(alert.supplier)}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Cooperative:</div>
                    <div class="modal-value">${escapeHtml(alert.cooperative)}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Type:</div>
                    <div class="modal-value">${alert.type.replace('_', ' ').toUpperCase()}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Severity:</div>
                    <div class="modal-value">${alert.severity.toUpperCase()}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Status:</div>
                    <div class="modal-value">${alert.status.toUpperCase()}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Date:</div>
                    <div class="modal-value">${new Date(alert.date).toLocaleString()}</div>
                </div>
                ${alert.overlapArea ? `
                <div class="modal-row">
                    <div class="modal-label">Overlap Area:</div>
                    <div class="modal-value">${alert.overlapArea} ha (${alert.overlapPercent}%)</div>
                </div>
                ` : ''}
                ${alert.selfIntersectionCount ? `
                <div class="modal-row">
                    <div class="modal-label">Intersection Points:</div>
                    <div class="modal-value">${alert.selfIntersectionCount}</div>
                </div>
                ` : ''}
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
    const headers = ['ID', 'Farm Name', 'Supplier', 'Cooperative', 'Type', 'Severity', 'Status', 'Description', 'Date'];
    const rows = filteredAlerts.map(alert => [
        alert.id,
        alert.farmerName,
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
        supplier: alert.supplier,
        cooperative: alert.cooperative,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        description: alert.description,
        date: alert.date,
        ...(alert.overlapArea && { overlapArea: alert.overlapArea }),
        ...(alert.overlapPercent && { overlapPercent: alert.overlapPercent }),
        ...(alert.selfIntersectionCount && { selfIntersectionCount: alert.selfIntersectionCount })
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
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        showNotification('Refreshing alerts...', 'info');
        checkForExistingAlerts();
    });
    
    document.getElementById('applyFiltersBtn')?.addEventListener('click', () => applyFilters());
    
    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
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
    
    document.getElementById('alertTypeFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertSeverityFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertSupplierFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertCoopFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertStatusFilter')?.addEventListener('change', () => applyFilters());
    
    document.getElementById('supplierSearch')?.addEventListener('input', (e) => {
        supplierSearchTerm = e.target.value.toLowerCase();
        updateSupplierFilter();
        applyFilters();
    });
    
    document.getElementById('coopSearch')?.addEventListener('input', (e) => {
        coopSearchTerm = e.target.value.toLowerCase();
        updateCooperativeFilter();
        applyFilters();
    });
    
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderAlerts(); updatePagination(); }
    });
    
    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        const total = Math.ceil(filteredAlerts.length / rowsPerPage);
        if (currentPage < total) { currentPage++; renderAlerts(); updatePagination(); }
    });
    
    document.getElementById('exportCSV')?.addEventListener('click', () => exportToCSV());
    document.getElementById('exportJSON')?.addEventListener('click', () => exportToJSON());
    
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        if (confirm('Mark all new alerts as acknowledged?')) {
            allAlerts.forEach(alert => {
                if (alert.status === 'new') alert.status = 'acknowledged';
            });
            if (window.globalAlertsData) {
                window.globalAlertsData.forEach(alert => {
                    if (alert.status === 'new') alert.status = 'acknowledged';
                });
            }
            applyFilters();
            showNotification('All alerts marked as acknowledged', 'success');
        }
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (window.supabase) await window.supabase.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
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

console.log('✅ Quality Alerts page ready - listening for dashboard alerts');
