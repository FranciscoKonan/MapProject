// ===========================================
// SUBMISSIONS MANAGEMENT - WITH MAP PREVIEW & SAMPLE DATA
// ===========================================

console.log('🚀 Submissions page initializing...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let allFarms = [];
let tableData = [];
let filteredData = [];
let currentUser = null;
let groupedView = true;
let currentPage = 1;
let rowsPerPage = 10;
let sortColumn = 'submission_date';
let sortDirection = 'desc';
let previewMap = null;
let currentPreviewFarm = null;

// Unique values for filters
let allSuppliers = [];
let allCooperatives = [];

// Search variables
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
            
            currentUser = user;
        }
    } catch (e) {
        console.warn('Error reading cached user:', e);
    }
})();

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 DOM Content Loaded');
    
    // Initialize event listeners first
    initEventListeners();
    
    // Initialize search listeners
    initSearchListeners();
    
    // Try to load from Supabase, but show sample data immediately
    setTimeout(() => {
        if (window.supabase && window.supabase.auth) {
            console.log('✅ Supabase found, attempting to load real data...');
            checkAuthAndLoadData();
        } else {
            console.log('⚠️ Supabase not available, loading sample data');
            loadSampleData();
        }
    }, 500);
});

// ===========================================
// INITIALIZE EVENT LISTENERS
// ===========================================
function initEventListeners() {
    // Search input
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            window.filterTable();
        }, 300));
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            this.disabled = true;
            
            if (window.supabase && window.supabase.auth) {
                checkAuthAndLoadData().then(() => {
                    this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                    this.disabled = false;
                });
            } else {
                loadSampleData();
                this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                this.disabled = false;
            }
        });
    }
    
    // Filter dropdowns
    const supplierFilter = document.getElementById('supplierFilter');
    if (supplierFilter) {
        supplierFilter.addEventListener('change', function() {
            window.filterBySupplier();
        });
    }
    
    const cooperativeFilter = document.getElementById('cooperativeFilter');
    if (cooperativeFilter) {
        cooperativeFilter.addEventListener('change', function() {
            window.filterByCooperative();
        });
    }
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            window.filterTable();
        });
    }
    
    // Toggle view button
    const toggleBtn = document.getElementById('toggleViewBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            window.toggleView();
        });
        // Set initial icon based on groupedView
        updateToggleIcon();
    }
}

// ===========================================
// SEARCH FUNCTIONALITY
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

function updateSupplierFilterWithSearch() {
    const select = document.getElementById('supplierFilter');
    if (!select) return;
    
    // Get current selected value
    const currentValue = select.value;
    
    // Filter suppliers based on search term
    const filteredSuppliers = allSuppliers.filter(supplier => 
        supplier.toLowerCase().includes(supplierSearchTerm)
    );
    
    // Build options
    let options = '<option value="all">All Suppliers</option>';
    
    if (filteredSuppliers.length > 0) {
        options += filteredSuppliers.map(s => 
            `<option value="${s}" ${currentValue === s ? 'selected' : ''}>${s}</option>`
        ).join('');
    } else if (supplierSearchTerm) {
        select.innerHTML = '<option value="all" disabled selected>No matching suppliers</option>';
        return;
    }
    
    select.innerHTML = options;
}

function updateCooperativeFilterWithSearch() {
    const select = document.getElementById('cooperativeFilter');
    if (!select) return;
    
    // Get current selected value
    const currentValue = select.value;
    
    // Filter cooperatives based on search term
    const filteredCoops = allCooperatives.filter(coop => 
        coop.toLowerCase().includes(coopSearchTerm)
    );
    
    // Build options
    let options = '<option value="all">All Cooperatives</option>';
    
    if (filteredCoops.length > 0) {
        options += filteredCoops.map(c => 
            `<option value="${c}" ${currentValue === c ? 'selected' : ''}>${c}</option>`
        ).join('');
    } else if (coopSearchTerm) {
        select.innerHTML = '<option value="all" disabled selected>No matching cooperatives</option>';
        return;
    }
    
    select.innerHTML = options;
}

