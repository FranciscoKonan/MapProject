// ===========================================
// LIVE MAPPING - COMPLETE APPLICATION
// ===========================================

console.log('🚀 Live Mapping initializing...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let map;
let allFarms = [];
let filteredFarms = [];
let farmLayers = new Map();
let uniqueSuppliers = [];
let uniqueCooperatives = [];
let selectedFarm = null;
let supplierSearchTerm = '';
let coopSearchTerm = '';
let supabaseReady = false;

// ===========================================
// INITIALIZATION - WAIT FOR SUPABASE
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 DOM Content Loaded');
    
    // Listen for Supabase ready
    window.addEventListener('supabase-ready', function() {
        console.log('✅ Supabase ready event received');
        supabaseReady = true;
        initializeApp();
    });
    
    // Also check if already ready
    setTimeout(function() {
        if (window.supabase && !supabaseReady) {
            console.log('✅ Supabase already ready');
            supabaseReady = true;
            initializeApp();
        }
    }, 500);
});

function initializeApp() {
    console.log('🚀 Initializing Live Mapping app...');
    initMap();
    initSearchListeners();
    loadFarms();
}

// ===========================================
// MAP INITIALIZATION
// ===========================================
function initMap() {
    console.log('🗺️ Creating map...');
    
    try {
        const mapElement = document.getElementById('liveMap');
        if (!mapElement) {
            console.error('❌ Map element not found');
            return;
        }
        
        map = L.map('liveMap', {
            center: [7.539989, -5.547080],
            zoom: 8,
            zoomControl: false
        });

        // Add satellite layer (default)
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        }).addTo(map);

        // Add scale control
        L.control.scale({ imperial: false, metric: true }).addTo(map);
        
        // Store map globally
        window.map = map;

        // Mouse move for coordinates
        map.on('mousemove', function(e) {
            const latEl = document.getElementById('mouseLat');
            const lngEl = document.getElementById('mouseLng');
            if (latEl) latEl.textContent = e.latlng.lat.toFixed(4);
            if (lngEl) lngEl.textContent = e.latlng.lng.toFixed(4);
        });

        map.on('zoomend', function() {
            const zoomEl = document.getElementById('currentZoom');
            if (zoomEl) zoomEl.textContent = map.getZoom();
        });

        console.log('✅ Map created');
        
        // Force map to resize properly
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                console.log('🗺️ Map size invalidated');
            }
        }, 200);
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
        
    } catch (error) {
        console.error('❌ Map error:', error);
    }
}

// ===========================================
// SEARCH LISTENERS FOR SUPPLIER AND COOPERATIVE
// ===========================================
function initSearchListeners() {
    const supplierSearch = document.getElementById('supplierSearch');
    const coopSearch = document.getElementById('coopSearch');
    
    if (supplierSearch) {
        supplierSearch.addEventListener('input', (e) => {
            supplierSearchTerm = e.target.value.toLowerCase();
            updateSupplierFilter();
        });
    }
    
    if (coopSearch) {
        coopSearch.addEventListener('input', (e) => {
            coopSearchTerm = e.target.value.toLowerCase();
            updateCooperativeFilter();
        });
    }
}

