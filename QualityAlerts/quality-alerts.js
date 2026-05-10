// ===========================================
// QUALITY ALERTS - DIRECT SUPABASE INTEGRATION
// Matches Dashboard layout and functionality
// ===========================================

console.log('🚀 Quality Alerts page loading...');

// Global variables
let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let rowsPerPage = 10;
let allFarms = [];
let currentMap = null;
let supabaseClient = null;

const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 Quality Alerts DOM loaded');
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
    console.log('🔧 Initializing Supabase for Quality Alerts...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 15) {
            setTimeout(() => initSupabase(retryCount + 1), 500);
            return;
        }
        console.error('❌ Supabase library failed to load');
        return;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabase = supabaseClient;
        console.log('✅ Supabase client created');
        checkSessionAndLoad();
    } catch (error) {
        console.error('❌ Supabase init error:', error);
    }
}

async function checkSessionAndLoad() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) throw error;
        
        if (!session) {
            console.log('⚠️ No active session, redirecting to login');
            setTimeout(() => window.location.href = '../login.html', 2000);
            return;
        }
        
        console.log('👤 User logged in:', session.user.email);
        await loadFarmsDirectly();
        
    } catch (error) {
        console.error('Session error:', error);
    }
}

// ===========================================
// LOAD FARMS DIRECTLY FROM SUPABASE
// ===========================================