// ===========================================
// TOGGLE VIEW FUNCTIONALITY
// ===========================================
function updateToggleIcon() {
    const toggleBtn = document.getElementById('toggleViewBtn');
    if (toggleBtn) {
        toggleBtn.innerHTML = groupedView ? 
            '<i class="fas fa-layer-group"></i>' : 
            '<i class="fas fa-list"></i>';
        toggleBtn.title = groupedView ? 'Switch to Flat View' : 'Switch to Group View';
        toggleBtn.classList.toggle('active', groupedView);
    }
}

window.toggleView = function() {
    groupedView = !groupedView;
    updateToggleIcon();
    
    // Save preference to localStorage
    localStorage.setItem('submissions_grouped_view', groupedView);
    
    // Re-render table
    renderTable();
    updatePagination();
    
    if (window.notification) {
        window.notification.info(`Switched to ${groupedView ? 'Group' : 'Flat'} view`);
    }
};

// ===========================================
// LOAD VIEW PREFERENCE
// ===========================================
function loadViewPreference() {
    const savedView = localStorage.getItem('submissions_grouped_view');
    if (savedView !== null) {
        groupedView = savedView === 'true';
        updateToggleIcon();
    }
}

// ===========================================
// CHECK AUTH AND LOAD DATA
// ===========================================
async function checkAuthAndLoadData() {
    console.log('🔐 Checking authentication...');
    
    // Wait for Supabase to be available
    const waitForSupabase = () => {
        return new Promise((resolve) => {
            const check = () => {
                if (window.supabase && window.supabase.auth) {
                    resolve();
                } else {
                    console.log('⏳ Waiting for Supabase...');
                    setTimeout(check, 100);
                }
            };
            check();
        });
    };
    
    try {
        await waitForSupabase();
        console.log('✅ Supabase is ready');
        
        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error) {
            console.error('Auth error:', error);
            loadSampleData();
            return;
        }
        
        if (session) {
            console.log('✅ Authenticated as:', session.user.email);
            
            // Update user info if not already set
            if (!currentUser) {
                updateUserInfo(session.user);
            }
            
            // Load farms
            await loadFarms();
        } else {
            console.log('⚠️ No active session, loading sample data');
            loadSampleData();
        }
    } catch (err) {
        console.error('Auth check failed:', err);
        loadSampleData();
    }
}

