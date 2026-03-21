// ===========================================
// QUALITY ALERTS - DIRECT ALERT GENERATION
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
// SUPABASE CONFIGURATION
// ===========================================
const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

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
    
    // Initialize Supabase and load data
    initSupabase();
    
    // Setup event listeners
    setupEventListeners();
});

function initSupabase(retryCount = 0) {
    console.log('🔧 Initializing Supabase for Quality Alerts...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 10) {
            console.log(`⏳ Waiting for Supabase... (${retryCount + 1}/10)`);
            setTimeout(() => initSupabase(retryCount + 1), 500);
            return;
        }
        console.error('❌ Supabase library failed to load');
        loadSampleAlerts();
        return;
    }
    
    try {
        window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabaseReady = true;
        console.log('✅ Supabase initialized');
        
        // Check session and load farms
        checkSessionAndLoad();
        
    } catch (error) {
        console.error('❌ Supabase init error:', error);
        if (retryCount < 5) {
            setTimeout(() => initSupabase(retryCount + 1), 1000);
        } else {
            loadSampleAlerts();
        }
    }
}

async function checkSessionAndLoad() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            console.log('⚠️ No active session, redirecting to login');
            showNotification('Please login to view alerts', 'warning');
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
            return;
        }
        
        console.log('👤 User logged in:', session.user.email);
        loadFarmsAndGenerateAlerts();
        
    } catch (error) {
        console.error('Session check error:', error);
        loadSampleAlerts();
    }
}

// ===========================================
// LOAD FARMS AND GENERATE ALERTS
// ===========================================
async function loadFarmsAndGenerateAlerts() {
    console.log('📡 Loading farms to generate alerts...');
    showNotification('Analyzing farm data...', 'info');
    
    try {
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
                farm_id: farm.farmer_id || farm.id,
                farmer_name: farm.farmer_name || 'Unknown',
                farmerName: farm.farmer_name || 'Unknown',
                cooperative: farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                area: farm.area || 0,
                status: farm.status || 'pending',
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
        showNotification('Error loading data: ' + error.message, 'error');
        loadSampleAlerts();
    }
}

// ===========================================
// ALERT GENERATION FUNCTIONS
// ===========================================

