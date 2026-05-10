// ===========================================
// QUALITY ALERTS WITH MAP VIEW
// ===========================================

console.log('🚀 Quality Alerts page loading with map support...');

let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let rowsPerPage = 10;
let allFarms = [];
let currentMap = null;

const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

document.addEventListener('DOMContentLoaded', function() {
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
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 10) {
            setTimeout(() => initSupabase(retryCount + 1), 500);
            return;
        }
        loadSampleAlerts();
        return;
    }
    
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    loadFarmsAndGenerateAlerts();
}

async function loadFarmsAndGenerateAlerts() {
    try {
        const { data: farms, error } = await window.supabaseClient.from('farms').select('*');
        if (error) throw error;
        
        if (farms && farms.length > 0) {
            allFarms = farms;
            generateAlertsFromFarms(farms);
        } else {
            loadSampleAlerts();
        }
    } catch (error) {
        console.error('Error:', error);
        loadSampleAlerts();
    }
}

function convertToLeafletCoords(coords) {
    if (!coords || !Array.isArray(coords)) return coords;
    if (coords.length === 2 && typeof coords[0] === 'number') {
        return [coords[1], coords[0]];
    }
    return coords.map(item => convertToLeafletCoords(item));
}

function generateAlertsFromFarms(farms) {
    const alerts = [];
    
    // Convert geometry coordinates for Leaflet
    farms.forEach(farm => {
        if (farm.geometry && farm.geometry.coordinates) {
            farm._leafletCoords = convertToLeafletCoords(farm.geometry.coordinates);
        }
    });
    
    // Detect overlaps
    for (let i = 0; i < farms.length; i++) {
        for (let j = i + 1; j < farms.length; j++) {
            const farm1 = farms[i];
            const farm2 = farms[j];
            
            if (farm1.geometry && farm2.geometry) {
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
                                const smallerArea = Math.min(area1, area2);
                                const overlapPercent = Math.round((overlapArea / smallerArea) * 100);
                                
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
                                    type: 'overlap',
                                    severity: severity,
                                    title: `${severity.toUpperCase()} Overlap: ${overlapArea.toFixed(1)}ha`,
                                    description: `Farm "${farm1.farmer_name}" overlaps with "${farm2.farmer_name}". Overlap area: ${overlapArea.toFixed(2)} ha (${overlapPercent}% of smaller farm).`,
                                    status: 'new',
                                    date: new Date().toISOString(),
                                    overlapArea: overlapArea,
                                    overlapPercent: overlapPercent
                                });
                            }
                        }
                    }
                } catch(e) {}
            }
        }
    }
    
    // Self-intersection alerts
    farms.forEach(farm => {
        if (farm.geometry) {
            try {
                const polygon = turf.polygon(farm.geometry.coordinates);
                if (!turf.booleanValid(polygon)) {
                    alerts.push({
                        id: `self_${farm.id}`,
                        farmId: farm.farmer_id,
                        farmerName: farm.farmer_name,
                        farmData: farm,
                        type: 'self-intersection',
                        severity: 'high',
                        title: `Self-Intersection Detected`,
                        description: `Self-intersecting polygon detected. This farm boundary crosses itself.`,
                        status: 'new',
                        date: new Date().toISOString()
                    });
                }
            } catch(e) {}
        }
    });
    
    // Missing geometry alerts
    farms.forEach(farm => {
        if (!farm.geometry && farm.status !== 'rejected') {
            alerts.push({
                id: `missing_geom_${farm.id}`,
                farmId: farm.farmer_id,
                farmerName: farm.farmer_name,
                farmData: farm,
                type: 'data',
                severity: 'high',
                title: 'Missing Geometry Data',
                description: `Farm has no geometry data. Cannot display on map or calculate area.`,
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    allAlerts = alerts;
    updateFilterOptions();
    applyFilters();
    showNotification(`Found ${alerts.length} quality alerts`, alerts.length > 0 ? 'warning' : 'success');
}

function loadSampleAlerts() {
    allAlerts = [
        { id: 'sample-1', farmId: 'F12345', farmerName: 'Koffi Jean', farmData: null, affectedFarmName: 'Konan Marie', affectedFarmData: null, type: 'overlap', severity: 'critical', title: 'CRITICAL Overlap: 6.2ha', description: 'Farm "Koffi Jean" overlaps with "Konan Marie". Overlap area: 6.2 ha (42% of smaller farm).', status: 'new', date: new Date().toISOString(), overlapArea: 6.2, overlapPercent: 42 },
        { id: 'sample-2', farmId: 'F12346', farmerName: 'Konan Marie', farmData: null, type: 'self-intersection', severity: 'high', title: 'Self-Intersection Detected', description: 'Self-intersecting polygon detected.', status: 'new', date: new Date().toISOString() },
        { id: 'sample-3', farmId: 'F12347', farmerName: 'N\'Guessan Paul', farmData: null, type: 'data', severity: 'high', title: 'Missing Geometry Data', description: 'Farm has no geometry data.', status: 'new', date: new Date().toISOString() }
    ];
    updateFilterOptions();
    applyFilters();
}

function updateFilterOptions() {
    const suppliers = [...new Set(allAlerts.map(a => a.supplier || 'Unknown'))];
    const cooperatives = [...new Set(allAlerts.map(a => a.cooperative || 'Unknown'))];
    
    const supplierSelect = document.getElementById('alertSupplierFilter');
    supplierSelect.innerHTML = '<option value="all">All Suppliers</option>' + suppliers.map(s => `<option value="${s}">${s}</option>`).join('');
    
    const coopSelect = document.getElementById('alertCoopFilter');
    coopSelect.innerHTML = '<option value="all">All Cooperatives</option>' + cooperatives.map(c => `<option value="${c}">${c}</option>`).join('');
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
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredAlerts.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:60px;"><i class="fas fa-check-circle" style="font-size:48px;color:#22c55e;"></i><h3>No Quality Alerts</h3></div>`;
        return;
    }
    
    container.innerHTML = pageData.map(alert => `
        <div class="alert-item ${alert.status}" onclick="viewAlertOnMap('${alert.id}')">
            <div class="alert-header">
                <div class="alert-severity ${alert.severity}"><i class="fas ${getSeverityIcon(alert.severity)}"></i></div>
                <div class="alert-title">${escapeHtml(alert.title)}<span class="alert-badge ${alert.status}">${alert.status}</span></div>
                <div class="alert-date">${formatDate(alert.date)}</div>
            </div>
            <div class="alert-details">
                <p><strong>Farm:</strong> ${escapeHtml(alert.farmerName)}${alert.affectedFarmName ? ` ↔ ${escapeHtml(alert.affectedFarmName)}` : ''}</p>
                <p>${escapeHtml(alert.description.substring(0, 150))}${alert.description.length > 150 ? '...' : ''}</p>
            </div>
            <div class="alert-actions">
                <button class="alert-action-btn view-map" onclick="event.stopPropagation(); viewAlertOnMap('${alert.id}')">
                    <i class="fas fa-map-marker-alt"></i> View on Map
                </button>
                ${alert.status === 'new' ? `
                    <button class="alert-action-btn acknowledge" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'acknowledged')"><i class="fas fa-check"></i> Acknowledge</button>
                    <button class="alert-action-btn resolve" onclick="event.stopPropagation(); updateAlertStatus('${alert.id}', 'resolved')"><i class="fas fa-check-double"></i> Resolve</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// ===========================================
// MAP VIEW FUNCTIONS
// ===========================================

function viewAlertOnMap(alertId) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    if (alert.type === 'overlap' && (alert.farmData || alert.affectedFarmData)) {
        showOverlapMapModal(alert);
    } else if (alert.farmData) {
        showSingleFarmMapModal(alert);
    } else {
        showAlertInfoModal(alert);
    }
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
                <h3><i class="fas fa-exclamation-triangle"></i> Overlap Analysis - Farm Boundary Conflict</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-chart-line"></i> Alert Summary</div>
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Severity:</div><div class="modal-value"><span class="alert-badge-large ${alert.severity}">${alert.severity.toUpperCase()}</span></div></div>
                        <div class="modal-row"><div class="modal-label">Status:</div><div class="modal-value">${alert.status.toUpperCase()}</div></div>
                        <div class="modal-row"><div class="modal-label">Overlap Area:</div><div class="modal-value">${alert.overlapArea?.toFixed(2) || 'N/A'} hectares</div></div>
                        <div class="modal-row"><div class="modal-label">Overlap %:</div><div class="modal-value">${alert.overlapPercent || 'N/A'}% of smaller farm</div></div>
                    </div>
                </div>
                
                <div class="two-farm-layout">
                    <div class="farm-card">
                        <h4><i class="fas fa-tractor"></i> Farm 1: ${escapeHtml(alert.farmerName)}</h4>
                        <div class="modal-row"><div class="modal-label">Farm ID:</div><div class="modal-value">${escapeHtml(alert.farmId)}</div></div>
                        <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(alert.farmData?.cooperative || alert.cooperative || 'N/A')}</div></div>
                        <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(alert.farmData?.supplier || alert.supplier || 'N/A')}</div></div>
                    </div>
                    <div class="farm-card">
                        <h4><i class="fas fa-tractor"></i> Farm 2: ${escapeHtml(alert.affectedFarmName)}</h4>
                        <div class="modal-row"><div class="modal-label">Farm ID:</div><div class="modal-value">${escapeHtml(alert.affectedFarmData?.farmer_id || 'N/A')}</div></div>
                        <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(alert.affectedFarmData?.cooperative || 'N/A')}</div></div>
                        <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(alert.affectedFarmData?.supplier || 'N/A')}</div></div>
                    </div>
                </div>
                
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-map-marked-alt"></i> Farm Location Map (Satellite View)</div>
                    <div id="alertMap"></div>
                    <div class="map-info">
                        <i class="fas fa-info-circle"></i> 
                        <strong>Decision Support:</strong> The red overlay shows the conflicting area. Use satellite imagery to verify boundaries, 
                        identify which farm has correct mapping, and determine resolution.
                    </div>
                </div>
                
                <div class="modal-actions">
                    ${alert.status === 'new' ? `
                        <button class="modal-btn acknowledge" onclick="updateAlertStatus('${alert.id}', 'acknowledged'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check"></i> Acknowledge & Review
                        </button>
                        <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check-double"></i> Mark Resolved
                        </button>
                    ` : ''}
                    <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close Map</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        initOverlapMap(alert);
    }, 100);
    
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function initOverlapMap(alert) {
    const mapContainer = document.getElementById('alertMap');
    if (!mapContainer) return;
    
    if (currentMap) currentMap.remove();
    
    const farm1Geo = alert.farmData?.geometry;
    const farm2Geo = alert.affectedFarmData?.geometry;
    
    let bounds = null;
    
    currentMap = L.map('alertMap', { attributionControl: false }).setView([6.5, -2.5], 7);
    
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(currentMap);
    
    // Draw Farm 1 (Green)
    if (farm1Geo?.coordinates) {
        const coords = convertToLeafletCoords(farm1Geo.coordinates);
        const polygon = L.polygon(coords, {
            color: '#22c55e',
            weight: 3,
            fillColor: '#22c55e',
            fillOpacity: 0.3
        }).addTo(currentMap);
        polygon.bindPopup(`<b>${escapeHtml(alert.farmerName)}</b><br>Farm 1`);
        bounds = bounds ? bounds.extend(polygon.getBounds()) : polygon.getBounds();
    }
    
    // Draw Farm 2 (Orange)
    if (farm2Geo?.coordinates) {
        const coords = convertToLeafletCoords(farm2Geo.coordinates);
        const polygon = L.polygon(coords, {
            color: '#f97316',
            weight: 3,
            fillColor: '#f97316',
            fillOpacity: 0.3
        }).addTo(currentMap);
        polygon.bindPopup(`<b>${escapeHtml(alert.affectedFarmName)}</b><br>Farm 2`);
        bounds = bounds ? bounds.extend(polygon.getBounds()) : polygon.getBounds();
    }
    
    // Calculate and draw overlap area (Red)
    if (farm1Geo?.coordinates && farm2Geo?.coordinates) {
        try {
            const poly1 = turf.polygon(farm1Geo.coordinates);
            const poly2 = turf.polygon(farm2Geo.coordinates);
            const intersection = turf.intersect(poly1, poly2);
            
            if (intersection) {
                const overlapCoords = convertToLeafletCoords(intersection.geometry.coordinates);
                const overlapPoly = L.polygon(overlapCoords, {
                    color: '#dc2626',
                    weight: 4,
                    fillColor: '#dc2626',
                    fillOpacity: 0.5
                }).addTo(currentMap);
                overlapPoly.bindPopup(`<b>⚠️ Conflict Area</b><br>${alert.overlapArea?.toFixed(2)} hectares overlap`);
                bounds = bounds ? bounds.extend(overlapPoly.getBounds()) : overlapPoly.getBounds();
            }
        } catch(e) {}
    }
    
    if (bounds && bounds.isValid()) {
        currentMap.fitBounds(bounds, { padding: [50, 50] });
    } else {
        currentMap.setView([6.5, -2.5], 6);
    }
    
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(currentMap);
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
                <div class="modal-section">
                    <div class="modal-grid">
                        <div class="modal-row"><div class="modal-label">Farm ID:</div><div class="modal-value">${escapeHtml(alert.farmId)}</div></div>
                        <div class="modal-row"><div class="modal-label">Alert Type:</div><div class="modal-value">${alert.type.replace('-', ' ').toUpperCase()}</div></div>
                        <div class="modal-row"><div class="modal-label">Severity:</div><div class="modal-value"><span class="alert-badge-large ${alert.severity}">${alert.severity.toUpperCase()}</span></div></div>
                    </div>
                </div>
                <div class="modal-section">
                    <div class="modal-section-title"><i class="fas fa-map-marked-alt"></i> Farm Location Map</div>
                    <div id="alertMap"></div>
                    <div class="map-info"><i class="fas fa-info-circle"></i> ${escapeHtml(alert.description)}</div>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        initSingleFarmMap(alert);
    }, 100);
}