// ===========================================
// LOAD FARMS FROM SUPABASE - FIXED COOPERATIVE FIELD
// ===========================================
async function loadFarms() {
    console.log('📡 Loading farms from Supabase...');
    
    try {
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            if (window.notification) {
                window.notification.error('Error loading farms: ' + error.message);
            }
            loadSampleData();
            return;
        }

        if (farms?.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms`);
            console.log('📋 Sample farm data:', farms[0]); // Debug: see actual field names
            
            // Transform farms data - check for all possible cooperative field names
            allFarms = farms.map(farm => {
                // Try multiple possible field names for cooperative
                let cooperative = 'Unassigned';
                
                // Check all possible field names that might contain cooperative info
                if (farm.cooperative_name) cooperative = farm.cooperative_name;
                else if (farm.cooperative) cooperative = farm.cooperative;
                else if (farm.coop) cooperative = farm.coop;
                else if (farm.cooperative_id) {
                    // If we have an ID but need to fetch name, log it
                    console.log('Cooperative ID found:', farm.cooperative_id);
                }
                
                return {
                    id: farm.id,
                    farmer_id: farm.farmer_id || farm.id,
                    farmer_name: farm.farmer_name || 'Unknown',
                    farmerId: farm.farmer_id || farm.id,
                    farmerName: farm.farmer_name || 'Unknown',
                    cooperative: cooperative,
                    supplier: farm.supplier || 'Unknown',
                    area: farm.area || 0,
                    status: farm.status || 'pending',
                    enumerator: farm.enumerator || 'N/A',
                    submission_date: farm.submission_date || farm.created_at,
                    updated_at: farm.updated_at || farm.created_at,
                    updated_by: farm.updated_by || null,
                    updated_by_name: farm.updated_by_name || null,
                    geometry: farm.geometry
                };
            });
            
            // Log unique cooperatives to see what we have
            const cooperatives = [...new Set(allFarms.map(f => f.cooperative))];
            console.log('📊 Found cooperatives:', cooperatives);
            
            // Update filter options
            updateFilterOptions();
            
            // Load view preference
            loadViewPreference();
            
            // Update table data
            window.refreshTable();
            
            if (window.notification) {
                window.notification.success(`Loaded ${allFarms.length} farms`);
            }
        } else {
            console.log('⚠️ No farms found in database');
            loadSampleData();
        }
    } catch (error) {
        console.error('Error loading farms:', error);
        loadSampleData();
    }
}

// ===========================================
// LOAD SAMPLE DATA - WITH COOPERATIVE NAMES
// ===========================================
function loadSampleData() {
    console.log('📊 Loading sample data');
    
    allFarms = [
        {
            id: '1',
            farmer_id: 'F12345',
            farmer_name: 'Koffi Jean',
            farmerId: 'F12345',
            farmerName: 'Koffi Jean',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            area: 2.5,
            status: 'validated',
            enumerator: 'EN001',
            submission_date: '2024-01-15T10:30:00Z',
            updated_at: '2024-01-15T10:30:00Z',
            updated_by_name: 'Admin User',
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
            farmer_id: 'F12346',
            farmer_name: 'Konan Marie',
            farmerId: 'F12346',
            farmerName: 'Konan Marie',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            area: 1.8,
            status: 'pending',
            enumerator: 'EN002',
            submission_date: '2024-01-16T14:20:00Z',
            updated_at: '2024-01-16T14:20:00Z',
            updated_by_name: null,
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
            farmer_id: 'F12347',
            farmer_name: 'N\'Guessan Paul',
            farmerId: 'F12347',
            farmerName: 'N\'Guessan Paul',
            cooperative: 'COOP-CI',
            supplier: 'Other',
            area: 3.2,
            status: 'rejected',
            enumerator: 'EN003',
            submission_date: '2024-01-14T09:15:00Z',
            updated_at: '2024-01-15T11:20:00Z',
            updated_by_name: 'Validator User',
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
            farmer_id: 'F12348',
            farmer_name: 'Amoakon Thérèse',
            farmerId: 'F12348',
            farmerName: 'Amoakon Thérèse',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            area: 4.1,
            status: 'validated',
            enumerator: 'EN001',
            submission_date: '2024-01-17T11:45:00Z',
            updated_at: '2024-01-17T11:45:00Z',
            updated_by_name: 'Admin User',
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.507080, 7.559989],
                    [-5.487080, 7.559989],
                    [-5.487080, 7.579989],
                    [-5.507080, 7.579989],
                    [-5.507080, 7.559989]
                ]]
            }
        },
        {
            id: '5',
            farmer_id: 'F12349',
            farmer_name: 'Kouassi Yao',
            farmerId: 'F12349',
            farmerName: 'Kouassi Yao',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            area: 2.2,
            status: 'pending',
            enumerator: 'EN002',
            submission_date: '2024-01-18T16:30:00Z',
            updated_at: '2024-01-18T16:30:00Z',
            updated_by_name: null,
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-5.467080, 7.549989],
                    [-5.447080, 7.549989],
                    [-5.447080, 7.569989],
                    [-5.467080, 7.569989],
                    [-5.467080, 7.549989]
                ]]
            }
        }
    ];
    
    // Update filter options
    updateFilterOptions();
    
    // Load view preference
    loadViewPreference();
    
    // Update table data
    window.refreshTable();
    
    if (window.notification) {
        window.notification.info('Using sample data');
    }
    
    console.log('✅ Sample data loaded');
}

// ===========================================
// UPDATE FILTER OPTIONS
// ===========================================
function updateFilterOptions() {
    // Get unique suppliers
    allSuppliers = [...new Set(allFarms.map(f => f.supplier).filter(Boolean))].sort();
    
    // Get unique cooperatives
    allCooperatives = [...new Set(allFarms.map(f => f.cooperative).filter(Boolean))].sort();
    
    console.log('📊 Filter options - Suppliers:', allSuppliers);
    console.log('📊 Filter options - Cooperatives:', allCooperatives);
    
    // Update supplier dropdown with search
    updateSupplierFilterWithSearch();
    
    // Update cooperative dropdown with search
    updateCooperativeFilterWithSearch();
}

// ===========================================
// REFRESH TABLE
// ===========================================
window.refreshTable = function() {
    filterData();
    renderTable();
    updatePagination();
    updateStats();
};

// ===========================================
// FILTER DATA BASED ON SEARCH AND DROPDOWNS
// ===========================================
function filterData() {
    const searchTerm = document.getElementById('tableSearch')?.value.toLowerCase() || '';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const cooperative = document.getElementById('cooperativeFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredData = allFarms.filter(farm => {
        // Search filter
        if (searchTerm) {
            const matchesSearch = 
                (farm.farmer_id && farm.farmer_id.toLowerCase().includes(searchTerm)) ||
                (farm.farmer_name && farm.farmer_name.toLowerCase().includes(searchTerm)) ||
                (farm.cooperative && farm.cooperative.toLowerCase().includes(searchTerm)) ||
                (farm.supplier && farm.supplier.toLowerCase().includes(searchTerm)) ||
                (farm.enumerator && farm.enumerator.toLowerCase().includes(searchTerm));
            
            if (!matchesSearch) return false;
        }
        
        // Supplier filter
        if (supplier !== 'all' && farm.supplier !== supplier) return false;
        
        // Cooperative filter
        if (cooperative !== 'all' && farm.cooperative !== cooperative) return false;
        
        // Status filter
        if (status !== 'all' && farm.status !== status) return false;
        
        return true;
    });
    
    // Apply sorting
    sortData();
}

// ===========================================
// SORT DATA
// ===========================================
function sortData() {
    filteredData.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];
        
        // Handle dates
        if (sortColumn === 'submission_date' || sortColumn === 'updated_at') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }
        
        // Handle strings
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        // Handle numbers
        if (typeof aVal === 'number') {
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

// ===========================================
// SORT TABLE
// ===========================================
window.sortTable = function(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    filterData();
    renderTable();
    updatePagination();
    
    // Update sort icons
    updateSortIcons();
};

// ===========================================
// UPDATE SORT ICONS
// ===========================================
function updateSortIcons() {
    document.querySelectorAll('th i.fas.fa-sort, th i.fas.fa-sort-up, th i.fas.fa-sort-down').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const header = document.querySelector(`th[onclick*="${sortColumn}"] i`);
    if (header) {
        header.className = `fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'}`;
    }
}