function generateAlertsFromFarms(farms) {
    const alerts = [];
    
    console.log(`Generating alerts for ${farms.length} farms...`);
    
    // 1. Detect overlaps
    const overlaps = detectOverlaps(farms);
    overlaps.forEach(overlap => {
        alerts.push({
            id: `overlap_${overlap.farm1.id}_${overlap.farm2.id}_${Date.now()}`,
            farmId: overlap.farm1.farm_id,
            farmerName: overlap.farm1.farmer_name,
            farmerId: overlap.farm1.farm_id,
            cooperative: overlap.farm1.cooperative,
            supplier: overlap.farm1.supplier,
            type: 'overlap',
            severity: overlap.severity,
            title: `${overlap.severity.toUpperCase()} Overlap: ${overlap.overlapArea.toFixed(1)}ha`,
            description: `Farm "${overlap.farm1.farmer_name}" overlaps with "${overlap.farm2.farmer_name}". Overlap area: ${overlap.overlapArea.toFixed(2)} ha (${overlap.overlapPercent}% of smaller farm).`,
            status: 'new',
            date: new Date().toISOString(),
            affectedFarmName: overlap.farm2.farmer_name,
            overlapArea: overlap.overlapArea.toFixed(2),
            overlapPercent: overlap.overlapPercent
        });
    });
    
    // 2. Check each farm for self-intersection
    farms.forEach(farm => {
        if (farm.geometry) {
            const selfIntersection = checkSelfIntersection(farm.geometry, farm);
            if (selfIntersection) {
                alerts.push(selfIntersection);
            }
        }
    });
    
    // 3. Check for missing geometry
    farms.forEach(farm => {
        if (!farm.geometry && farm.status !== 'rejected') {
            alerts.push({
                id: `missing_geom_${farm.id}_${Date.now()}`,
                farmId: farm.farm_id,
                farmerName: farm.farmer_name,
                farmerId: farm.farm_id,
                cooperative: farm.cooperative,
                supplier: farm.supplier,
                type: 'data',
                severity: 'high',
                title: 'Missing Geometry Data',
                description: `Farm "${farm.farmer_name}" has no geometry data. Cannot display on map or calculate area.`,
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    // 4. Check for missing required data
    farms.forEach(farm => {
        const missingFields = [];
        if (!farm.farmer_name || farm.farmer_name === 'Unknown') missingFields.push('Farmer Name');
        if (!farm.farm_id) missingFields.push('Farmer ID');
        
        if (missingFields.length > 0) {
            alerts.push({
                id: `missing_data_${farm.id}_${Date.now()}`,
                farmId: farm.farm_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                farmerId: farm.farm_id || farm.id,
                cooperative: farm.cooperative,
                supplier: farm.supplier,
                type: 'data',
                severity: 'medium',
                title: 'Missing Required Data',
                description: `Missing fields: ${missingFields.join(', ')}. Please complete the farm information.`,
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    // 5. Check for area issues
    farms.forEach(farm => {
        if (farm.area === 0 || (farm.area && farm.area < 0.1)) {
            alerts.push({
                id: `small_area_${farm.id}_${Date.now()}`,
                farmId: farm.farm_id,
                farmerName: farm.farmer_name,
                farmerId: farm.farm_id,
                cooperative: farm.cooperative,
                supplier: farm.supplier,
                type: 'area',
                severity: 'low',
                title: 'Very Small Area',
                description: `Farm area is ${farm.area.toFixed(2)} ha. This seems unusually small.`,
                status: 'new',
                date: new Date().toISOString()
            });
        } else if (farm.area && farm.area > 100) {
            alerts.push({
                id: `large_area_${farm.id}_${Date.now()}`,
                farmId: farm.farm_id,
                farmerName: farm.farmer_name,
                farmerId: farm.farm_id,
                cooperative: farm.cooperative,
                supplier: farm.supplier,
                type: 'area',
                severity: 'medium',
                title: 'Unusually Large Area',
                description: `Farm area is ${farm.area.toFixed(2)} ha. Please verify this is correct.`,
                status: 'new',
                date: new Date().toISOString()
            });
        }
    });
    
    console.log(`Generated ${alerts.length} alerts`);
    return alerts;
}

function detectOverlaps(farms) {
    const overlaps = [];
    const farmsWithGeo = farms.filter(f => f.geometry && f.geometry.coordinates);
    
    for (let i = 0; i < farmsWithGeo.length; i++) {
        for (let j = i + 1; j < farmsWithGeo.length; j++) {
            const farm1 = farmsWithGeo[i];
            const farm2 = farmsWithGeo[j];
            
            try {
                // Create Turf polygons
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
                            const overlapPercent = (overlapArea / smallerArea) * 100;
                            
                            let severity = 'low';
                            if (overlapArea > 5) severity = 'critical';
                            else if (overlapArea >= 5) severity = 'high';
                            else if (overlapArea > 1) severity = 'medium';
                            
                            overlaps.push({
                                farm1: farm1,
                                farm2: farm2,
                                overlapArea: overlapArea,
                                overlapPercent: Math.round(overlapPercent),
                                severity: severity
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn('Error checking overlap:', e);
            }
        }
    }
    
    return overlaps;
}

function checkSelfIntersection(geometry, farm) {
    try {
        const polygon = turf.polygon(geometry.coordinates);
        const isValid = turf.booleanValid(polygon);
        
        if (!isValid) {
            let intersectionCount = 0;
            try {
                const kinks = turf.kinks(polygon);
                if (kinks && kinks.features) {
                    intersectionCount = kinks.features.length;
                }
            } catch (e) {
                intersectionCount = 1;
            }
            
            const area = turf.area(polygon) / 10000;
            
            let severity = 'low';
            if (intersectionCount > 3 || area > 10) severity = 'critical';
            else if (intersectionCount > 1 || area > 5) severity = 'high';
            else if (area > 1) severity = 'medium';
            
            return {
                id: `self_intersection_${farm.id}_${Date.now()}`,
                farmId: farm.farm_id,
                farmerName: farm.farmer_name,
                farmerId: farm.farm_id,
                cooperative: farm.cooperative,
                supplier: farm.supplier,
                type: 'self-intersection',
                severity: severity,
                title: `${severity.toUpperCase()} Self-Intersection: ${area.toFixed(1)}ha (${intersectionCount} pts)`,
                description: `Self-intersecting polygon detected with ${intersectionCount} intersection point(s). Area affected: ${area.toFixed(2)} ha.`,
                status: 'new',
                date: new Date().toISOString(),
                selfIntersectionCount: intersectionCount,
                selfIntersectionArea: area.toFixed(2)
            };
        }
    } catch (e) {
        console.warn('Error checking self-intersection:', e);
    }
    
    return null;
}

// ===========================================
// SAMPLE ALERTS (Fallback when no farms)
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
        }
    ];
    
    updateFilterOptions();
    applyFilters();
    showNotification('No farms found. Using sample alerts (demo mode)', 'info');
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
                <h3><i class="fas ${getSeverityIcon(alert.severity)}"></i> ${escapeHtml(alert.title)}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="modal-row"><div class="modal-label">Farm:</div><div class="modal-value">${escapeHtml(alert.farmerName)}</div></div>
                ${alert.affectedFarmName ? `<div class="modal-row"><div class="modal-label">Affected:</div><div class="modal-value">${escapeHtml(alert.affectedFarmName)}</div></div>` : ''}
                <div class="modal-row"><div class="modal-label">Supplier:</div><div class="modal-value">${escapeHtml(alert.supplier)}</div></div>
                <div class="modal-row"><div class="modal-label">Cooperative:</div><div class="modal-value">${escapeHtml(alert.cooperative)}</div></div>
                <div class="modal-row"><div class="modal-label">Type:</div><div class="modal-value">${alert.type.replace('_', ' ').toUpperCase()}</div></div>
                <div class="modal-row"><div class="modal-label">Severity:</div><div class="modal-value">${alert.severity.toUpperCase()}</div></div>
                <div class="modal-row"><div class="modal-label">Status:</div><div class="modal-value">${alert.status.toUpperCase()}</div></div>
                <div class="modal-row"><div class="modal-label">Date:</div><div class="modal-value">${new Date(alert.date).toLocaleString()}</div></div>
                ${alert.overlapArea ? `<div class="modal-row"><div class="modal-label">Overlap Area:</div><div class="modal-value">${alert.overlapArea} ha (${alert.overlapPercent}%)</div></div>` : ''}
                ${alert.selfIntersectionCount ? `<div class="modal-row"><div class="modal-label">Intersection Points:</div><div class="modal-value">${alert.selfIntersectionCount}</div></div>` : ''}
                <div class="modal-row"><div class="modal-label">Description:</div><div class="modal-value">${escapeHtml(alert.description)}</div></div>
                ${alert.status === 'new' ? `
                    <div class="modal-actions">
                        <button class="modal-btn acknowledge" onclick="updateAlertStatus('${alert.id}', 'acknowledged'); document.querySelector('.modal-overlay').remove()"><i class="fas fa-check"></i> Acknowledge</button>
                        <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()"><i class="fas fa-check-double"></i> Resolve</button>
                        <button class="modal-btn ignore" onclick="updateAlertStatus('${alert.id}', 'ignored'); document.querySelector('.modal-overlay').remove()"><i class="fas fa-times"></i> Ignore</button>
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    </div>
                ` : alert.status === 'acknowledged' ? `
                    <div class="modal-actions">
                        <button class="modal-btn resolve" onclick="updateAlertStatus('${alert.id}', 'resolved'); document.querySelector('.modal-overlay').remove()"><i class="fas fa-check-double"></i> Mark Resolved</button>
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                ` : `
                    <div class="modal-actions">
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

// ===========================================
// EXPORT FUNCTIONS
// ===========================================
function exportToCSV() {
    const headers = ['ID', 'Farm Name', 'Supplier', 'Cooperative', 'Type', 'Severity', 'Status', 'Description', 'Date'];
    const rows = filteredAlerts.map(alert => [
        alert.id, alert.farmerName, alert.supplier, alert.cooperative, alert.type,
        alert.severity, alert.status, alert.description, new Date(alert.date).toLocaleString()
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `quality_alerts_${new Date().toISOString().split('T')[0]}.csv`);
    showNotification('Exported to CSV', 'success');
}

function exportToJSON() {
    const data = filteredAlerts.map(alert => ({
        id: alert.id, farmName: alert.farmerName, supplier: alert.supplier, cooperative: alert.cooperative,
        type: alert.type, severity: alert.severity, status: alert.status, description: alert.description, date: alert.date
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
    const icons = { critical: 'fa-skull-crossbones', high: 'fa-exclamation-triangle', medium: 'fa-exclamation', low: 'fa-info-circle' };
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
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showNotification(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    const colors = { success: '#4CAF50', error: '#F44336', warning: '#FFC107', info: '#2196F3' };
    const notification = document.createElement('div');
    notification.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 24px;background:${colors[type]};color:white;border-radius:8px;z-index:10001;animation:slideIn 0.3s ease;font-size:14px;font-weight:500;`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ===========================================
// EVENT LISTENERS
// ===========================================
function setupEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', () => loadFarmsAndGenerateAlerts());
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
    document.getElementById('supplierSearch')?.addEventListener('input', (e) => { supplierSearchTerm = e.target.value.toLowerCase(); updateSupplierFilter(); applyFilters(); });
    document.getElementById('coopSearch')?.addEventListener('input', (e) => { coopSearchTerm = e.target.value.toLowerCase(); updateCooperativeFilter(); applyFilters(); });
    document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderAlerts(); updatePagination(); } });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => { const total = Math.ceil(filteredAlerts.length / rowsPerPage); if (currentPage < total) { currentPage++; renderAlerts(); updatePagination(); } });
    document.getElementById('exportCSV')?.addEventListener('click', () => exportToCSV());
    document.getElementById('exportJSON')?.addEventListener('click', () => exportToJSON());
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        if (confirm('Mark all new alerts as acknowledged?')) {
            allAlerts.forEach(alert => { if (alert.status === 'new') alert.status = 'acknowledged'; });
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

console.log('✅ Quality Alerts page ready - generating alerts directly from farm data');
