// ===========================================
// QUALITY ALERTS - FIXED MAP WITH ZOOM AND OVERLAP
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
    console.log('🔧 Initializing Supabase...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 15) {
            setTimeout(() => initSupabase(retryCount + 1), 500);
            return;
        }
        console.error('❌ Supabase library failed to load');
        showNotification('Supabase library failed to load', 'error');
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
            console.log('⚠️ No active session');
            showNotification('Please login to view alerts', 'warning');
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
// LOAD FARMS FROM SUPABASE
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
                geometry: farm.geometry,
                coordinates: farm.geometry?.coordinates
            }));
            
            generateAlertsFromFarms();
            updateFilterOptions();
            applyFilters();
            
            const alertCount = allAlerts.length;
            showNotification(`Loaded ${allFarms.length} farms, found ${alertCount} alerts`, 
                           alertCount > 0 ? 'warning' : 'success');
            
            const badge = document.getElementById('notificationBadge');
            if (badge) badge.style.display = alertCount > 0 ? 'block' : 'none';
            
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
// CONVERT COORDINATES FOR LEAFLET
// ===========================================

function convertToLeafletCoords(coords) {
    if (!coords || !Array.isArray(coords)) return coords;
    
    // Point [lon, lat] -> [lat, lon]
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords[1], coords[0]];
    }
    
    // Polygon: array of rings
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        return coords.map(ring => ring.map(point => [point[1], point[0]]));
    }
    
    // LinearRing
    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        return coords.map(point => [point[1], point[0]]);
    }
    
    return coords;
}

// ===========================================
// GENERATE ALERTS FROM FARMS
// ===========================================

function generateAlertsFromFarms() {
    console.log('🔍 Generating quality alerts from farms...');
    const alerts = [];
    
    const farmsWithGeo = allFarms.filter(f => f.geometry && f.geometry.coordinates);
    console.log(`📐 Farms with geometry: ${farmsWithGeo.length}`);
    
    // DETECT OVERLAPS
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
                        const overlapAreaSqM = turf.area(intersection);
                        const overlapAreaHa = overlapAreaSqM / 10000;
                        
                        if (overlapAreaHa > 0.01) {
                            const area1Ha = turf.area(poly1) / 10000;
                            const area2Ha = turf.area(poly2) / 10000;
                            const smallerArea = Math.min(area1Ha, area2Ha);
                            const overlapPercent = Math.round((overlapAreaHa / smallerArea) * 100);
                            
                            let severity = 'low';
                            if (overlapAreaHa > 5) severity = 'critical';
                            else if (overlapAreaHa >= 3) severity = 'high';
                            else if (overlapAreaHa > 1) severity = 'medium';
                            
                            alerts.push({
                                id: `overlap_${farm1.id}_${farm2.id}`,
                                farmId: farm1.farmer_id,
                                farmerName: farm1.farmer_name,
                                farmData: farm1,
                                affectedFarmId: farm2.farmer_id,
                                affectedFarmName: farm2.farmer_name,
                                affectedFarmData: farm2,
                                cooperative: farm1.cooperative,
                                supplier: farm1.supplier,
                                type: 'overlap',
                                severity: severity,
                                title: `${severity.toUpperCase()} Overlap: ${overlapAreaHa.toFixed(1)}ha`,
                                description: `Farm "${farm1.farmer_name}" overlaps with "${farm2.farmer_name}". Overlap area: ${overlapAreaHa.toFixed(2)} ha (${overlapPercent}% of smaller farm).`,
                                status: 'new',
                                date: new Date().toISOString(),
                                overlapArea: overlapAreaHa,
                                overlapPercent: overlapPercent,
                                intersectionGeo: intersection.geometry.coordinates
                            });
                            
                            console.log(`⚠️ Found overlap: ${farm1.farmer_name} ↔ ${farm2.farmer_name} (${overlapAreaHa.toFixed(2)} ha)`);
                        }
                    }
                }
            } catch(e) {
                console.warn('Error checking overlap:', e.message);
            }
        }
    }
    
    // CHECK FOR MISSING GEOMETRY
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
    console.log(`✅ Generated ${alerts.length} alerts (${alerts.filter(a => a.type === 'overlap').length} overlaps)`);
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
// MAP VIEW FUNCTIONS - WITH ZOOM AND OVERLAP
// ===========================================

function viewAlertOnMap(alertId) {
    const alert = allAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    if (alert.type === 'overlap' && alert.farmData && alert.affectedFarmData) {
        showOverlapMapModal(alert);
    } else if (alert.farmData && alert.farmData.geometry) {
        showSingleFarmMapModal(alert);
    } else {
        showNotification('No geometry data available for this alert', 'warning');
    }
}