// ===========================================
// FILTER TABLE (search)
// ===========================================
window.filterTable = function() {
    currentPage = 1;
    filterData();
    renderTable();
    updatePagination();
};

// ===========================================
// FILTER BY SUPPLIER
// ===========================================
window.filterBySupplier = function() {
    window.filterTable();
};

// ===========================================
// FILTER BY COOPERATIVE
// ===========================================
window.filterByCooperative = function() {
    window.filterTable();
};

// ===========================================
// RENDER TABLE
// ===========================================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, filteredData.length);
    const pageData = filteredData.slice(start, end);
    
    if (groupedView) {
        tbody.innerHTML = renderGroupedView(pageData);
    } else {
        tbody.innerHTML = renderFlatView(pageData);
    }
    
    // Update showing count
    updateShowingCount();
}

// ===========================================
// RENDER FLAT VIEW
// ===========================================
function renderFlatView(farms) {
    if (farms.length === 0) {
        return `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h4>No submissions found</h4>
                    <p>Try adjusting your filters</p>
                </td>
            </tr>
        `;
    }
    
    return farms.map(farm => `
        <tr class="farm-row" data-id="${farm.id}">
            <td>${farm.farmer_id}</td>
            <td>${farm.farmer_name}</td>
            <td>${farm.cooperative}</td>
            <td>${farm.supplier}</td>
            <td>${farm.area.toFixed(1)} ha</td>
            <td><span class="status-badge ${farm.status}">${farm.status}</span></td>
            <td>${farm.enumerator}</td>
            <td>${formatUpdatedBy(farm.updated_by_name)}</td>
            <td>${getActionButtons(farm)}</td>
        </tr>
    `).join('');
}

