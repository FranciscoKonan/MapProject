// ===========================================
// QUALITY ALERTS - COMPLETE WITH SELF-INTERSECTION SUPPORT
// ===========================================

console.log('🚀 Quality Alerts initializing...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let allAlerts = [];
let filteredAlerts = [];
let currentPage = 1;
let alertsPerPage = 10;
let previewMap = null;

// Search variables
let allSuppliers = [];
let allCooperatives = [];
let supplierSearchTerm = '';
let coopSearchTerm = '';

// ===========================================
// CHECK CACHED USER INFO
// ===========================================
(function() {
    try {
        const cachedUser = localStorage.getItem('mappingtrace_user');
        if (cachedUser) {
            const user = JSON.parse(cachedUser);
            console.log('📦 Using cached user:', user);
            
            const userNameEl = document.querySelector('.user-name');
            const userRoleEl = document.querySelector('.user-role');
            const userAvatarEl = document.querySelector('.user-avatar');
            
            if (userNameEl) userNameEl.textContent = user.fullName || 'User';
            if (userRoleEl) userRoleEl.textContent = user.role || 'User';
            if (userAvatarEl) userAvatarEl.textContent = user.avatar || 'U';
        }
    } catch (e) {
        console.warn('Error reading cached user:', e);
    }
})();

// ===========================================
// LOAD ALERTS FROM DASHBOARD
// ===========================================
function loadAlertsFromDashboard() {
    console.log('🔍 Looking for alerts from dashboard...');
    
    // Try all possible sources
    let sourceAlerts = null;
    let sourceName = '';
    
    // 1. Check window.globalAlertsData
    if (window.globalAlertsData && Array.isArray(window.globalAlertsData) && window.globalAlertsData.length > 0) {
        sourceAlerts = window.globalAlertsData;
        sourceName = 'window.globalAlertsData';
    }
    // 2. Check window.dashboardAlerts
    else if (window.dashboardAlerts && Array.isArray(window.dashboardAlerts) && window.dashboardAlerts.length > 0) {
        sourceAlerts = window.dashboardAlerts;
        sourceName = 'window.dashboardAlerts';
    }
    // 3. Try getAllAlerts function
    else if (window.getAllAlerts && typeof window.getAllAlerts === 'function') {
        const alerts = window.getAllAlerts();
        if (alerts && Array.isArray(alerts) && alerts.length > 0) {
            sourceAlerts = alerts;
            sourceName = 'getAllAlerts()';
        }
    }
    
    if (sourceAlerts) {
        console.log(`✅ Found ${sourceAlerts.length} alerts in ${sourceName}`);
        console.log('Sample alert:', sourceAlerts[0]);
        
        allAlerts = transformAlerts(sourceAlerts);
        filteredAlerts = [...allAlerts];
        updateUI();
        
        console.log(`✅ Loaded ${allAlerts.length} alerts from dashboard`);
        return true;
    }
    
    console.log('⚠️ No alerts found in any dashboard source');
    return false;
}

// ===========================================
// TRANSFORM ALERTS TO STANDARD FORMAT
// ===========================================
function transformAlerts(alerts) {
    if (!Array.isArray(alerts)) return [];
    
    return alerts.map(alert => {
        // Log the alert structure for debugging
        console.log('Transforming alert:', alert.type, alert.id);
        console.log('Alert farms data:', alert.farms);
        console.log('Alert geometry:', alert.geometry ? 'present' : 'missing');
        
        // Handle self-intersection alerts
        if (alert.type === 'self-intersection') {
            // Ensure farms array has valid geometry
            let farms = alert.farms || [];
            if (farms.length === 0 && alert.geometry) {
                // Create farms array from geometry if missing
                farms = [{
                    id: alert.farm_id || alert.farmId,
                    farm_id: alert.farm_id || alert.farmId,
                    farmer_name: alert.farm_name || alert.farmerName || 'Unknown',
                    farmerName: alert.farm_name || alert.farmerName || 'Unknown',
                    geometry: alert.geometry
                }];
            }
            
            return {
                id: alert.id,
                type: 'self-intersection',
                severity: alert.severity || 'medium',
                title: alert.title || `${(alert.severity || 'MEDIUM').toUpperCase()} Self-Intersection: ${alert.self_intersection_area || '0'}ha`,
                message: alert.message || alert.description || `${alert.farm_name || alert.farmerName || 'Farm'} has a self-intersecting boundary`,
                farm_id: alert.farm_id || alert.farmId,
                farm_name: alert.farm_name || alert.farmerName || 'Unknown',
                farmer_id: alert.farmer_id || alert.farmId,
                cooperative: alert.cooperative || alert.cooperative_name || 'Unassigned',
                supplier: alert.supplier || 'Unknown',
                self_intersection_count: alert.self_intersection_count || alert.selfIntersectionCount || 1,
                self_intersection_area: alert.self_intersection_area || alert.selfIntersectionArea || '0',
                date: alert.date || new Date().toISOString(),
                read: alert.read || false,
                status: alert.status || 'new',
                geometry: alert.geometry,
                farms: farms,
                intersection_points: alert.intersection_points || [],
                intersection_geometry: alert.intersection_geometry || null
            };
        }
        
        // Handle overlap alerts (existing code)
        return {
            id: alert.id || `alert-${Date.now()}-${Math.random()}`,
            type: alert.type || 'overlap',
            severity: alert.severity || 'medium',
            title: alert.title || 
                   (alert.overlapArea ? `${(alert.severity || 'MEDIUM').toUpperCase()} Overlap: ${alert.overlapArea}ha` : 
                    alert.overlap_area ? `${(alert.severity || 'MEDIUM').toUpperCase()} Overlap: ${alert.overlap_area}ha` : 
                    'Farm Overlap Detected'),
            message: alert.message || alert.description || 
                    `${alert.farmerName || alert.farm_name || 'Farm A'} overlaps with ${alert.affectedFarmerName || alert.affected_farm_name || 'Farm B'}`,
            farm_id: alert.farm_id || alert.farmId,
            farm_name: alert.farm_name || alert.farmerName || 'Unknown',
            farmer_id: alert.farmer_id || alert.farmId,
            cooperative: alert.cooperative || alert.cooperative_name || 'Unassigned',
            supplier: alert.supplier || 'Unknown',
            affected_farm_id: alert.affected_farm_id || alert.affectedFarmId,
            affected_farm_name: alert.affected_farm_name || alert.affectedFarmerName || 'Unknown',
            affected_supplier: alert.affected_supplier || alert.affectedSupplier || 'Unknown',
            overlap_area: (alert.overlap_area || alert.overlapArea || '0').toString(),
            overlap_percent: (alert.overlap_percent || alert.overlapPercent || '0').toString(),
            date: alert.date || new Date().toISOString(),
            read: alert.read || false,
            status: alert.status || 'new',
            geometry: alert.geometry,
            farms: alert.farms || [],
            intersection_geometry: alert.intersection_geometry || alert.intersectionGeometry
        };
    });
}

// ===========================================
// UPDATE UI
// ===========================================
function updateUI() {
    console.log('Updating UI with', allAlerts.length, 'alerts');
    updateStats();
    updateSupplierFilter();
    updateCooperativeFilter();
    renderAlerts();
    updatePagination();
    updateExportCount();
    updateNotificationBadge();
}

// ===========================================
// UPDATE STATS CARDS
// ===========================================
function updateStats() {
    document.getElementById('criticalCount').textContent = allAlerts.filter(a => a.severity === 'critical').length;
    document.getElementById('highCount').textContent = allAlerts.filter(a => a.severity === 'high').length;
    document.getElementById('mediumCount').textContent = allAlerts.filter(a => a.severity === 'medium').length;
    document.getElementById('lowCount').textContent = allAlerts.filter(a => a.severity === 'low').length;
    document.getElementById('totalAlerts').textContent = allAlerts.length;
}

// ===========================================
// UPDATE SUPPLIER FILTER
// ===========================================
function updateSupplierFilter() {
    // Get unique suppliers
    allSuppliers = [...new Set(allAlerts.map(a => a.supplier))].sort();
    updateSupplierFilterWithSearch();
}

function updateSupplierFilterWithSearch() {
    const select = document.getElementById('alertSupplierFilter');
    if (!select) return;
    
    // Filter suppliers based on search term
    const filteredSuppliers = allSuppliers.filter(supplier => 
        supplier.toLowerCase().includes(supplierSearchTerm)
    );
    
    // Build options
    let options = '<option value="all">All Suppliers</option>';
    
    if (filteredSuppliers.length > 0) {
        options += filteredSuppliers.map(s => 
            `<option value="${s}">${s}</option>`
        ).join('');
    } else if (supplierSearchTerm) {
        select.innerHTML = '<option value="all" disabled selected>No matching suppliers</option>';
        return;
    }
    
    select.innerHTML = options;
}

// ===========================================
// UPDATE COOPERATIVE FILTER
// ===========================================
function updateCooperativeFilter() {
    // Get unique cooperatives
    allCooperatives = [...new Set(allAlerts.map(a => a.cooperative))].sort();
    updateCooperativeFilterWithSearch();
}

function updateCooperativeFilterWithSearch() {
    const select = document.getElementById('alertCoopFilter');
    if (!select) return;
    
    // Filter cooperatives based on search term
    const filteredCoops = allCooperatives.filter(coop => 
        coop.toLowerCase().includes(coopSearchTerm)
    );
    
    // Build options
    let options = '<option value="all">All Cooperatives</option>';
    
    if (filteredCoops.length > 0) {
        options += filteredCoops.map(c => 
            `<option value="${c}">${c}</option>`
        ).join('');
    } else if (coopSearchTerm) {
        select.innerHTML = '<option value="all" disabled selected>No matching cooperatives</option>';
        return;
    }
    
    select.innerHTML = options;
}

// ===========================================
// UPDATE EXPORT COUNT
// ===========================================
function updateExportCount() {
    const exportCount = document.getElementById('exportCount');
    if (exportCount) {
        exportCount.textContent = `${filteredAlerts.length} alerts`;
    }
}

// ===========================================
// UPDATE NOTIFICATION BADGE
// ===========================================
function updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.textContent = allAlerts.length;
    }
}