function initSingleFarmMap(alert) {
    const mapContainer = document.getElementById('alertMap');
    if (!mapContainer) return;
    
    if (currentMap) currentMap.remove();
    
    currentMap = L.map('alertMap', { attributionControl: false }).setView([6.5, -2.5], 6);
    
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(currentMap);
    
    if (alert.farmData?.geometry?.coordinates) {
        const coords = convertToLeafletCoords(alert.farmData.geometry.coordinates);
        const polygon = L.polygon(coords, {
            color: alert.severity === 'high' ? '#f97316' : '#eab308',
            weight: 3,
            fillColor: alert.severity === 'high' ? '#f97316' : '#eab308',
            fillOpacity: 0.3
        }).addTo(currentMap);
        
        const bounds = polygon.getBounds();
        if (bounds.isValid()) {
            currentMap.fitBounds(bounds, { padding: [50, 50] });
        }
        polygon.bindPopup(`<b>${escapeHtml(alert.farmerName)}</b><br>⚠️ ${alert.title}`);
    } else {
        currentMap.setView([6.5, -2.5], 6);
    }
    
    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);
}

function showAlertInfoModal(alert) {
    showNotification('No map data available for this alert', 'info');
}

function updateAlertStatus(alertId, newStatus) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (alert) {
        alert.status = newStatus;
        applyFilters();
        showNotification(`Alert marked as ${newStatus}`, 'success');
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredAlerts.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages || totalPages === 0;
}