// ===========================================
// RENDER GROUPED VIEW
// ===========================================
function renderGroupedView(farms) {
    if (farms.length === 0) {
        return `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h4>No submissions found</h4>
                    <p>Try adjusting your filters</p>
                </td>
            </tr>
        `;
    }
    
    // Group by supplier
    const bySupplier = {};
    farms.forEach(farm => {
        const supplier = farm.supplier || 'Unknown';
        if (!bySupplier[supplier]) {
            bySupplier[supplier] = {
                farms: [],
                cooperatives: {}
            };
        }
        bySupplier[supplier].farms.push(farm);
        
        // Group by cooperative within supplier
        const coop = farm.cooperative || 'Unassigned';
        if (!bySupplier[supplier].cooperatives[coop]) {
            bySupplier[supplier].cooperatives[coop] = [];
        }
        bySupplier[supplier].cooperatives[coop].push(farm);
    });
    
    let html = '';
    
    Object.keys(bySupplier).sort().forEach(supplier => {
        const supplierData = bySupplier[supplier];
        const supplierTotal = supplierData.farms.length;
        const supplierArea = supplierData.farms.reduce((sum, f) => sum + f.area, 0).toFixed(1);
        const supplierId = supplier.replace(/\s+/g, '-');
        
        // Supplier row
        html += `
            <tr class="supplier-row" id="supplier-${supplierId}" onclick="window.toggleSupplier('${supplierId}')">
                <td colspan="9">
                    <div class="supplier-header">
                        <span class="toggle-icon" id="toggle-supplier-${supplierId}">
                            <i class="fas fa-chevron-down"></i>
                        </span>
                        <i class="fas fa-building"></i>
                        <span>${supplier}</span>
                        <span class="badge">${supplierTotal} farms • ${supplierArea} ha</span>
                    </div>
                </td>
            </tr>
        `;
        
        // Cooperative rows
        Object.keys(supplierData.cooperatives).sort().forEach(coop => {
            const coopFarms = supplierData.cooperatives[coop];
            const coopTotal = coopFarms.length;
            const coopArea = coopFarms.reduce((sum, f) => sum + f.area, 0).toFixed(1);
            const coopId = coop.replace(/\s+/g, '-');
            
            html += `
                <tr class="cooperative-row supplier-${supplierId}-child" data-supplier="${supplierId}">
                    <td colspan="9">
                        <div class="cooperative-header">
                            <span class="toggle-icon" style="margin-left: 30px;" onclick="window.toggleCooperative('${supplierId}', '${coopId}')">
                                <i class="fas fa-chevron-down" id="toggle-coop-${supplierId}-${coopId}"></i>
                            </span>
                            <i class="fas fa-users"></i>
                            <span>${coop}</span>
                            <span class="badge">${coopTotal} farms • ${coopArea} ha</span>
                        </div>
                    </td>
                </tr>
            `;
            
            // Farm rows
            coopFarms.forEach(farm => {
                html += `
                    <tr class="farm-row coop-${supplierId}-${coopId}-child" data-supplier="${supplierId}" data-coop="${coopId}" style="display: table-row;">
                        <td>${farm.farmer_id}</td>
                        <td>${farm.farmer_name}</td>
                        <td>${farm.cooperative}</td>
                        <td>${farm.supplier}</td>
                        <td>${farm.area.toFixed(1)} ha</td>
                        <td><span class="status-badge ${farm.status}">${farm.status}</span></td>
                        <td>${farm.enumerator}</td>
                        <td>${formatUpdatedBy(farm.updated_by_name)}</td>
                        <td>${getActionButtons(farm)}</td>
                    </tr>
                `;
            });
        });
    });
    
    return html;
}

// ===========================================
// TOGGLE SUPPLIER
// ===========================================
window.toggleSupplier = function(supplierId) {
    const childRows = document.querySelectorAll(`tr[data-supplier="${supplierId}"]`);
    const toggleIcon = document.getElementById(`toggle-supplier-${supplierId}`);
    const isHidden = childRows.length > 0 && childRows[0].style.display === 'none';
    
    childRows.forEach(row => {
        row.style.display = isHidden ? 'table-row' : 'none';
    });
    
    if (toggleIcon) {
        toggleIcon.innerHTML = isHidden ? 
            '<i class="fas fa-chevron-down"></i>' : 
            '<i class="fas fa-chevron-right"></i>';
    }
};

// ===========================================
// TOGGLE COOPERATIVE
// ===========================================
window.toggleCooperative = function(supplierId, coopId) {
    const childRows = document.querySelectorAll(`tr.coop-${supplierId}-${coopId}-child`);
    const toggleIcon = document.getElementById(`toggle-coop-${supplierId}-${coopId}`);
    const isHidden = childRows.length > 0 && childRows[0].style.display === 'none';
    
    childRows.forEach(row => {
        row.style.display = isHidden ? 'table-row' : 'none';
    });
    
    if (toggleIcon) {
        toggleIcon.className = isHidden ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
    }
};