function showOverlapMapModal(alert) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const severityColors = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#22c55e' };
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;';
    
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:1000px;width:90%;max-height:90vh;overflow-y:auto;">
            <div style="padding:20px 24px;background:linear-gradient(135deg, ${severityColors[alert.severity]}, #7f1d1d);color:white;display:flex;justify-content:space-between;align-items:center;border-radius:16px 16px 0 0;">
                <h3 style="margin:0;"><i class="fas fa-exclamation-triangle"></i> Overlap Analysis - ${alert.severity.toUpperCase()}</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;">✕</button>
            </div>
            <div style="padding:24px;">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #e2e8f0;">
                    <div><strong>Severity:</strong> <span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${severityColors[alert.severity]};color:white;font-size:12px;">${alert.severity.toUpperCase()}</span></div>
                    <div><strong>Overlap Area:</strong> ${alert.overlapArea?.toFixed(2) || 'N/A'} ha</div>
                    <div><strong>Overlap %:</strong> ${alert.overlapPercent || 'N/A'}% of smaller farm</div>
                </div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
                    <div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
                        <h4 style="margin:0 0 12px 0;color:#22c55e;"><i class="fas fa-tractor"></i> Farm 1: ${escapeHtml(alert.farmerName)}</h4>
                        <div style="display:flex;padding:4px 0;"><div style="width:100px;font-weight:600;">Cooperative:</div><div>${escapeHtml(alert.farmData?.cooperative || 'N/A')}</div></div>
                        <div style="display:flex;padding:4px 0;"><div style="width:100px;font-weight:600;">Supplier:</div><div>${escapeHtml(alert.farmData?.supplier || 'N/A')}</div></div>
                        <div style="display:flex;padding:4px 0;"><div style="width:100px;font-weight:600;">Area:</div><div>${alert.farmData?.area?.toFixed(2) || 'N/A'} ha</div></div>
                    </div>
                    <div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;">
                        <h4 style="margin:0 0 12px 0;color:#f97316;"><i class="fas fa-tractor"></i> Farm 2: ${escapeHtml(alert.affectedFarmName)}</h4>
                        <div style="display:flex;padding:4px 0;"><div style="width:100px;font-weight:600;">Cooperative:</div><div>${escapeHtml(alert.affectedFarmData?.cooperative || 'N/A')}</div></div>
                        <div style="display:flex;padding:4px 0;"><div style="width:100px;font-weight:600;">Supplier:</div><div>${escapeHtml(alert.affectedFarmData?.supplier || 'N/A')}</div></div>
                        <div style="display:flex;padding:4px 0;"><div style="width:100px;font-weight:600;">Area:</div><div>${alert.affectedFarmData?.area?.toFixed(2) || 'N/A'} ha</div></div>
                    </div>
                </div>
                
                <div style="margin-bottom:20px;">
                    <div style="font-weight:600;margin-bottom:10px;color:#2c6e49;"><i class="fas fa-map-marked-alt"></i> Farm Location Map</div>
                    <div id="alertMap" style="height:450px;border-radius:12px;border:1px solid #e2e8f0;"></div>
                    <div style="margin-top:10px;padding:10px;background:#f0fdf4;border-radius:8px;font-size:12px;">
                        <i class="fas fa-info-circle"></i> 
                        <strong>Legend:</strong> 
                        <span style="color:#22c55e;">■ Green</span> = Farm 1, 
                        <span style="color:#f97316;">■ Orange</span> = Farm 2, 
                        <span style="color:#dc2626;">■ Red</span> = Conflict/Overlap Area
                        <br><strong>Tip:</strong> Use the <strong>+ / - buttons</strong> to zoom in/out. Click and drag to pan.
                    </div>
                </div>
                
                <div style="display:flex;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
                    ${alert.status === 'new' ? `
                        <button onclick="updateAlertStatus('${alert.id}', 'acknowledged'); document.querySelector('.modal-overlay').remove()" style="flex:1;padding:10px;background:#f97316;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                            <i class="fas fa-check"></i> Acknowledge
                        </button>
                        <button onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()" style="flex:1;padding:10px;background:#22c55e;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                            <i class="fas fa-check-double"></i> Resolve
                        </button>
                    ` : ''}
                    <button onclick="this.closest('.modal-overlay').remove()" style="flex:1;padding:10px;background:#e2e8f0;border:none;border-radius:8px;cursor:pointer;">Close Map</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => initOverlapMap(alert), 150);
}