async function loadFarmsDirectly() {
    console.log('📡 Loading farms from Supabase...');
    
    const alertsList = document.getElementById('alertsList');
    if (alertsList) {
        alertsList.innerHTML = `
            <div style="text-align:center;padding:60px;">
                <i class="fas fa-spinner fa-spin" style="font-size:48px;color:#2c6e49;"></i>
                <p style="margin-top:15px;">Loading farms from database...</p>
            </div>
        `;
    }
    
    try {
        const { data: farms, error } = await supabaseClient
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
                geometry: farm.geometry
            }));
            
            generateAlertsFromFarms();
            updateFilterOptions();
            applyFilters();
            
            const alertCount = allAlerts.length;
            showNotification(`Loaded ${allFarms.length} farms, found ${alertCount} alerts`, 
                           alertCount > 0 ? 'warning' : 'success');
            
            const badge = document.getElementById('notificationBadge');
            if (badge) badge.style.display = alertCount > 0 ? 'flex' : 'none';
            
        } else {
            alertsList.innerHTML = `
                <div style="text-align:center;padding:60px;">
                    <i class="fas fa-check-circle" style="font-size:48px;color:#22c55e;"></i>
                    <h3>No Farms Found</h3>
                    <p style="color:#64748b;">No farms have been submitted yet.</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading farms:', error);
        alertsList.innerHTML = `
            <div style="text-align:center;padding:60px;">
                <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#dc2626;"></i>
                <h3>Error Loading Data</h3>
                <p style="color:#64748b;">${error.message}</p>
                <button onclick="location.reload()" style="margin-top:15px;padding:8px 16px;background:#2c6e49;color:white;border:none;border-radius:6px;cursor:pointer;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// ===========================================
// GENERATE ALERTS
// ===========================================

function generateAlertsFromFarms() {
    console.log('🔍 Generating alerts...');
    const alerts = [];
    
    const farmsWithGeo = allFarms.filter(f => f.geometry && f.geometry.coordinates);
    console.log(`📐 Farms with geometry: ${farmsWithGeo.length}`);
    
    // Detect overlaps
    for (let i = 0; i < farmsWithGeo.length; i++) {
        for (let j = i + 1; j < farmsWithGeo.length; j++) {
            const farm1 = farmsWithGeo[i];
            const farm2 = farmsWithGeo[j];
            
            try {
                const poly1 = turf.polygon(farm1.geometry.coordinates);
                const poly2 = turf.polygon(farm2.geometry.coordinates);
                
                if (turf.booleanIntersects(poly1, poly2)) {
                    const intersection = turf.intersect(poly1, poly2);
                    if (intersection) {
                        const overlapArea = turf.area(intersection) / 10000;
                        if (overlapArea > 0.01) {
                            const area1 = turf.area(poly1) / 10000;
                            const area2 = turf.area(poly2) / 10000;
                            const percent = Math.round((overlapArea / Math.min(area1, area2)) * 100);
                            
                            let severity = 'low';
                            if (overlapArea > 5) severity = 'critical';
                            else if (overlapArea >= 3) severity = 'high';
                            else if (overlapArea > 1) severity = 'medium';
                            
                            alerts.push({
                                id: `overlap_${farm1.id}_${farm2.id}`,
                                farmId: farm1.farmer_id,
                                farmerName: farm1.farmer_name,
                                farmData: farm1,
                                affectedFarmName: farm2.farmer_name,
                                affectedFarmData: farm2,
                                cooperative: farm1.cooperative,
                                supplier: farm1.supplier,
                                type: 'overlap',
                                severity: severity,
                                title: `${severity.toUpperCase()} Overlap: ${overlapArea.toFixed(1)}ha`,
                                description: `Farm "${farm1.farmer_name}" overlaps with "${farm2.farmer_name}". Overlap area: ${overlapArea.toFixed(2)} ha (${percent}% of smaller farm).`,
                                status: 'new',
                                date: new Date().toISOString(),
                                overlapArea: overlapArea,
                                overlapPercent: percent
                            });
                        }
                    }
                }
            } catch(e) {}
        }
    }
    
    // Check for missing geometry
    allFarms.forEach(farm => {
        if (!farm.geometry && farm.status !== 'rejected') {
            alerts.push({
                id: `missing_geom_${farm.id}`,
                farmId: farm.farmer_id,
                farmerName: farm.farmer_name,
                farmData: farm,
                cooperative: farm.cooperative,
                supplier: farm.supplier,
                type: 'data',
                severity: 'high',
                title: 'Missing Geometry Data',
                description: `Farm has no geometry data. Cannot display on map.`,
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    allAlerts = alerts;
    console.log(`✅ Generated ${alerts.length} alerts`);
}

function updateFilterOptions() {
    const suppliers = [...new Set(allAlerts.map(a => a.supplier || 'Unknown'))];
    const cooperatives = [...new Set(allAlerts.map(a => a.cooperative || 'Unknown'))];
    
    const supplierSelect = document.getElementById('alertSupplierFilter');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="all">All Suppliers</option>' + 
            suppliers.map(s => `<option value="${s}">${escapeHtml(s)}</option>`).join('');
    }
    
    const coopSelect = document.getElementById('alertCoopFilter');
    if (coopSelect) {
        coopSelect.innerHTML = '<option value="all">All Cooperatives</option>' + 
            cooperatives.map(c => `<option value="${c}">${escapeHtml(c)}</option>`).join('');
    }
}

function applyFilters() {
    const type = document.getElementById('alertTypeFilter')?.value || 'all';
    const severity = document.getElementById('alertSeverityFilter')?.value || 'all';
    const supplier = document.getElementById('alertSupplierFilter')?.value || 'all';
    const cooperative = document.getElementById('alertCoopFilter')?.value || 'all';
    const status = document.getElementById('alertStatusFilter')?.value || 'all';
    
    filteredAlerts = allAlerts.filter(alert => {
        if (type !== 'all' && alert.type !== type) return false;
        if (severity !== 'all' && alert.severity !== severity) return false;
        if (supplier !== 'all' && (alert.supplier || 'Unknown') !== supplier) return false;
        if (cooperative !== 'all' && (alert.cooperative || 'Unknown') !== cooperative) return false;
        if (status !== 'all' && alert.status !== status) return false;
        return true;
    });
    
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    filteredAlerts.sort((a, b) => {
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.date) - new Date(a.date);
    });
    
    updateStats();
    currentPage = 1;
    renderAlerts();
    updatePagination();
}

function updateStats() {
    document.getElementById('criticalCount').textContent = filteredAlerts.filter(a => a.severity === 'critical').length;
    document.getElementById('highCount').textContent = filteredAlerts.filter(a => a.severity === 'high').length;
    document.getElementById('mediumCount').textContent = filteredAlerts.filter(a => a.severity === 'medium').length;
    document.getElementById('lowCount').textContent = filteredAlerts.filter(a => a.severity === 'low').length;
    document.getElementById('totalAlerts').textContent = filteredAlerts.length;
}

function renderAlerts() {
    const container = document.getElementById('alertsList');
    if (!container) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredAlerts.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:60px;">
                <i class="fas fa-check-circle" style="font-size:48px;color:#22c55e;"></i>
                <h3>No Quality Alerts</h3>
                <p style="color:#64748b;">All farms meet quality standards.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pageData.map(alert => `
        <div class="alert-item ${alert.status}" onclick="viewAlertOnMap('${alert.id}')">
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
                <p><strong>Farm:</strong> ${escapeHtml(alert.farmerName)}${alert.affectedFarmName ? ` ↔ ${escapeHtml(alert.affectedFarmName)}` : ''}</p>
                <p><strong>Supplier:</strong> ${escapeHtml(alert.supplier || 'N/A')} • <strong>Cooperative:</strong> ${escapeHtml(alert.cooperative || 'N/A')}</p>
                <p>${escapeHtml(alert.description.substring(0, 150))}${alert.description.length > 150 ? '...' : ''}</p>
            </div>
            <div class="alert-actions">
                <button class="alert-action-btn view-map" onclick="event.stopPropagation(); viewAlertOnMap('${alert.id}')">
                    <i class="fas fa-map-marker-alt"></i> View on Map
                </button>
                ${alert.status === 'new' ? `
                    <button class="alert-action-btn acknowledge" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'acknowledged')">
                        <i class="fas fa-check"></i> Acknowledge
                    </button>
                    <button class="alert-action-btn resolve" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'resolved')">
                        <i class="fas fa-check-double"></i> Resolve
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updatePagination() {
    const totalPages = Math.ceil(filteredAlerts.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages || totalPages === 0;
}

// ===========================================
// MAP VIEW FUNCTIONS
// ===========================================

function viewAlertOnMap(alertId) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    if (alert.type === 'overlap' && alert.farmData && alert.affectedFarmData) {
        showOverlapMapModal(alert);
    } else if (alert.farmData && alert.farmData.geometry) {
        showSingleFarmMapModal(alert);
    } else {
        showNotification('No map data available for this alert', 'warning');
    }
}

function convertToLeafletCoords(coords) {
    if (!coords || !Array.isArray(coords)) return coords;
    if (coords.length === 2 && typeof coords[0] === 'number') {
        return [coords[1], coords[0]];
    }
    return coords.map(item => convertToLeafletCoords(item));
}

function showOverlapMapModal(alert) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const severityColors = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header" style="background: linear-gradient(135deg, ${severityColors[alert.severity]}, #7f1d1d);">
                <h3><i class="fas fa-exclamation-triangle"></i> Overlap Analysis</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Severity:</div><div class="modal-value"><span class="alert-badge-large ${alert.severity}">${alert.severity.toUpperCase()}</span></div></div>
                        <div class="modal-row"><div class="modal-label">Overlap Area:</div><div class="modal-value">${alert.overlapArea?.toFixed(2) || 'N/A'} ha</div></div>
                        <div class="modal-row"><div class="modal-label">Overlap %:</div><div class="modal-value">${alert.overlapPercent || 'N/A'}%</div></div>
                    </div>
                </div>
                
                <div class="two-farm-layout">
                    <div class="farm-card">
                        <h4><i class="fas fa-tractor"></i> Farm 1: ${escapeHtml(alert.farmerName)}</h4>
                        <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(alert.farmData?.cooperative || 'N/A')}</div></div>
                        <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(alert.farmData?.supplier || 'N/A')}</div></div>
                        <div class="modal-row"><div class="modal-label">Area:</div><div class="modal-value">${alert.farmData?.area?.toFixed(2) || 'N/A'} ha</div></div>
                    </div>
                    <div class="farm-card">
                        <h4><i class="fas fa-tractor"></i> Farm 2: ${escapeHtml(alert.affectedFarmName)}</h4>
                        <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(alert.affectedFarmData?.cooperative || 'N/A')}</div></div>
                        <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(alert.affectedFarmData?.supplier || 'N/A')}</div></div>
                        <div class="modal-row"><div class="modal-label">Area:</div><div class="modal-value">${alert.affectedFarmData?.area?.toFixed(2) || 'N/A'} ha</div></div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <div id="alertMap"></div>
                    <div class="map-info">
                        <i class="fas fa-info-circle"></i> 
                        <strong>Decision Support:</strong> The red overlay shows the conflicting area. Use satellite imagery to verify boundaries.
                    </div>
                </div>
                
                <div class="modal-actions">
                    ${alert.status === 'new' ? `
                        <button class="modal-btn acknowledge" onclick="updateAlertStatus('${alert.id}', 'acknowledged'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check"></i> Acknowledge
                        </button>
                        <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check-double"></i> Resolve
                        </button>
                    ` : ''}
                    <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => initOverlapMap(alert), 100);
}