// ===========================================
// RENDER ALERTS
// ===========================================
function renderAlerts() {
    const start = (currentPage - 1) * alertsPerPage;
    const end = start + alertsPerPage;
    const pageAlerts = filteredAlerts.slice(start, end);
    
    const alertsList = document.getElementById('alertsList');
    
    if (!alertsList) return;
    
    if (pageAlerts.length === 0) {
        alertsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 16px; color: #4CAF50;"></i>
                <h3>No Issues Detected</h3>
                <p>All farm boundaries are valid and clear.</p>
            </div>
        `;
        return;
    }
    
    alertsList.innerHTML = pageAlerts.map(alert => {
        const icon = alert.type === 'overlap' ? 'fa-layer-group' : 'fa-draw-polygon';
        const typeText = alert.type === 'overlap' ? 'Boundary Overlap' : 'Self-Intersection';
        const hasMapData = alert.type === 'overlap' ? 
            (alert.farms && alert.farms.length >= 2 && alert.intersection_geometry) : 
            (alert.farms && alert.farms.length >= 1 && alert.geometry);
        
        return `
        <div class="alert-item ${alert.severity} ${alert.read ? '' : 'unread'}" data-id="${alert.id}">
            <div class="alert-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="alert-content" onclick="showAlertDetails('${alert.id}')">
                <div class="alert-header">
                    <span class="alert-title">${alert.title}</span>
                    <span class="alert-time">${formatTime(alert.date)}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-meta">
                    <span><i class="fas fa-exclamation-triangle"></i> ${alert.severity}</span>
                    <span><i class="fas fa-building"></i> ${alert.supplier}</span>
                    <span><i class="fas fa-ruler-combined"></i> ${alert.type === 'overlap' ? alert.overlap_area + ' ha' : alert.self_intersection_count + ' pts'}</span>
                </div>
            </div>
            <div class="alert-actions">
                ${!alert.read ? `<button class="action-btn" onclick="event.stopPropagation(); markAsRead('${alert.id}')" title="Mark as read"><i class="fas fa-check"></i></button>` : ''}
                ${hasMapData ? 
                    `<button class="action-btn map-btn" onclick="event.stopPropagation(); showMapPreview('${alert.id}')" title="View on map"><i class="fas fa-map-marked-alt"></i></button>` : 
                    `<button class="action-btn" disabled style="opacity: 0.3;" title="Map not available"><i class="fas fa-map-marked-alt"></i></button>`
                }
                <button class="action-btn" onclick="event.stopPropagation(); resolveAlert('${alert.id}')" title="Resolve alert"><i class="fas fa-check-circle"></i></button>
            </div>
        </div>
    `}).join('');
}

// ===========================================
// FORMAT TIME
// ===========================================
function formatTime(date) {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

// ===========================================
// SHOW ALERT DETAILS
// ===========================================
window.showAlertDetails = function(alertId) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    if (!alert.read) {
        markAsRead(alertId);
    }
    
    const existing = document.getElementById('alert-detail-modal');
    if (existing) existing.remove();
    
    const severityColor = alert.severity === 'critical' ? '#dc2626' :
                         alert.severity === 'high' ? '#f97316' :
                         alert.severity === 'medium' ? '#ca8a04' : '#0284c7';
    
    const icon = alert.type === 'overlap' ? 'fa-layer-group' : 'fa-draw-polygon';
    const typeTitle = alert.type === 'overlap' ? 'Overlap Details' : 'Self-Intersection Details';
    
    const modal = document.createElement('div');
    modal.id = 'alert-detail-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000000;
    `;
    
    let modalContent = '';
    
    if (alert.type === 'overlap') {
        modalContent = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                <div style="flex: 1; padding: 15px; background: #f8fafc; border-radius: 8px; text-align: center;">
                    <i class="fas fa-user" style="color: #2c6e49; font-size: 24px; margin-bottom: 5px;"></i>
                    <div><strong>${alert.farm_name}</strong></div>
                    <div style="font-size: 12px; color: #666;">${alert.farm_id}</div>
                    <div style="font-size: 11px; color: #2c6e49;">${alert.supplier}</div>
                </div>
                <div style="font-size: 20px; color: ${severityColor};"><i class="fas fa-exchange-alt"></i></div>
                <div style="flex: 1; padding: 15px; background: #f8fafc; border-radius: 8px; text-align: center;">
                    <i class="fas fa-user" style="color: #2c6e49; font-size: 24px; margin-bottom: 5px;"></i>
                    <div><strong>${alert.affected_farm_name}</strong></div>
                    <div style="font-size: 12px; color: #666;">${alert.affected_farm_id}</div>
                    <div style="font-size: 11px; color: #2c6e49;">${alert.affected_supplier}</div>
                </div>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-ruler-combined" style="color: #856404; font-size: 20px;"></i>
                    <div>
                        <div style="font-weight: 600; color: #856404;">Overlap Area</div>
                        <div style="font-size: 24px; font-weight: 700; color: #856404;">${alert.overlap_area} ha (${alert.overlap_percent}%)</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        modalContent = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="width: 80px; height: 80px; background: ${severityColor}20; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-draw-polygon" style="font-size: 40px; color: ${severityColor};"></i>
                </div>
                <h2 style="margin: 0 0 5px; color: #1e293b;">${alert.farm_name}</h2>
                <div style="font-size: 13px; color: #666;">${alert.farm_id}</div>
                <div style="font-size: 12px; color: #2c6e49; margin-top: 5px;">${alert.supplier}</div>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-exclamation-triangle" style="color: #856404; font-size: 20px;"></i>
                    <div>
                        <div style="font-weight: 600; color: #856404;">Self-Intersection</div>
                        <div style="font-size: 16px; color: #856404;">
                            ${alert.self_intersection_count || 1} intersection point(s) detected
                        </div>
                        <div style="font-size: 14px; color: #856404; margin-top: 5px;">
                            Area affected: ${alert.self_intersection_area || 'Unknown'} ha
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div style="
            background: white;
            width: 500px;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        ">
            <div style="
                background: ${severityColor};
                padding: 15px 20px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 style="margin:0; color: white; font-size: 16px;">
                    <i class="fas ${icon}"></i> ${typeTitle}
                </h3>
                <button onclick="document.getElementById('alert-detail-modal').remove()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">&times;</button>
            </div>
            
            <div style="padding: 20px;">
                ${modalContent}
                
                <div style="color: #666; font-size: 13px;">
                    <i class="fas fa-clock"></i> Detected: ${new Date(alert.date).toLocaleString()}
                </div>
            </div>
            
            <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="document.getElementById('alert-detail-modal').remove()" style="
                    padding: 8px 16px;
                    background: white;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    cursor: pointer;
                ">Close</button>
                ${alert.type === 'overlap' ? 
                    (alert.farms && alert.farms.length >= 2 && alert.intersection_geometry ? 
                    `<button onclick="showMapPreview('${alert.id}'); document.getElementById('alert-detail-modal').remove()" style="
                        padding: 8px 16px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    "><i class="fas fa-map-marked-alt"></i> View Map</button>` : '') :
                    (alert.farms && alert.farms.length >= 1 && alert.geometry ?
                    `<button onclick="showMapPreview('${alert.id}'); document.getElementById('alert-detail-modal').remove()" style="
                        padding: 8px 16px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                    "><i class="fas fa-map-marked-alt"></i> View Map</button>` : '')
                }
                <button onclick="resolveAlert('${alert.id}'); document.getElementById('alert-detail-modal').remove()" style="
                    padding: 8px 16px;
                    background: #2c6e49;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                ">Resolve</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

// ===========================================
// SHOW MAP PREVIEW
// ===========================================
window.showMapPreview = function(alertId) {
    console.log('🗺️ Showing map for alert:', alertId);
    
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) {
        alertMessage('Alert not found', 'error');
        return;
    }
    
    // Check if we have geometry data
    const hasMapData = alert.type === 'overlap' ? 
        (alert.farms && alert.farms.length >= 2 && alert.intersection_geometry) : 
        (alert.farms && alert.farms.length >= 1 && alert.geometry);
    
    if (!hasMapData) {
        alertMessage('Map data not available for this alert', 'warning');
        return;
    }
    
    const existing = document.getElementById('map-preview-modal');
    if (existing) existing.remove();
    
    const modalId = 'map-preview-modal';
    const mapId = 'map-' + Date.now();
    
    const severityColor = alert.severity === 'critical' ? '#dc2626' :
                         alert.severity === 'high' ? '#f97316' :
                         alert.severity === 'medium' ? '#ca8a04' : '#0284c7';
    
    let title = '';
    if (alert.type === 'overlap') {
        title = `Overlap: ${alert.farm_name} ↔ ${alert.affected_farm_name}`;
    } else {
        title = `Self-Intersection: ${alert.farm_name}`;
    }
    
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000000;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            width: 900px;
            max-width: 95%;
            border-radius: 12px;
            overflow: hidden;
        ">
            <div style="
                padding: 15px 20px;
                background: ${severityColor};
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 style="margin:0; font-size: 16px;">
                    <i class="fas fa-map-marked-alt"></i> ${title}
                </h3>
                <button onclick="document.getElementById('${modalId}').remove()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">&times;</button>
            </div>
            
            <div style="padding: 20px;">
                <div id="${mapId}" style="width: 100%; height: 450px;"></div>
                <div style="margin-top: 15px; display: flex; gap: 20px; justify-content: center; font-size: 13px;">
                    ${alert.type === 'overlap' ? `
                        <div><span style="display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 2px; margin-right: 5px;"></span> ${alert.farm_name}</div>
                        <div><span style="display: inline-block; width: 12px; height: 12px; background: #10b981; border-radius: 2px; margin-right: 5px;"></span> ${alert.affected_farm_name}</div>
                        <div><span style="display: inline-block; width: 12px; height: 12px; background: #dc2626; border-radius: 2px; margin-right: 5px;"></span> Overlap (${alert.overlap_area} ha)</div>
                    ` : `
                        <div><span style="display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 2px; margin-right: 5px;"></span> ${alert.farm_name}</div>
                        <div><span style="display: inline-block; width: 12px; height: 12px; background: #dc2626; border-radius: 2px; margin-right: 5px;"></span> Self-Intersection (${alert.self_intersection_count} pts)</div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const mapDiv = document.getElementById(mapId);
        if (!mapDiv) return;
        
        const map = L.map(mapDiv);
        
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        }).addTo(map);
        
        try {
            const bounds = L.latLngBounds();
            
            if (alert.type === 'overlap') {
                // Handle overlap map
                const colors = ['#3b82f6', '#10b981'];
                
                alert.farms.forEach((farm, index) => {
                    if (farm.geometry) {
                        const geom = typeof farm.geometry === 'string' 
                            ? JSON.parse(farm.geometry) 
                            : farm.geometry;
                        
                        const layer = L.geoJSON(geom, {
                            style: {
                                color: colors[index],
                                weight: 2,
                                fillColor: colors[index],
                                fillOpacity: 0.2
                            }
                        }).addTo(map);
                        
                        layer.bindPopup(`<strong>${farm.farmer_name || farm.farmerName || 'Farm'}</strong>`);
                        
                        if (layer.getBounds().isValid()) {
                            bounds.extend(layer.getBounds());
                        }
                    }
                });
                
                if (alert.intersection_geometry) {
                    const intersectionLayer = L.geoJSON(alert.intersection_geometry, {
                        style: {
                            color: '#dc2626',
                            weight: 4,
                            fillColor: '#dc2626',
                            fillOpacity: 0.5
                        }
                    }).addTo(map).bindPopup(`<strong>⚠️ Overlap: ${alert.overlap_area} ha</strong>`);
                    
                    if (intersectionLayer.getBounds().isValid()) {
                        bounds.extend(intersectionLayer.getBounds());
                    }
                }
            } else {
                // Handle self-intersection map
                if (alert.farms && alert.farms.length > 0 && alert.farms[0].geometry) {
                    const farm = alert.farms[0];
                    const geom = typeof farm.geometry === 'string' 
                        ? JSON.parse(farm.geometry) 
                        : farm.geometry;
                    
                    // Draw the polygon with a style that highlights self-intersections
                    const layer = L.geoJSON(geom, {
                        style: {
                            color: '#dc2626',
                            weight: 3,
                            fillColor: '#fecaca',
                            fillOpacity: 0.3,
                            dashArray: '5, 5'
                        }
                    }).addTo(map);
                    
                    layer.bindPopup(`<strong>${farm.farmer_name || farm.farmerName || 'Farm'}</strong><br>Self-intersection detected`);
                    
                    if (layer.getBounds().isValid()) {
                        bounds.extend(layer.getBounds());
                    }
                    
                    // Add markers at self-intersection points if available
                    if (alert.intersection_points && alert.intersection_points.length > 0) {
                        alert.intersection_points.forEach(point => {
                            L.circleMarker([point[1], point[0]], {
                                radius: 8,
                                color: '#dc2626',
                                weight: 2,
                                fillColor: '#ffffff',
                                fillOpacity: 1
                            }).addTo(map).bindPopup('Self-intersection point');
                        });
                    }
                }
            }
            
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            } else {
                map.setView([7.539989, -5.547080], 8);
            }
            
        } catch (e) {
            console.error('Map error:', e);
            map.setView([7.539989, -5.547080], 8);
        }
        
        setTimeout(() => map.invalidateSize(), 200);
    }, 200);
};

// ===========================================
// PAGINATION
// ===========================================
function updatePagination() {
    const totalPages = Math.ceil(filteredAlerts.length / alertsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages || totalPages === 0;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderAlerts();
        updatePagination();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredAlerts.length / alertsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderAlerts();
        updatePagination();
    }
}

// ===========================================
// FILTER FUNCTIONS
// ===========================================
function applyFilters() {
    const type = document.getElementById('alertTypeFilter').value;
    const severity = document.getElementById('alertSeverityFilter').value;
    const supplier = document.getElementById('alertSupplierFilter').value;
    const cooperative = document.getElementById('alertCoopFilter')?.value || 'all';
    const status = document.getElementById('alertStatusFilter').value;
    
    filteredAlerts = allAlerts.filter(alert => {
        if (type !== 'all' && alert.type !== type) return false;
        if (severity !== 'all' && alert.severity !== severity) return false;
        if (supplier !== 'all' && alert.supplier !== supplier) return false;
        if (cooperative !== 'all' && alert.cooperative !== cooperative) return false;
        if (status !== 'all' && alert.status !== status) return false;
        return true;
    });
    
    currentPage = 1;
    renderAlerts();
    updatePagination();
    updateExportCount();
}

function clearFilters() {
    document.getElementById('alertTypeFilter').value = 'all';
    document.getElementById('alertSeverityFilter').value = 'all';
    document.getElementById('alertSupplierFilter').value = 'all';
    document.getElementById('alertCoopFilter').value = 'all';
    document.getElementById('alertStatusFilter').value = 'all';
    
    // Clear search inputs
    const supplierSearch = document.getElementById('supplierSearch');
    const coopSearch = document.getElementById('coopSearch');
    if (supplierSearch) supplierSearch.value = '';
    if (coopSearch) coopSearch.value = '';
    supplierSearchTerm = '';
    coopSearchTerm = '';
    
    // Reset filters
    updateSupplierFilterWithSearch();
    updateCooperativeFilterWithSearch();
    
    filteredAlerts = [...allAlerts];
    currentPage = 1;
    renderAlerts();
    updatePagination();
    updateExportCount();
}

// ===========================================
// ALERT ACTIONS
// ===========================================
window.markAsRead = function(alertId) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (alert) {
        alert.read = true;
        renderAlerts();
        updateStats();
        alertMessage('Alert marked as read', 'success');
    }
};

window.markAllAsRead = function() {
    allAlerts.forEach(a => a.read = true);
    renderAlerts();
    updateStats();
    alertMessage('All alerts marked as read', 'success');
};

window.resolveAlert = function(alertId) {
    allAlerts = allAlerts.filter(a => a.id !== alertId);
    filteredAlerts = [...allAlerts];
    renderAlerts();
    updateStats();
    updatePagination();
    updateExportCount();
    alertMessage('Alert resolved', 'success');
};

// ===========================================
// SIMPLE MESSAGE FUNCTION
// ===========================================
function alertMessage(message, type = 'info') {
    console.log(`[${type}] ${message}`);
}

// ===========================================
// INITIALIZE EVENT LISTENERS
// ===========================================
function initEventListeners() {
    document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
    document.getElementById('prevPageBtn')?.addEventListener('click', prevPage);
    document.getElementById('nextPageBtn')?.addEventListener('click', nextPage);
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        console.log('Refreshing alerts...');
        loadAlertsFromDashboard();
    });
    document.getElementById('markAllReadBtn')?.addEventListener('click', markAllAsRead);
    
    // Export buttons
    document.getElementById('exportCSV')?.addEventListener('click', () => exportAlerts('csv'));
    document.getElementById('exportExcel')?.addEventListener('click', () => exportAlerts('excel'));
    document.getElementById('exportGeoJSON')?.addEventListener('click', () => exportAlerts('geojson'));
    document.getElementById('exportJSON')?.addEventListener('click', () => exportAlerts('json'));
    
    // Initialize search listeners
    initSearchListeners();
}

// Force a sample self-intersection alert for testing
setTimeout(() => {
    if (allAlerts.length === 0) {
        console.log('📊 No alerts found, adding sample self-intersection alert');
        
        // Create a sample self-intersection alert
        const sampleSelfIntersection = {
            id: `SI-SAMPLE-${Date.now()}`,
            type: 'self-intersection',
            severity: 'high',
            title: 'HIGH Self-Intersection: 2.5ha (2 points)',
            message: 'Sample Farm has a self-intersecting boundary (test alert)',
            farm_id: 'SAMPLE-FARM-001',
            farm_name: 'Sample Self-Intersection Farm',
            farmer_id: 'SAMPLE-001',
            cooperative: 'Sample Cooperative',
            supplier: 'Sample Supplier',
            self_intersection_count: 2,
            self_intersection_area: '2.50',
            date: new Date().toISOString(),
            read: false,
            status: 'new',
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.567080, 7.519989],
                    [-5.547080, 7.539989],
                    [-5.567080, 7.539989],
                    [-5.547080, 7.519989],
                    [-5.567080, 7.519989]
                ]]
            },
            farms: [{
                id: 'SAMPLE-FARM-001',
                farm_id: 'SAMPLE-FARM-001',
                farmer_name: 'Sample Self-Intersection Farm',
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [-5.567080, 7.519989],
                        [-5.547080, 7.539989],
                        [-5.567080, 7.539989],
                        [-5.547080, 7.519989],
                        [-5.567080, 7.519989]
                    ]]
                }
            }],
            intersection_points: [[-5.557080, 7.529989]]
        };
        
        allAlerts = [sampleSelfIntersection];
        filteredAlerts = [...allAlerts];
        updateUI();
        console.log('✅ Sample self-intersection alert added');
    }
}, 2000);

// ===========================================
// SEARCH LISTENERS
// ===========================================
function initSearchListeners() {
    const supplierSearch = document.getElementById('supplierSearch');
    const coopSearch = document.getElementById('coopSearch');
    
    if (supplierSearch) {
        supplierSearch.addEventListener('input', (e) => {
            supplierSearchTerm = e.target.value.toLowerCase();
            updateSupplierFilterWithSearch();
        });
    }
    
    if (coopSearch) {
        coopSearch.addEventListener('input', (e) => {
            coopSearchTerm = e.target.value.toLowerCase();
            updateCooperativeFilterWithSearch();
        });
    }
}

// ===========================================
// EXPORT FUNCTIONALITY
// ===========================================
function exportAlerts(format) {
    if (filteredAlerts.length === 0) {
        alertMessage('No alerts to export', 'warning');
        return;
    }
    
    switch(format) {
        case 'csv':
            exportToCSV();
            break;
        case 'excel':
            exportToExcel();
            break;
        case 'geojson':
            exportToGeoJSON();
            break;
        case 'json':
            exportToJSON();
            break;
    }
}

function exportToCSV() {
    const headers = ['ID', 'Type', 'Severity', 'Title', 'Message', 'Supplier', 'Farm', 'Farm ID', 
                     'Affected Farm', 'Affected Farm ID', 'Overlap Area (ha)', 'Self-Intersection Pts', 
                     'Date', 'Status', 'Cooperative'];
    
    const rows = filteredAlerts.map(alert => [
        alert.id,
        alert.type,
        alert.severity,
        alert.title,
        alert.message,
        alert.supplier,
        alert.farm_name,
        alert.farm_id,
        alert.affected_farm_name || '',
        alert.affected_farm_id || '',
        alert.overlap_area || '',
        alert.self_intersection_count || '',
        new Date(alert.date).toLocaleString(),
        alert.status || 'new',
        alert.cooperative || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => 
        `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `quality-alerts-${new Date().toISOString().slice(0,10)}.csv`);
    alertMessage(`Exported ${filteredAlerts.length} alerts to CSV`, 'success');
}

function exportToExcel() {
    const worksheet = XLSX.utils.json_to_sheet(filteredAlerts.map(alert => ({
        'ID': alert.id,
        'Type': alert.type,
        'Severity': alert.severity,
        'Title': alert.title,
        'Message': alert.message,
        'Supplier': alert.supplier,
        'Farm': alert.farm_name,
        'Farm ID': alert.farm_id,
        'Affected Farm': alert.affected_farm_name || '',
        'Affected Farm ID': alert.affected_farm_id || '',
        'Overlap Area (ha)': alert.overlap_area ? parseFloat(alert.overlap_area) : '',
        'Self-Intersection Points': alert.self_intersection_count || '',
        'Date': new Date(alert.date).toLocaleString(),
        'Status': alert.status || 'new',
        'Cooperative': alert.cooperative || ''
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quality Alerts');
    XLSX.writeFile(workbook, `quality-alerts-${new Date().toISOString().slice(0,10)}.xlsx`);
    alertMessage(`Exported ${filteredAlerts.length} alerts to Excel`, 'success');
}

function exportToGeoJSON() {
    const features = filteredAlerts.map(alert => {
        let geometry = null;
        
        if (alert.type === 'overlap' && alert.intersection_geometry) {
            geometry = alert.intersection_geometry;
        } else if (alert.type === 'self-intersection' && alert.geometry) {
            geometry = alert.geometry;
        }
        
        return {
            type: 'Feature',
            properties: {
                id: alert.id,
                type: alert.type,
                severity: alert.severity,
                title: alert.title,
                message: alert.message,
                supplier: alert.supplier,
                farm_name: alert.farm_name,
                farm_id: alert.farm_id,
                affected_farm: alert.affected_farm_name || '',
                affected_farm_id: alert.affected_farm_id || '',
                overlap_area: alert.overlap_area ? parseFloat(alert.overlap_area) : null,
                self_intersection_count: alert.self_intersection_count || null,
                date: alert.date,
                status: alert.status || 'new',
                cooperative: alert.cooperative || ''
            },
            geometry: geometry || {
                type: 'Point',
                coordinates: [0, 0]
            }
        };
    });
    
    const geojson = {
        type: 'FeatureCollection',
        features: features
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    saveAs(blob, `quality-alerts-${new Date().toISOString().slice(0,10)}.geojson`);
    alertMessage(`Exported ${filteredAlerts.length} alerts to GeoJSON`, 'success');
}

function exportToJSON() {
    const exportData = filteredAlerts.map(alert => ({
        ...alert,
        export_date: new Date().toISOString()
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    saveAs(blob, `quality-alerts-${new Date().toISOString().slice(0,10)}.json`);
    alertMessage(`Exported ${filteredAlerts.length} alerts to JSON`, 'success');
}

// ===========================================
// SETUP DASHBOARD SYNC
// ===========================================
function setupDashboardSync() {
    window.addEventListener('alerts-updated', (event) => {
        console.log('🔄 Alerts updated event received', event.detail);
        if (event.detail && event.detail.alerts) {
            allAlerts = transformAlerts(event.detail.alerts);
            filteredAlerts = [...allAlerts];
            updateUI();
            console.log(`✅ Updated with ${allAlerts.length} alerts from dashboard`);
        }
    });
    
    window.addEventListener('dashboard-alerts-updated', (event) => {
        console.log('🔄 Dashboard alerts updated event received', event.detail);
        if (event.detail && event.detail.alerts) {
            allAlerts = transformAlerts(event.detail.alerts);
            filteredAlerts = [...allAlerts];
            updateUI();
            console.log(`✅ Updated with ${allAlerts.length} alerts from dashboard`);
        }
    });
}

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 DOM Ready - Quality Alerts Page');
    
    initEventListeners();
    setupDashboardSync();
    
    // Try to load alerts immediately
    setTimeout(() => {
        if (loadAlertsFromDashboard()) {
            console.log('✅ Initial load successful');
        } else {
            console.log('⚠️ No alerts found on initial load');
        }
    }, 1000);
    
    // Try again after 3 seconds
    setTimeout(() => {
        if (allAlerts.length === 0) {
            console.log('🔄 Retry loading alerts...');
            loadAlertsFromDashboard();
        }
    }, 3000);
    
    // Try again after 5 seconds
    setTimeout(() => {
        if (allAlerts.length === 0) {
            console.log('🔄 Final retry loading alerts...');
            loadAlertsFromDashboard();
        }
    }, 5000);
});

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0%); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0%); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .action-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.2s;
    }
    .action-btn:hover {
        background: #2c6e49;
        color: white;
        transform: translateY(-2px);
    }
    .action-btn.map-btn {
        background: #3b82f6;
        color: white;
    }
    .action-btn.map-btn:hover {
        background: #2563eb;
    }
    .action-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    .action-btn:disabled:hover {
        transform: none;
        background: white;
        color: inherit;
    }
`;
document.head.appendChild(style);

console.log('✅ Quality Alerts initialized with self-intersection support');

// ===========================================
// DEBUG FUNCTION FOR QUALITY ALERTS
// ===========================================
window.debugQualityAlerts = function() {
    console.log('=== QUALITY ALERTS DEBUG ===');
    console.log('Total alerts:', allAlerts.length);
    console.log('Filtered alerts:', filteredAlerts.length);
    console.log('Self-intersection alerts:', allAlerts.filter(a => a.type === 'self-intersection'));
    console.log('Overlap alerts:', allAlerts.filter(a => a.type === 'overlap'));
    
    console.log('All alerts:', allAlerts);
    console.log('Global alerts data:', window.globalAlertsData);
    console.log('Dashboard alerts:', window.dashboardAlerts);
    
    if (window.getAllAlerts) {
        console.log('getAllAlerts():', window.getAllAlerts());
    }
    
    return allAlerts;
};

// ===========================================
// LOAD ALERTS FROM DASHBOARD WITH DEDUPLICATION
// ===========================================
function loadAlertsFromDashboard() {
    console.log('🔍 Looking for alerts from dashboard...');
    
    // Try all possible sources
    let sourceAlerts = null;
    let sourceName = '';
    
    // 1. Check window.globalAlertsData
    if (window.globalAlertsData && Array.isArray(window.globalAlertsData) && window.globalAlertsData.length > 0) {
        sourceAlerts = window.globalAlertsData;
        sourceName = 'window.globalAlertsData';
    }
    // 2. Check window.dashboardAlerts
    else if (window.dashboardAlerts && Array.isArray(window.dashboardAlerts) && window.dashboardAlerts.length > 0) {
        sourceAlerts = window.dashboardAlerts;
        sourceName = 'window.dashboardAlerts';
    }
    // 3. Try getAllAlerts function
    else if (window.getAllAlerts && typeof window.getAllAlerts === 'function') {
        const alerts = window.getAllAlerts();
        if (alerts && Array.isArray(alerts) && alerts.length > 0) {
            sourceAlerts = alerts;
            sourceName = 'getAllAlerts()';
        }
    }
    
    if (sourceAlerts) {
        console.log(`✅ Found ${sourceAlerts.length} alerts in ${sourceName}`);
        
        // Deduplicate alerts by ID
        const uniqueAlerts = [];
        const seenIds = new Set();
        
        sourceAlerts.forEach(alert => {
            if (!seenIds.has(alert.id)) {
                seenIds.add(alert.id);
                uniqueAlerts.push(alert);
            }
        });
        
        if (uniqueAlerts.length < sourceAlerts.length) {
            console.log(`🔍 Removed ${sourceAlerts.length - uniqueAlerts.length} duplicate alerts`);
        }
        
        allAlerts = transformAlerts(uniqueAlerts);
        filteredAlerts = [...allAlerts];
        updateUI();
        
        console.log(`✅ Loaded ${allAlerts.length} unique alerts from dashboard`);
        return true;
    }
    
    console.log('⚠️ No alerts found in any dashboard source');
    return false;
}