function initOverlapMap(alert) {
    const mapContainer = document.getElementById('alertMap');
    if (!mapContainer) return;
    
    if (currentMap) {
        currentMap.remove();
    }
    
    const farm1Geo = alert.farmData?.geometry;
    const farm2Geo = alert.affectedFarmData?.geometry;
    let bounds = null;
    
    // Create map with zoom controls enabled
    currentMap = L.map('alertMap').setView([7.539989, -5.547080], 14);
    
    // Add zoom control to top right
    L.control.zoom({ position: 'topright' }).addTo(currentMap);
    
    // Google Satellite tiles
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Google Satellite'
    }).addTo(currentMap);
    
    // Draw Farm 1 (Green)
    if (farm1Geo?.coordinates) {
        try {
            const coords = convertToLeafletCoords(farm1Geo.coordinates);
            const polygon = L.polygon(coords, {
                color: '#22c55e',
                weight: 3,
                fillColor: '#22c55e',
                fillOpacity: 0.3
            }).addTo(currentMap);
            polygon.bindPopup(`<b>${escapeHtml(alert.farmerName)}</b><br>Farm 1 | ${alert.farmData?.area?.toFixed(2)} ha`);
            polygon.on('click', function() { this.openPopup(); });
            
            if (polygon.getBounds && polygon.getBounds().isValid()) {
                bounds = bounds ? bounds.extend(polygon.getBounds()) : polygon.getBounds();
            }
        } catch(e) { console.warn('Error drawing farm1:', e); }
    }
    
    // Draw Farm 2 (Orange)
    if (farm2Geo?.coordinates) {
        try {
            const coords = convertToLeafletCoords(farm2Geo.coordinates);
            const polygon = L.polygon(coords, {
                color: '#f97316',
                weight: 3,
                fillColor: '#f97316',
                fillOpacity: 0.3
            }).addTo(currentMap);
            polygon.bindPopup(`<b>${escapeHtml(alert.affectedFarmName)}</b><br>Farm 2 | ${alert.affectedFarmData?.area?.toFixed(2)} ha`);
            polygon.on('click', function() { this.openPopup(); });
            
            if (polygon.getBounds && polygon.getBounds().isValid()) {
                bounds = bounds ? bounds.extend(polygon.getBounds()) : polygon.getBounds();
            }
        } catch(e) { console.warn('Error drawing farm2:', e); }
    }
    
    // Draw overlap area (RED) using stored intersection coordinates
    if (alert.intersectionGeo) {
        try {
            const overlapCoords = convertToLeafletCoords(alert.intersectionGeo);
            const overlapPoly = L.polygon(overlapCoords, {
                color: '#dc2626',
                weight: 4,
                fillColor: '#dc2626',
                fillOpacity: 0.6
            }).addTo(currentMap);
            overlapPoly.bindPopup(`<b>⚠️ CONFLICT AREA</b><br>${alert.overlapArea?.toFixed(2)} hectares overlap`);
            overlapPoly.on('click', function() { this.openPopup(); });
            
            if (overlapPoly.getBounds && overlapPoly.getBounds().isValid()) {
                bounds = bounds ? bounds.extend(overlapPoly.getBounds()) : overlapPoly.getBounds();
            }
        } catch(e) { console.warn('Error drawing overlap:', e); }
    } else if (farm1Geo?.coordinates && farm2Geo?.coordinates) {
        // Calculate overlap on the fly if not stored
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
                    fillOpacity: 0.6
                }).addTo(currentMap);
                overlapPoly.bindPopup(`<b>⚠️ CONFLICT AREA</b><br>${alert.overlapArea?.toFixed(2)} hectares overlap`);
                
                if (overlapPoly.getBounds && overlapPoly.getBounds().isValid()) {
                    bounds = bounds ? bounds.extend(overlapPoly.getBounds()) : overlapPoly.getBounds();
                }
            }
        } catch(e) { console.warn('Error calculating overlap:', e); }
    }
    
    // Fit bounds to show all polygons with nice padding
    if (bounds && bounds.isValid()) {
        currentMap.fitBounds(bounds, { padding: [50, 50] });
    } else {
        // Default view for Côte d'Ivoire
        currentMap.setView([7.539989, -5.547080], 8);
    }
    
    // Add scale bar
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(currentMap);
    
    console.log('Map initialized with zoom controls and overlap area');
}

function showSingleFarmMapModal(alert) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;';
    
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:900px;width:90%;max-height:90vh;overflow-y:auto;">
            <div style="padding:20px 24px;background:linear-gradient(135deg,#1e293b,#0f172a);color:white;display:flex;justify-content:space-between;align-items:center;border-radius:16px 16px 0 0;">
                <h3 style="margin:0;"><i class="fas fa-map-marker-alt"></i> Farm Location - ${escapeHtml(alert.farmerName)}</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;">✕</button>
            </div>
            <div style="padding:24px;">
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #e2e8f0;">
                    <div><strong>Alert Type:</strong> ${alert.type.replace('-', ' ').toUpperCase()}</div>
                    <div><strong>Severity:</strong> <span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${alert.severity === 'high' ? '#f97316' : '#eab308'};color:white;font-size:12px;">${alert.severity.toUpperCase()}</span></div>
                </div>
                <div>
                    <div id="alertMap" style="height:450px;border-radius:12px;border:1px solid #e2e8f0;"></div>
                </div>
                <div style="display:flex;gap:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;">
                    <button onclick="this.closest('.modal-overlay').remove()" style="flex:1;padding:10px;background:#e2e8f0;border:none;border-radius:8px;cursor:pointer;">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => {
        if (currentMap) currentMap.remove();
        
        currentMap = L.map('alertMap').setView([7.539989, -5.547080], 14);
        L.control.zoom({ position: 'topright' }).addTo(currentMap);
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 22,
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
            
            if (polygon.getBounds && polygon.getBounds().isValid()) {
                currentMap.fitBounds(polygon.getBounds(), { padding: [50, 50] });
            }
            polygon.bindPopup(`<b>${escapeHtml(alert.farmerName)}</b><br>⚠️ ${alert.title}`);
        }
        
        L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(currentMap);
    }, 150);
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

console.log('✅ Quality Alerts page ready - overlap detection with zoom controls');