function initOverlapMap(alert) {
    const mapContainer = document.getElementById('alertMap');
    if (!mapContainer) return;
    
    if (currentMap) currentMap.remove();
    
    const farm1Geo = alert.farmData?.geometry;
    const farm2Geo = alert.affectedFarmData?.geometry;
    let bounds = null;
    
    currentMap = L.map('alertMap', { attributionControl: false }).setView([7.539989, -5.547080], 7);
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(currentMap);
    
    if (farm1Geo?.coordinates) {
        const poly = L.polygon(convertToLeafletCoords(farm1Geo.coordinates), {
            color: '#22c55e', weight: 3, fillColor: '#22c55e', fillOpacity: 0.3
        }).addTo(currentMap);
        if (poly.getBounds?.isValid()) bounds = bounds ? bounds.extend(poly.getBounds()) : poly.getBounds();
    }
    
    if (farm2Geo?.coordinates) {
        const poly = L.polygon(convertToLeafletCoords(farm2Geo.coordinates), {
            color: '#f97316', weight: 3, fillColor: '#f97316', fillOpacity: 0.3
        }).addTo(currentMap);
        if (poly.getBounds?.isValid()) bounds = bounds ? bounds.extend(poly.getBounds()) : poly.getBounds();
    }
    
    if (farm1Geo?.coordinates && farm2Geo?.coordinates) {
        try {
            const intersection = turf.intersect(turf.polygon(farm1Geo.coordinates), turf.polygon(farm2Geo.coordinates));
            if (intersection) {
                L.polygon(convertToLeafletCoords(intersection.geometry.coordinates), {
                    color: '#dc2626', weight: 4, fillColor: '#dc2626', fillOpacity: 0.5
                }).addTo(currentMap);
            }
        } catch(e) {}
    }
    
    if (bounds?.isValid()) currentMap.fitBounds(bounds, { padding: [50, 50] });
}