function getSeverityIcon(severity) {
    const icons = { critical: 'fa-skull-crossbones', high: 'fa-exclamation-triangle', medium: 'fa-exclamation', low: 'fa-info-circle' };
    return icons[severity] || 'fa-bell';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / 3600000);
    if (diffHours < 24) return `${diffHours} hours ago`;
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
    const notification = document.createElement('div');
    notification.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 24px;background:${colors[type]};color:white;border-radius:8px;z-index:10001;animation:slideIn 0.3s ease;font-size:14px;font-weight:500;`;
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
    document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderAlerts(); updatePagination(); } });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => { const total = Math.ceil(filteredAlerts.length / rowsPerPage); if (currentPage < total) { currentPage++; renderAlerts(); updatePagination(); } });
    document.getElementById('refreshBtn')?.addEventListener('click', () => loadFarmsAndGenerateAlerts());
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        allAlerts.forEach(alert => { if (alert.status === 'new') alert.status = 'acknowledged'; });
        applyFilters();
        showNotification('All alerts marked as acknowledged', 'success');
    });
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); localStorage.clear(); window.location.href = '../login.html'; });
}

// Make functions global for onclick handlers
window.viewAlertOnMap = viewAlertOnMap;
window.updateAlertStatus = updateAlertStatus;