// ===========================================
// FORMAT UPDATED BY
// ===========================================
function formatUpdatedBy(name) {
    if (!name) return '<span class="updated-by">-</span>';
    
    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'U';
    
    return `
        <div class="updated-by">
            <span class="updated-by-avatar">${initials}</span>
            <span>${name}</span>
        </div>
    `;
}

// ===========================================
// GET ACTION BUTTONS
// ===========================================
function getActionButtons(farm) {
    const buttons = [];
    
    // Preview button with map icon
    buttons.push(`<button class="action-btn preview" onclick="window.showFarmPreview('${farm.id}')" title="Preview on map"><i class="fas fa-map-marked-alt"></i></button>`);
    
    // Validate/Reject buttons for pending
    if (farm.status === 'pending') {
        buttons.push(`<button class="action-btn validate" onclick="window.updateFarmStatus('${farm.id}', 'validated')" title="Validate"><i class="fas fa-check"></i></button>`);
        buttons.push(`<button class="action-btn reject" onclick="window.updateFarmStatus('${farm.id}', 'rejected')" title="Reject"><i class="fas fa-times"></i></button>`);
    }
    
    return `<div class="action-buttons">${buttons.join('')}</div>`;
}

// ===========================================
// SHOW FARM PREVIEW WITH MAP
// ===========================================
window.showFarmPreview = function(farmId) {
    const farm = allFarms.find(f => f.id === farmId);
    if (!farm) return;
    
    currentPreviewFarm = farm;
    
    // Remove existing preview modal
    const existingModal = document.querySelector('.preview-modal-overlay');
    if (existingModal) existingModal.remove();
    
    // Create preview modal
    const modal = document.createElement('div');
    modal.className = 'preview-modal-overlay';
    
    // Parse geometry if it exists
    let geometry = farm.geometry;
    if (geometry && typeof geometry === 'string') {
        try {
            geometry = JSON.parse(geometry);
        } catch (e) {
            console.error('Error parsing geometry:', e);
        }
    }
    
    const hasGeometry = geometry && geometry.coordinates && geometry.coordinates.length > 0;
    
    modal.innerHTML = `
        <div class="preview-modal-content">
            <div class="preview-modal-header">
                <h3><i class="fas fa-map-marked-alt"></i> Farm Preview: ${farm.farmer_name}</h3>
                <button class="preview-modal-close" onclick="window.closeFarmPreview()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="preview-modal-body">
                <div class="preview-grid">
                    <div class="preview-info">
                        <div class="preview-info-section">
                            <h4><i class="fas fa-info-circle"></i> Farm Details</h4>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Farmer ID:</span>
                                <span class="preview-info-value">${farm.farmer_id}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Farmer Name:</span>
                                <span class="preview-info-value">${farm.farmer_name}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Cooperative:</span>
                                <span class="preview-info-value">${farm.cooperative}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Supplier:</span>
                                <span class="preview-info-value">${farm.supplier}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Area:</span>
                                <span class="preview-info-value">${farm.area.toFixed(2)} ha</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Status:</span>
                                <span class="preview-info-value"><span class="status-badge ${farm.status}">${farm.status}</span></span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Enumerator:</span>
                                <span class="preview-info-value">${farm.enumerator}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Submitted:</span>
                                <span class="preview-info-value">${new Date(farm.submission_date).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        ${farm.status === 'pending' ? `
                            <div class="preview-actions">
                                <h4><i class="fas fa-tasks"></i> Actions</h4>
                                <div class="preview-action-buttons">
                                    <button class="preview-btn validate" onclick="window.updateFarmStatus('${farm.id}', 'validated'); window.closeFarmPreview();">
                                        <i class="fas fa-check"></i> Validate Farm
                                    </button>
                                    <button class="preview-btn reject" onclick="window.updateFarmStatus('${farm.id}', 'rejected'); window.closeFarmPreview();">
                                        <i class="fas fa-times"></i> Reject Farm
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div class="preview-info-section">
                                <h4><i class="fas fa-history"></i> Update History</h4>
                                <div class="preview-info-row">
                                    <span class="preview-info-label">Last Updated:</span>
                                    <span class="preview-info-value">${new Date(farm.updated_at).toLocaleString()}</span>
                                </div>
                                <div class="preview-info-row">
                                    <span class="preview-info-label">Updated By:</span>
                                    <span class="preview-info-value">${farm.updated_by_name || 'N/A'}</span>
                                </div>
                            </div>
                        `}
                    </div>
                    
                    <div class="preview-map-container">
                        <h4><i class="fas fa-draw-polygon"></i> Farm Boundary</h4>
                        <div id="preview-map" class="preview-map"></div>
                        ${!hasGeometry ? '<p class="no-geometry">No geometry data available for this farm</p>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize map if geometry exists
    if (hasGeometry) {
        setTimeout(() => {
            initPreviewMap(geometry, farm);
        }, 100);
    }
};

// ===========================================
// INITIALIZE PREVIEW MAP
// ===========================================
function initPreviewMap(geometry, farm) {
    const mapContainer = document.getElementById('preview-map');
    if (!mapContainer) return;
    
    // Destroy existing map
    if (previewMap) {
        previewMap.remove();
    }
    
    // Create new map
    previewMap = L.map('preview-map').setView([7.539989, -5.547080], 8);
    
    // Add satellite layer
    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(previewMap);
    
    try {
        // Add farm polygon
        const polygon = L.geoJSON(geometry, {
            style: {
                color: farm.status === 'validated' ? '#4CAF50' :
                       farm.status === 'pending' ? '#FFC107' : '#F44336',
                weight: 3,
                fillColor: farm.status === 'validated' ? '#4CAF50' :
                          farm.status === 'pending' ? '#FFC107' : '#F44336',
                fillOpacity: 0.3
            }
        }).addTo(previewMap);
        
        // Fit map to polygon
        const bounds = polygon.getBounds();
        if (bounds.isValid()) {
            previewMap.fitBounds(bounds, { padding: [20, 20] });
        }
        
        // Add popup
        polygon.bindPopup(`
            <div style="min-width:150px;">
                <strong>${farm.farmer_name}</strong><br>
                ID: ${farm.farmer_id}<br>
                Area: ${farm.area.toFixed(2)} ha<br>
                Status: ${farm.status}
            </div>
        `);
        
    } catch (e) {
        console.error('Error displaying farm geometry:', e);
        mapContainer.innerHTML = '<p class="error">Error displaying farm boundary</p>';
    }
}

// ===========================================
// CLOSE FARM PREVIEW
// ===========================================
window.closeFarmPreview = function() {
    const modal = document.querySelector('.preview-modal-overlay');
    if (modal) {
        if (previewMap) {
            previewMap.remove();
            previewMap = null;
        }
        modal.remove();
    }
};

// ===========================================
// UPDATE FARM STATUS - FIXED COLUMNS
// ===========================================
window.updateFarmStatus = async function(farmId, newStatus) {
    if (!confirm(`Are you sure you want to mark this farm as ${newStatus}?`)) {
        return;
    }
    
    try {
        // Get current user info
        const user = currentUser || JSON.parse(localStorage.getItem('mappingtrace_user') || '{}');
        const updatedByName = user.fullName || user.email || 'Unknown';
        
        console.log(`🔄 Updating farm ${farmId} to ${newStatus} by ${updatedByName}`);
        
        // Create update object with ONLY columns that exist
        const updateData = { 
            status: newStatus,
            updated_at: new Date().toISOString()
        };
        
        console.log('📦 Sending update with data:', updateData);
        
        // Check if Supabase is available
        if (window.supabase && window.supabase.auth) {
            const { error } = await window.supabase
                .from('farms')
                .update(updateData)
                .eq('id', farmId);

            if (error) {
                console.error('Update error:', error);
                
                // If error is about missing columns, try without them
                if (error.code === 'PGRST204' && error.message.includes('updated_by')) {
                    console.log('⚠️ updated_by column missing, trying without it...');
                    
                    // Try again without the problematic columns
                    const simpleUpdate = { 
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    };
                    
                    const { error: retryError } = await window.supabase
                        .from('farms')
                        .update(simpleUpdate)
                        .eq('id', farmId);
                    
                    if (retryError) {
                        console.error('Retry also failed:', retryError);
                        if (window.notification) {
                            window.notification.error('Error updating status: ' + retryError.message);
                        }
                        return;
                    }
                } else {
                    if (window.notification) {
                        window.notification.error('Error updating status: ' + error.message);
                    }
                    return;
                }
            }
        } else {
            console.log('⚠️ Supabase not available, updating local data only');
        }

        // Update local data
        const farmIndex = allFarms.findIndex(f => f.id === farmId);
        if (farmIndex !== -1) {
            allFarms[farmIndex].status = newStatus;
            allFarms[farmIndex].updated_at = new Date().toISOString();
            allFarms[farmIndex].updated_by_name = updatedByName;
        }
        
        if (window.notification) {
            window.notification.success(`Farm marked as ${newStatus}!`);
        }
        
        // Close preview if open
        if (typeof window.closeFarmPreview === 'function') {
            window.closeFarmPreview();
        }
        
        // Refresh table
        window.refreshTable();
        
    } catch (error) {
        console.error('Error:', error);
        if (window.notification) {
            window.notification.error('Error updating status');
        }
    }
};

// ===========================================
// UPDATE STATS
// ===========================================
function updateStats() {
    const pending = allFarms.filter(f => f.status === 'pending').length;
    const validated = allFarms.filter(f => f.status === 'validated').length;
    const rejected = allFarms.filter(f => f.status === 'rejected').length;
    
    const pendingEl = document.getElementById('pendingCount');
    const validatedEl = document.getElementById('validatedCount');
    const rejectedEl = document.getElementById('rejectedCount');
    const totalEl = document.getElementById('totalCount');
    
    if (pendingEl) pendingEl.textContent = pending;
    if (validatedEl) validatedEl.textContent = validated;
    if (rejectedEl) rejectedEl.textContent = rejected;
    if (totalEl) totalEl.textContent = allFarms.length;
}

// ===========================================
// UPDATE SHOWING COUNT
// ===========================================
function updateShowingCount() {
    const start = (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, filteredData.length);
    const showingEl = document.getElementById('showingCount');
    const totalEl = document.getElementById('totalCount');
    
    if (showingEl) {
        showingEl.textContent = filteredData.length > 0 ? `${start}-${end}` : '0-0';
    }
    if (totalEl) {
        totalEl.textContent = filteredData.length;
    }
}

// ===========================================
// PAGINATION
// ===========================================
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const pageNumbers = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (!pageNumbers) return;
    
    // Update prev/next buttons
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    // Generate page numbers
    let pages = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        pages += `<span class="page-number" onclick="window.goToPage(1)">1</span>`;
        if (startPage > 2) pages += `<span class="page-dots">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pages += `<span class="page-number ${i === currentPage ? 'active' : ''}" onclick="window.goToPage(${i})">${i}</span>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages += `<span class="page-dots">...</span>`;
        pages += `<span class="page-number" onclick="window.goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbers.innerHTML = pages;
}