function showSingleFarmMapModal(alert) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-map-marker-alt"></i> Farm Location - ${escapeHtml(alert.farmerName)}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div id="alertMap"></div>
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => {
        if (currentMap) currentMap.remove();
        currentMap = L.map('alertMap', { attributionControl: false }).setView([7.539989, -5.547080], 7);
        L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(currentMap);
        if (alert.farmData?.geometry?.coordinates) {
            const poly = L.polygon(convertToLeafletCoords(alert.farmData.geometry.coordinates), {
                color: '#f97316', weight: 3, fillColor: '#f97316', fillOpacity: 0.3
            }).addTo(currentMap);
            if (poly.getBounds?.isValid()) currentMap.fitBounds(poly.getBounds());
        }
    }, 100);
}

function updateAlertStatus(alertId, newStatus) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (alert) {
        alert.status = newStatus;
        applyFilters();
        showNotification(`Alert marked as ${newStatus}`, 'success');
    }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function getSeverityIcon(severity) {
    const icons = { critical: 'fa-skull-crossbones', high: 'fa-exclamation-triangle', medium: 'fa-exclamation', low: 'fa-info-circle' };
    return icons[severity] || 'fa-bell';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const hours = Math.floor((new Date() - date) / 3600000);
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
}

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
    document.getElementById('applyFiltersBtn')?.addEventListener('click', () => applyFilters());
    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        document.getElementById('alertTypeFilter').value = 'all';
        document.getElementById('alertSeverityFilter').value = 'all';
        document.getElementById('alertSupplierFilter').value = 'all';
        document.getElementById('alertCoopFilter').value = 'all';
        document.getElementById('alertStatusFilter').value = 'all';
        applyFilters();
    });
    document.getElementById('alertTypeFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertSeverityFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertSupplierFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertCoopFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('alertStatusFilter')?.addEventListener('change', () => applyFilters());
    document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderAlerts(); updatePagination(); } });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => { const total = Math.ceil(filteredAlerts.length / rowsPerPage); if (currentPage < total) { currentPage++; renderAlerts(); updatePagination(); } });
    document.getElementById('refreshBtn')?.addEventListener('click', () => loadFarmsDirectly());
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        if (confirm('Mark all new alerts as acknowledged?')) {
            allAlerts.forEach(a => { if (a.status === 'new') a.status = 'acknowledged'; });
            applyFilters();
            showNotification('All alerts marked as acknowledged', 'success');
        }
    });
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (supabaseClient) await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

// Make functions global
window.viewAlertOnMap = viewAlertOnMap;
window.updateAlertStatus = updateAlertStatus;

console.log('✅ Quality Alerts page ready');
