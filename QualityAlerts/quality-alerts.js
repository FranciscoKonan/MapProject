// ===========================================
// QUALITY ALERTS - MATCHING DASHBOARD ALERTS
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
// ALERT GENERATION FUNCTIONS (Matching Dashboard)
// ===========================================

// Function to detect overlaps between farms
function detectOverlaps(farms) {
    const overlaps = [];
    
    for (let i = 0; i < farms.length; i++) {
        for (let j = i + 1; j < farms.length; j++) {
            const farm1 = farms[i];
            const farm2 = farms[j];
            
            // Only check farms with valid geometries
            if (farm1.geometry && farm2.geometry) {
                try {
                    const geom1 = typeof farm1.geometry === 'string' ? JSON.parse(farm1.geometry) : farm1.geometry;
                    const geom2 = typeof farm2.geometry === 'string' ? JSON.parse(farm2.geometry) : farm2.geometry;
                    
                    // Check if polygons intersect
                    if (checkPolygonsIntersect(geom1, geom2)) {
                        overlaps.push({
                            farm1: farm1,
                            farm2: farm2,
                            severity: determineOverlapSeverity(geom1, geom2)
                        });
                    }
                } catch (e) {
                    console.error('Error checking overlap:', e);
                }
            }
        }
    }
    
    return overlaps;
}

// Check if two polygons intersect
function checkPolygonsIntersect(polygon1, polygon2) {
    if (!polygon1 || !polygon2) return false;
    if (!polygon1.coordinates || !polygon2.coordinates) return false;
    if (!polygon1.coordinates[0] || !polygon2.coordinates[0]) return false;
    
    // Simple bounding box check first
    const bounds1 = getBoundingBox(polygon1);
    const bounds2 = getBoundingBox(polygon2);
    
    if (!boxesIntersect(bounds1, bounds2)) return false;
    
    // Check if any point of polygon1 is inside polygon2
    for (const point of polygon1.coordinates[0]) {
        if (isPointInPolygon(point, polygon2)) {
            return true;
        }
    }
    
    // Check if any point of polygon2 is inside polygon1
    for (const point of polygon2.coordinates[0]) {
        if (isPointInPolygon(point, polygon1)) {
            return true;
        }
    }
    
    return false;
}

function getBoundingBox(polygon) {
    const coords = polygon.coordinates[0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const [x, y] of coords) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    
    return { minX, minY, maxX, maxY };
}

function boxesIntersect(box1, box2) {
    return !(box2.minX > box1.maxX ||
             box2.maxX < box1.minX ||
             box2.minY > box1.maxY ||
             box2.maxY < box1.minY);
}