// ===========================================
// GO TO PAGE
// ===========================================
window.goToPage = function(page) {
    currentPage = page;
    renderTable();
    updatePagination();
};

// ===========================================
// PREVIOUS PAGE
// ===========================================
window.prevPage = function() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
    }
};

// ===========================================
// NEXT PAGE
// ===========================================
window.nextPage = function() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
    }
};

// ===========================================
// UPDATE USER INFO
// ===========================================
function updateUserInfo(user) {
    if (!user) return;
    
    const userName = document.querySelector('.user-name');
    const userRole = document.querySelector('.user-role');
    const userAvatar = document.querySelector('.user-avatar');
    
    const userMetadata = user.user_metadata || {};
    const email = user.email || 'User';
    
    // Get full name
    let fullName = userMetadata.full_name || 
                   userMetadata.name || 
                   `${userMetadata.first_name || ''} ${userMetadata.last_name || ''}`.trim() ||
                   email.split('@')[0] || 
                   'User';
    
    // Capitalize each word
    fullName = fullName.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    
    // Get role
    let role = userMetadata.role || 'user';
    const roleDisplay = {
        'field_officer': 'Field Officer',
        'validator': 'Validator',
        'admin': 'Administrator',
        'viewer': 'Viewer',
        'user': 'User'
    };
    const displayRole = roleDisplay[role] || 
                       role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Get initials
    const initials = fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'U';
    
    if (userName) userName.textContent = fullName;
    if (userRole) userRole.textContent = displayRole;
    if (userAvatar) userAvatar.textContent = initials;
    
    // Update current user
    currentUser = {
        fullName: fullName,
        role: displayRole,
        email: user.email
    };
}

// ===========================================
// DEBOUNCE HELPER
// ===========================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

console.log('✅ Submissions page ready');