function updateSupplierFilter() {
    const select = document.getElementById('supplierFilter');
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
    const select = document.getElementById('cooperativeFilter');
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
// LOAD FARMS FROM SUPABASE
// ===========================================
async function loadFarms() {
    console.log('📡 Loading farms from Supabase...');
    
    // Show loading indicator
    showNotification('Loading farms...', 'info');
    
    try {
        // Check if supabase is available
        if (!window.supabase || !window.supabase.auth) {
            console.error('❌ Supabase not available');
            loadSampleData();
            return;
        }
        
        // Get current user session
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            console.log('⚠️ No active session, redirecting to login');
            showNotification('Please login to view farms', 'warning');
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
            return;
        }
        
        console.log('👤 User logged in:', session.user.email);
        
        // Fetch farms from Supabase
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            showNotification('Error loading farms: ' + error.message, 'error');
            loadSampleData();
            return;
        }

        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms from Supabase`);
            console.log('📋 Sample farm:', farms[0]);
            
            // Transform farms data
            allFarms = farms.map(farm => ({
                id: farm.id,
                farmId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown Farmer',
                farmerId: farm.farmer_id || 'N/A',
                cooperative: farm.cooperative || farm.cooperative_name || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                area: farm.area || 0,
                status: farm.status || 'pending',
                submissionDate: farm.submission_date || farm.created_at || new Date().toISOString(),
                enumerator: farm.enumerator || 'N/A',
                geometry: farm.geometry
            }));
            
            // Update filter options
            updateFilterOptions();
            
            filteredFarms = [...allFarms];
            displayFarms(filteredFarms);
            updateStats(filteredFarms);
            updateTimeline(filteredFarms);
            
            showNotification(`Loaded ${allFarms.length} farms`, 'success');
        } else {
            console.log('⚠️ No farms found in Supabase, loading sample data');
            loadSampleData();
        }
        
    } catch (error) {
        console.error('Error loading farms:', error);
        showNotification('Error loading farms: ' + error.message, 'error');
        loadSampleData();
    }
}

// ===========================================
// SAMPLE DATA
// ===========================================
function loadSampleData() {
    console.log('📊 Loading sample data');
    
    allFarms = [
        {
            id: '1',
            farmId: 'F12345',
            farmerName: 'Koffi Jean',
            farmerId: 'F12345',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            area: 2.5,
            status: 'validated',
            enumerator: 'EN001',
            submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.567080, 7.519989],
                    [-5.547080, 7.519989],
                    [-5.547080, 7.539989],
                    [-5.567080, 7.539989],
                    [-5.567080, 7.519989]
                ]]
            }
        },
        {
            id: '2',
            farmId: 'F12346',
            farmerName: 'Konan Marie',
            farmerId: 'F12346',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            area: 1.8,
            status: 'pending',
            enumerator: 'EN002',
            submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.527080, 7.529989],
                    [-5.507080, 7.529989],
                    [-5.507080, 7.549989],
                    [-5.527080, 7.549989],
                    [-5.527080, 7.529989]
                ]]
            }
        },
        {
            id: '3',
            farmId: 'F12347',
            farmerName: 'N\'Guessan Paul',
            farmerId: 'F12347',
            cooperative: 'COOP-CI',
            supplier: 'Other',
            area: 3.2,
            status: 'rejected',
            enumerator: 'EN003',
            submissionDate: new Date().toISOString(),
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.587080, 7.509989],
                    [-5.567080, 7.509989],
                    [-5.567080, 7.529989],
                    [-5.587080, 7.529989],
                    [-5.587080, 7.509989]
                ]]
            }
        },
        {
            id: '4',
            farmId: 'F12348',
            farmerName: 'Yao Michel',
            farmerId: 'F12348',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            area: 4.1,
            status: 'validated',
            enumerator: 'EN001',
            submissionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.607080, 7.489989],
                    [-5.587080, 7.489989],
                    [-5.587080, 7.509989],
                    [-5.607080, 7.509989],
                    [-5.607080, 7.489989]
                ]]
            }
        },
        {
            id: '5',
            farmId: 'F12349',
            farmerName: 'Traore Amadou',
            farmerId: 'F12349',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            area: 1.2,
            status: 'pending',
            enumerator: 'EN002',
            submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.487080, 7.559989],
                    [-5.467080, 7.559989],
                    [-5.467080, 7.579989],
                    [-5.487080, 7.579989],
                    [-5.487080, 7.559989]
                ]]
            }
        }
    ];
    
    updateFilterOptions();
    filteredFarms = [...allFarms];
    displayFarms(filteredFarms);
    updateStats(filteredFarms);
    updateTimeline(filteredFarms);
    
    showNotification('Using sample data (demo mode)', 'info');
}

// ===========================================
// UPDATE FILTER OPTIONS
// ===========================================
function updateFilterOptions() {
    uniqueSuppliers = [...new Set(allFarms.map(f => f.supplier))].sort();
    uniqueCooperatives = [...new Set(allFarms.map(f => f.cooperative))].sort();
    
    // Update select dropdowns
    updateSupplierFilter();
    updateCooperativeFilter();
    
    console.log('📊 Suppliers:', uniqueSuppliers);
    console.log('📊 Cooperatives:', uniqueCooperatives);
}

// ===========================================
// DISPLAY FARMS ON MAP
// ===========================================
function displayFarms(farms) {
    if (!map) {
        console.warn('⚠️ Map not ready');
        return;
    }
    
    // Clear existing layers
    farmLayers.forEach(layer => map.removeLayer(layer));
    farmLayers.clear();
    
    let addedCount = 0;
    
    farms.forEach(farm => {
        if (!farm.geometry) return;
        
        try {
            const geom = typeof farm.geometry === 'string' 
                ? JSON.parse(farm.geometry) 
                : farm.geometry;
            
            const color = getStatusColor(farm.status);
            
            const polygon = L.geoJSON(geom, {
                style: { 
                    color, 
                    weight: 2, 
                    fillColor: color, 
                    fillOpacity: 0.3 
                }
            }).addTo(map);
            
            polygon.farmData = farm;
            farmLayers.set(farm.id, polygon);
            
            polygon.bindPopup(`
                <div style="padding: 8px; min-width: 180px;">
                    <b style="font-size: 14px; color: #2c6e49;">${farm.farmerName}</b><br>
                    <small>ID: ${farm.farmId}</small><br>
                    <small>Coop: ${farm.cooperative}</small><br>
                    <small>Area: ${farm.area.toFixed(2)} ha</small><br>
                    <small>Status: <span style="color: ${color}; font-weight: 600;">${farm.status}</span></small>
                </div>
            `);
            
            polygon.on('click', () => showFarmDetails(farm));
            
            addedCount++;
            
        } catch (e) {
            console.error('Error adding farm:', e);
        }
    });
    
    console.log(`✅ Added ${addedCount} farms to map`);
    
    // Zoom to fit all farms if there are any
    if (addedCount > 0 && farmLayers.size > 0) {
        setTimeout(() => {
            const bounds = L.latLngBounds();
            farmLayers.forEach(layer => {
                if (layer.getBounds && layer.getBounds().isValid()) {
                    bounds.extend(layer.getBounds());
                }
            });
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }, 500);
    }
}

// ===========================================
// SHOW FARM DETAILS
// ===========================================
function showFarmDetails(farm) {
    selectedFarm = farm;
    
    const panel = document.getElementById('propertiesPanel');
    const content = document.getElementById('propertyContent');
    
    if (panel) panel.classList.remove('hidden');
    
    const statusColor = getStatusColor(farm.status);
    
    if (content) {
        content.innerHTML = `
            <div class="farm-detail-card">
                <div class="detail-header" style="background: ${statusColor}20; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                    <i class="fas fa-tractor" style="color: ${statusColor}; font-size: 28px;"></i>
                    <h3 style="margin: 10px 0 0 0; font-size: 18px;">${farm.farmerName}</h3>
                </div>
                
                <div class="detail-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #2c6e49; font-size: 14px;"><i class="fas fa-id-card"></i> Identification</h4>
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span class="detail-label" style="color: #64748b;">Farm ID:</span>
                        <span class="detail-value" style="font-weight: 600;">${farm.farmId}</span>
                    </div>
                    <div class="detail-row" style="display: flex; justify-content: space-between;">
                        <span class="detail-label" style="color: #64748b;">Farmer ID:</span>
                        <span class="detail-value" style="font-weight: 600;">${farm.farmerId}</span>
                    </div>
                </div>
                
                <div class="detail-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #2c6e49; font-size: 14px;"><i class="fas fa-building"></i> Organization</h4>
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span class="detail-label" style="color: #64748b;">Cooperative:</span>
                        <span class="detail-value" style="font-weight: 600;">${farm.cooperative}</span>
                    </div>
                    <div class="detail-row" style="display: flex; justify-content: space-between;">
                        <span class="detail-label" style="color: #64748b;">Supplier:</span>
                        <span class="detail-value" style="font-weight: 600;">${farm.supplier}</span>
                    </div>
                </div>
                
                <div class="detail-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #2c6e49; font-size: 14px;"><i class="fas fa-ruler-combined"></i> Measurements</h4>
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span class="detail-label" style="color: #64748b;">Area:</span>
                        <span class="detail-value highlight" style="font-weight: 600; color: #2c6e49;">${farm.area.toFixed(2)} ha</span>
                    </div>
                    <div class="detail-row" style="display: flex; justify-content: space-between;">
                        <span class="detail-label" style="color: #64748b;">Status:</span>
                        <span class="detail-value">
                            <span class="status-badge ${farm.status}" style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${farm.status}</span>
                        </span>
                    </div>
                </div>
                
                <div class="detail-section" style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #2c6e49; font-size: 14px;"><i class="fas fa-calendar"></i> Submission</h4>
                    <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span class="detail-label" style="color: #64748b;">Date:</span>
                        <span class="detail-value" style="font-weight: 600;">${new Date(farm.submissionDate).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row" style="display: flex; justify-content: space-between;">
                        <span class="detail-label" style="color: #64748b;">Enumerator:</span>
                        <span class="detail-value" style="font-weight: 600;">${farm.enumerator}</span>
                    </div>
                </div>
                
                <div class="detail-actions" style="margin-top: 20px;">
                    <button class="btn-primary" onclick="window.zoomToFarm('${farm.id}')" style="width: 100%; padding: 12px; background: #2c6e49; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-search"></i> Zoom to Farm
                    </button>
                </div>
            </div>
        `;
    }
}

// ===========================================
// APPLY FILTERS
// ===========================================
function applyFilters() {
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const cooperative = document.getElementById('cooperativeFilter')?.value || 'all';
    
    const statuses = [];
    document.querySelectorAll('.status-filter:checked').forEach(cb => {
        statuses.push(cb.value);
    });
    
    filteredFarms = allFarms.filter(farm => {
        if (supplier !== 'all' && farm.supplier !== supplier) return false;
        if (cooperative !== 'all' && farm.cooperative !== cooperative) return false;
        if (statuses.length > 0 && !statuses.includes(farm.status)) return false;
        return true;
    });
    
    console.log(`📊 Filtered to ${filteredFarms.length} farms`);
    
    displayFarms(filteredFarms);
    updateStats(filteredFarms);
    updateTimeline(filteredFarms);
    
    showNotification(`Showing ${filteredFarms.length} farms`, 'info');
}

// ===========================================
// UPDATE STATISTICS
// ===========================================
function updateStats(farms) {
    let totalArea = 0;
    let validated = 0, pending = 0, rejected = 0;
    
    farms.forEach(f => {
        totalArea += f.area || 0;
        if (f.status === 'validated') validated++;
        else if (f.status === 'pending') pending++;
        else if (f.status === 'rejected') rejected++;
    });
    
    const totalEl = document.getElementById('statTotal');
    const areaEl = document.getElementById('statArea');
    const avgEl = document.getElementById('statAvg');
    
    if (totalEl) totalEl.textContent = farms.length;
    if (areaEl) areaEl.textContent = totalArea.toFixed(1) + ' ha';
    if (avgEl) avgEl.textContent = farms.length ? (totalArea / farms.length).toFixed(1) + ' ha' : '0 ha';
}

// ===========================================
// UPDATE TIMELINE
// ===========================================
function updateTimeline(farms) {
    const timeline = document.getElementById('timelineItems');
    if (!timeline) return;
    
    const recent = [...farms]
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate))
        .slice(0, 5);
    
    if (recent.length === 0) {
        timeline.innerHTML = '<div class="empty-state" style="text-align: center; padding: 20px; color: #94a3b8;">No recent submissions</div>';
        return;
    }
    
    timeline.innerHTML = recent.map(farm => `
        <div class="timeline-item" onclick="window.zoomToFarm('${farm.id}')" style="cursor: pointer; padding: 10px 12px; background: #f8fafc; border-radius: 10px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; transition: all 0.2s;">
            <div class="timeline-icon" style="width: 36px; height: 36px; background: ${getStatusColor(farm.status)}; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-tractor" style="color: white; font-size: 16px;"></i>
            </div>
            <div class="timeline-content" style="flex: 1;">
                <div class="timeline-title" style="font-weight: 600; font-size: 13px; color: #1e293b;">${farm.farmerName}</div>
                <div class="timeline-subtitle" style="font-size: 11px; color: #64748b;">
                    ${farm.area.toFixed(1)} ha • ${new Date(farm.submissionDate).toLocaleDateString()}
                </div>
            </div>
        </div>
    `).join('');
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================
function getStatusColor(status) {
    const colors = {
        validated: '#4CAF50',
        pending: '#FFC107',
        rejected: '#F44336'
    };
    return colors[status] || '#2196F3';
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
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-family: 'Inter', sans-serif;
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
// MAP CONTROL FUNCTIONS
// ===========================================
window.zoomIn = function() {
    if (map) map.zoomIn();
};

window.zoomOut = function() {
    if (map) map.zoomOut();
};

window.resetView = function() {
    if (map) map.setView([7.539989, -5.547080], 8);
};

window.locateMe = function() {
    if (!map) return;
    
    map.locate({ setView: true, maxZoom: 16 });
    
    map.once('locationfound', function(e) {
        L.marker(e.latlng).addTo(map)
            .bindPopup('You are here')
            .openPopup();
        showNotification('Location found', 'success');
    });
    
    map.once('locationerror', function() {
        showNotification('Location access denied', 'error');
    });
};

window.zoomToAllFarms = function() {
    if (farmLayers.size === 0) {
        showNotification('No farms to zoom to', 'warning');
        return;
    }
    
    const bounds = L.latLngBounds();
    farmLayers.forEach(layer => {
        if (layer.getBounds && layer.getBounds().isValid()) {
            bounds.extend(layer.getBounds());
        }
    });
    
    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
        showNotification(`Showing all ${farmLayers.size} farms`, 'info');
    }
};

window.zoomToFarm = function(farmId) {
    const layer = farmLayers.get(farmId);
    if (layer && map) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        const farm = allFarms.find(f => f.id === farmId);
        if (farm) showFarmDetails(farm);
    }
};

window.closeProperties = function() {
    const panel = document.getElementById('propertiesPanel');
    if (panel) panel.classList.add('hidden');
};

// ===========================================
// EVENT LISTENERS
// ===========================================

// Apply Filters Button
document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);

// Search Input for farms
document.getElementById('searchInput')?.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        const term = this.value.trim();
        if (term.length < 2) {
            showNotification('Enter at least 2 characters to search', 'warning');
            return;
        }
        
        const results = filteredFarms.filter(farm => 
            farm.farmerName.toLowerCase().includes(term.toLowerCase()) ||
            farm.farmId.toLowerCase().includes(term.toLowerCase()) ||
            farm.cooperative.toLowerCase().includes(term.toLowerCase())
        );
        
        if (results.length === 1) {
            zoomToFarm(results[0].id);
            showNotification('Farm found', 'success');
        } else if (results.length > 1) {
            showNotification(`Found ${results.length} farms`, 'info');
        } else {
            showNotification('No farms found', 'warning');
        }
    }
});

// Sync Button
document.getElementById('syncBtn')?.addEventListener('click', function() {
    const btn = this;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        showNotification('Sync completed successfully', 'success');
        loadFarms();
    }, 2000);
});

// Base Layer Switching
document.querySelectorAll('input[name="baseLayer"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (!map) return;
        
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        
        if (this.value === 'satellite') {
            L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(map);
            showNotification('Switched to Satellite view', 'info');
        } else {
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(map);
            showNotification('Switched to Streets view', 'info');
        }
    });
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', async function(e) {
    e.preventDefault();
    if (window.supabase) {
        await window.supabase.auth.signOut();
    }
    localStorage.removeItem('mappingtrace_user');
    localStorage.removeItem('supabase.auth.token');
    window.location.href = '../login.html';
});

// Add animation styles if not already added
if (!document.getElementById('live-mapping-animations')) {
    const style = document.createElement('style');
    style.id = 'live-mapping-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .farm-popup {
            pointer-events: auto;
        }
        .properties-panel.hidden {
            display: none;
        }
        .timeline-item:hover {
            transform: translateX(5px);
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ Live Mapping ready');