function isPointInPolygon(point, polygon) {
    const x = point[0];
    const y = point[1];
    const coords = polygon.coordinates[0];
    let inside = false;
    
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        const xi = coords[i][0], yi = coords[i][1];
        const xj = coords[j][0], yj = coords[j][1];
        
        const intersect = ((yi > y) != (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

function determineOverlapSeverity(geom1, geom2) {
    // Calculate overlap area (simplified)
    try {
        const area1 = calculatePolygonArea(geom1);
        const area2 = calculatePolygonArea(geom2);
        const minArea = Math.min(area1, area2);
        
        if (minArea > 10) return 'critical';
        if (minArea > 5) return 'high';
        if (minArea > 2) return 'medium';
        return 'low';
    } catch (e) {
        return 'medium';
    }
}

function calculatePolygonArea(polygon) {
    if (!polygon || !polygon.coordinates || !polygon.coordinates[0]) return 0;
    
    const coords = polygon.coordinates[0];
    let area = 0;
    
    for (let i = 0; i < coords.length; i++) {
        const j = (i + 1) % coords.length;
        area += coords[i][0] * coords[j][1];
        area -= coords[j][0] * coords[i][1];
    }
    
    return Math.abs(area) / 2;
}

// Check for self-intersection
function checkSelfIntersection(geometry) {
    if (!geometry || !geometry.coordinates || !geometry.coordinates[0]) return false;
    
    const coords = geometry.coordinates[0];
    
    // Check if polygon is closed
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        return true;
    }
    
    // Check for self-intersection (simplified)
    for (let i = 0; i < coords.length - 2; i++) {
        for (let j = i + 2; j < coords.length - 1; j++) {
            if (segmentsIntersect(
                coords[i], coords[i + 1],
                coords[j], coords[j + 1]
            )) {
                return true;
            }
        }
    }
    
    return false;
}

function segmentsIntersect(p1, p2, p3, p4) {
    const orientation = (p, q, r) => {
        const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
        if (val === 0) return 0;
        return val > 0 ? 1 : 2;
    };
    
    const o1 = orientation(p1, p2, p3);
    const o2 = orientation(p1, p2, p4);
    const o3 = orientation(p3, p4, p1);
    const o4 = orientation(p3, p4, p2);
    
    if (o1 !== o2 && o3 !== o4) return true;
    
    return false;
}

// Main alert generation function
function generateAlertsFromFarms(farms) {
    const alerts = [];
    
    console.log(`Generating alerts for ${farms.length} farms...`);
    
    // 1. Detect overlaps
    const overlaps = detectOverlaps(farms);
    overlaps.forEach(overlap => {
        alerts.push({
            id: `overlap_${overlap.farm1.id}_${overlap.farm2.id}`,
            farmId: `${overlap.farm1.farmer_id || overlap.farm1.id}, ${overlap.farm2.farmer_id || overlap.farm2.id}`,
            farmerName: `${overlap.farm1.farmer_name || 'Unknown'} & ${overlap.farm2.farmer_name || 'Unknown'}`,
            farmerId: overlap.farm1.farmer_id || overlap.farm1.id,
            cooperative: overlap.farm1.cooperative || overlap.farm2.cooperative || 'Unassigned',
            supplier: overlap.farm1.supplier || overlap.farm2.supplier || 'Unknown',
            type: 'overlap',
            severity: overlap.severity,
            title: 'Farm Overlap Detected',
            description: `Farm "${overlap.farm1.farmer_name || 'Unknown'}" overlaps with "${overlap.farm2.farmer_name || 'Unknown'}". This may cause double-counting issues.`,
            status: 'new',
            date: new Date().toISOString(),
            affectedFarms: [overlap.farm1.id, overlap.farm2.id]
        });
    });
    
    // 2. Check each farm for individual issues
    farms.forEach(farm => {
        // Check for self-intersection
        if (farm.geometry && checkSelfIntersection(farm.geometry)) {
            alerts.push({
                id: `self_intersection_${farm.id}`,
                farmId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || farm.id,
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'self_intersection',
                severity: 'critical',
                title: 'Self-Intersecting Polygon',
                description: `Farm polygon is self-intersecting. This indicates a geometry error that needs correction.`,
                status: 'new',
                date: new Date().toISOString(),
                farmId: farm.id
            });
        }
        
        // Check for missing geometry
        if (!farm.geometry && farm.status !== 'rejected') {
            alerts.push({
                id: `missing_geometry_${farm.id}`,
                farmId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || farm.id,
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'data',
                severity: 'high',
                title: 'Missing Geometry Data',
                description: `Farm has no geometry data. Cannot display on map or calculate area.`,
                status: 'new',
                date: new Date().toISOString(),
                farmId: farm.id
            });
        }
        
        // Check for missing required fields
        const missingFields = [];
        if (!farm.farmer_name) missingFields.push('Farmer Name');
        if (!farm.farmer_id) missingFields.push('Farmer ID');
        
        if (missingFields.length > 0) {
            alerts.push({
                id: `missing_data_${farm.id}`,
                farmId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || farm.id,
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'data',
                severity: 'medium',
                title: 'Missing Required Data',
                description: `Missing fields: ${missingFields.join(', ')}. Please complete the farm information.`,
                status: 'new',
                date: new Date().toISOString(),
                farmId: farm.id
            });
        }
        
        // Check for area mismatch (area is 0 or very small)
        if ((!farm.area || farm.area === 0) && farm.geometry) {
            alerts.push({
                id: `area_missing_${farm.id}`,
                farmId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || farm.id,
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'area',
                severity: 'medium',
                title: 'Area Not Calculated',
                description: `Farm area is not calculated. The geometry exists but area is missing.`,
                status: 'new',
                date: new Date().toISOString(),
                farmId: farm.id
            });
        }
        
        // Check for suspiciously large area
        if (farm.area && farm.area > 100) {
            alerts.push({
                id: `large_area_${farm.id}`,
                farmId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farmer_id || farm.id,
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                type: 'area',
                severity: 'low',
                title: 'Unusually Large Area',
                description: `Farm area is ${farm.area.toFixed(2)} ha, which is unusually large. Please verify.`,
                status: 'new',
                date: new Date().toISOString(),
                farmId: farm.id
            });
        }
    });
    
    console.log(`Generated ${alerts.length} alerts`);
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
    showNotification('Analyzing farm data...', 'info');
    
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
            .select('*');
        
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
            farmId: 'F12345, F12346',
            farmerName: 'Koffi Jean & Konan Marie',
            farmerId: 'F12345',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            type: 'overlap',
            severity: 'critical',
            title: 'Farm Overlap Detected',
            description: 'Farm "Koffi Jean" overlaps with farm "Konan Marie". Overlap area: 0.45 ha. This may cause double-counting issues.',
            status: 'new',
            date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '2',
            farmId: 'F12347',
            farmerName: 'N\'Guessan Paul',
            farmerId: 'F12347',
            cooperative: 'COOP-CI',
            supplier: 'Other',
            type: 'self_intersection',
            severity: 'critical',
            title: 'Self-Intersecting Polygon',
            description: 'Farm polygon is self-intersecting. This indicates a geometry error that needs correction.',
            status: 'new',
            date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '3',
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
            id: '4',
            farmId: 'F12349',
            farmerName: 'Traore Amadou',
            farmerId: 'F12349',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            type: 'data',
            severity: 'medium',
            title: 'Missing Required Data',
            description: 'Missing fields: Farmer Name. Please complete the farm information.',
            status: 'acknowledged',
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '5',
            farmId: 'F12350',
            farmerName: 'Kouassi Alphonse',
            farmerId: 'F12350',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            type: 'area',
            severity: 'low',
            title: 'Unusually Large Area',
            description: 'Farm area is 125.30 ha, which is unusually large. Please verify.',
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
    const exportCount = document.getElementById('exportCount');
    if (exportCount) exportCount.textContent = `${filteredAlerts.length} alerts`;
    
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
    
    const criticalEl = document.getElementById('criticalCount');
    const highEl = document.getElementById('highCount');
    const mediumEl = document.getElementById('mediumCount');
    const lowEl = document.getElementById('lowCount');
    const totalEl = document.getElementById('totalAlerts');
    
    if (criticalEl) criticalEl.textContent = critical;
    if (highEl) highEl.textContent = high;
    if (mediumEl) mediumEl.textContent = medium;
    if (lowEl) lowEl.textContent = low;
    if (totalEl) totalEl.textContent = total;
    
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
                <p><strong>${alert.type === 'overlap' ? 'Affected Farms' : 'Farm'}:</strong> ${escapeHtml(alert.farmerName)}</p>
                <p><strong>Supplier:</strong> ${escapeHtml(alert.supplier)} • <strong>Cooperative:</strong> ${escapeHtml(alert.cooperative)}</p>
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
                    <div class="modal-label">${alert.type === 'overlap' ? 'Affected Farms' : 'Farm'}:</div>
                    <div class="modal-value">${escapeHtml(alert.farmerName)}</div>
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
                    <div class="modal-value">${alert.type.replace('_', ' ').toUpperCase()}</div>
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
    if (!str)
