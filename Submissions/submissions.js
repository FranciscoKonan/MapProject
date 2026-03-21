// ===========================================
// SUBMISSIONS - COMPLETE APPLICATION
// ===========================================

console.log('📋 Submissions page loading...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;
let rowsPerPage = 10;
let currentSort = { column: 'submissionDate', direction: 'desc' };
let currentView = 'table'; // 'table' or 'group'
let uniqueSuppliers = [];
let uniqueCooperatives = [];
let supplierSearchTerm = '';
let coopSearchTerm = '';

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 DOM Content Loaded');
    
    // Listen for Supabase ready
    window.addEventListener('supabase-ready', function() {
        console.log('✅ Supabase ready, loading submissions...');
        loadSubmissions();
    });
    
    // Check if already ready
    if (window.supabase) {
        console.log('✅ Supabase already ready');
        loadSubmissions();
    }
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('tableSearch');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                filterTable();
            }
        });
    }
    
    // Supplier search
    const supplierSearch = document.getElementById('supplierSearch');
    if (supplierSearch) {
        supplierSearch.addEventListener('input', function(e) {
            supplierSearchTerm = e.target.value.toLowerCase();
            updateSupplierFilter();
        });
    }
    
    // Cooperative search
    const coopSearch = document.getElementById('coopSearch');
    if (coopSearch) {
        coopSearch.addEventListener('input', function(e) {
            coopSearchTerm = e.target.value.toLowerCase();
            updateCooperativeFilter();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            filterTable();
        });
    }
    
    // Supplier filter
    const supplierFilter = document.getElementById('supplierFilter');
    if (supplierFilter) {
        supplierFilter.addEventListener('change', function() {
            filterTable();
        });
    }
    
    // Cooperative filter
    const cooperativeFilter = document.getElementById('cooperativeFilter');
    if (cooperativeFilter) {
        cooperativeFilter.addEventListener('change', function() {
            filterTable();
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshTableBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadSubmissions();
        });
    }
    
    // Refresh button (alternative ID)
    const refreshBtnAlt = document.getElementById('refreshBtn');
    if (refreshBtnAlt) {
        refreshBtnAlt.addEventListener('click', function() {
            loadSubmissions();
        });
    }
    
    // Toggle view button
    const toggleBtn = document.getElementById('toggleViewBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            toggleView();
        });
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (window.supabase) {
                await window.supabase.auth.signOut();
            }
            localStorage.removeItem('mappingtrace_user');
            window.location.href = '../login.html';
        });
    }
}

// ===========================================
// LOAD SUBMISSIONS FROM SUPABASE
// ===========================================
async function loadSubmissions() {
    console.log('📡 Loading submissions from Supabase...');
    showNotification('Loading submissions...', 'info');
    
    try {
        if (!window.supabase || !window.supabase.auth) {
            console.error('❌ Supabase not available');
            loadSampleData();
            return;
        }
        
        // Check session
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            console.log('⚠️ No active session');
            window.location.href = '../login.html';
            return;
        }
        
        // Load user data
        const userData = localStorage.getItem('mappingtrace_user');
        if (userData) {
            const user = JSON.parse(userData);
            document.getElementById('userName').textContent = user.fullName || 'User';
            document.getElementById('userRole').textContent = user.role || 'User';
            document.getElementById('userAvatar').textContent = user.avatar || 'U';
        }
        
        // Fetch submissions from farms table
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} submissions`);
            
            allSubmissions = farms.map(farm => ({
                id: farm.id,
                farmerId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                cooperative: farm.cooperative || farm.cooperative_name || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                area: farm.area || 0,
                status: farm.status || 'pending',
                enumerator: farm.enumerator || 'N/A',
                updatedBy: farm.updated_by || farm.enumerator || 'System',
                submissionDate: farm.submission_date || farm.created_at,
                geometry: farm.geometry
            }));
            
            updateFilterOptions();
            filterTable();
            showNotification(`Loaded ${allSubmissions.length} submissions`, 'success');
        } else {
            console.log('⚠️ No submissions found');
            loadSampleData();
        }
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        showNotification('Error loading submissions: ' + error.message, 'error');
        loadSampleData();
    }
}

// ===========================================
// SAMPLE DATA
// ===========================================
function loadSampleData() {
    console.log('📊 Loading sample submissions data');
    
    allSubmissions = [
        {
            id: '1',
            farmerId: 'F12345',
            farmerName: 'Koffi Jean',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            area: 2.5,
            status: 'validated',
            enumerator: 'EN001',
            updatedBy: 'Admin',
            submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: null
        },
        {
            id: '2',
            farmerId: 'F12346',
            farmerName: 'Konan Marie',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            area: 1.8,
            status: 'pending',
            enumerator: 'EN002',
            updatedBy: 'Field Officer',
            submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: null
        },
        {
            id: '3',
            farmerId: 'F12347',
            farmerName: 'N\'Guessan Paul',
            cooperative: 'COOP-CI',
            supplier: 'Other',
            area: 3.2,
            status: 'rejected',
            enumerator: 'EN003',
            updatedBy: 'Validator',
            submissionDate: new Date().toISOString(),
            geometry: null
        },
        {
            id: '4',
            farmerId: 'F12348',
            farmerName: 'Yao Michel',
            cooperative: 'GCC Cooperative',
            supplier: 'GCC',
            area: 4.1,
            status: 'validated',
            enumerator: 'EN001',
            updatedBy: 'Admin',
            submissionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: null
        },
        {
            id: '5',
            farmerId: 'F12349',
            farmerName: 'Traore Amadou',
            cooperative: 'SITAPA Cooperative',
            supplier: 'SITAPA',
            area: 1.2,
            status: 'pending',
            enumerator: 'EN002',
            updatedBy: 'Field Officer',
            submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            geometry: null
        }
    ];
    
    updateFilterOptions();
    filterTable();
    showNotification('Using sample data (demo mode)', 'info');
}

// ===========================================
// UPDATE FILTER OPTIONS
// ===========================================
function updateFilterOptions() {
    uniqueSuppliers = [...new Set(allSubmissions.map(s => s.supplier))].sort();
    uniqueCooperatives = [...new Set(allSubmissions.map(s => s.cooperative))].sort();
    
    updateSupplierFilter();
    updateCooperativeFilter();
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
// FILTER TABLE
// ===========================================
function filterTable() {
    const searchTerm = document.getElementById('tableSearch')?.value.toLowerCase() || '';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const cooperative = document.getElementById('cooperativeFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredSubmissions = allSubmissions.filter(sub => {
        // Search filter
        if (searchTerm) {
            const matchesSearch = 
                sub.farmerId.toLowerCase().includes(searchTerm) ||
                sub.farmerName.toLowerCase().includes(searchTerm) ||
                sub.cooperative.toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;
        }
        
        // Supplier filter
        if (supplier !== 'all' && sub.supplier !== supplier) return false;
        
        // Cooperative filter
        if (cooperative !== 'all' && sub.cooperative !== cooperative) return false;
        
        // Status filter
        if (status !== 'all' && sub.status !== status) return false;
        
        return true;
    });
    
    // Sort
    sortSubmissions();
    
    // Update stats
    updateStats();
    
    // Render based on current view
    if (currentView === 'table') {
        renderTable();
        updatePagination();
    } else {
        renderGroupView();
    }
    
    // Reset to first page
    currentPage = 1;
}

window.filterTable = function() {
    filterTable();
};

function sortSubmissions() {
    filteredSubmissions.sort((a, b) => {
        let aVal = a[currentSort.column];
        let bVal = b[currentSort.column];
        
        if (currentSort.column === 'area') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (currentSort.column === 'submissionDate') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

window.sortTable = function(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    filterTable();
};

// ===========================================
// UPDATE STATISTICS
// ===========================================
function updateStats() {
    const pending = filteredSubmissions.filter(s => s.status === 'pending').length;
    const validated = filteredSubmissions.filter(s => s.status === 'validated').length;
    const rejected = filteredSubmissions.filter(s => s.status === 'rejected').length;
    const total = filteredSubmissions.length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('validatedCount').textContent = validated;
    document.getElementById('rejectedCount').textContent = rejected;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('totalCountFooter').textContent = total;
}

// ===========================================
// RENDER TABLE VIEW
// ===========================================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageSubmissions = filteredSubmissions.slice(start, end);
    
    if (pageSubmissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No submissions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = pageSubmissions.map(sub => `
        <tr class="farm-row">
            <td>${sub.farmerId}</td>
            <td>${sub.farmerName}</td>
            <td>${sub.cooperative}</td>
            <td>${sub.supplier}</td>
            <td>${sub.area.toFixed(2)}</td>
            <td><span class="status-badge ${sub.status}">${sub.status}</span></td>
            <td>${sub.enumerator}</td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="window.viewSubmission('${sub.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                ${sub.status === 'pending' ? `
                    <button class="action-btn validate" onclick="window.approveSubmission('${sub.id}')" title="Approve">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn reject" onclick="window.rejectSubmission('${sub.id}')" title="Reject">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// ===========================================
// RENDER GROUP VIEW
// ===========================================
function renderGroupView() {
    const container = document.getElementById('groupViewContent');
    if (!container) return;
    
    // Group by supplier
    const groups = {};
    filteredSubmissions.forEach(sub => {
        if (!groups[sub.supplier]) {
            groups[sub.supplier] = [];
        }
        groups[sub.supplier].push(sub);
    });
    
    if (Object.keys(groups).length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px;">No submissions found</div>';
        return;
    }
    
    container.innerHTML = Object.entries(groups).map(([supplier, submissions]) => `
        <div class="group-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div class="group-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">
                <div class="group-title" style="font-weight: 600; color: #2c6e49;">
                    <i class="fas fa-building"></i> ${supplier}
                </div>
                <div class="group-stats" style="font-size: 12px; color: #64748b;">
                    ${submissions.length} farms • 
                    ${submissions.filter(s => s.status === 'validated').length} validated • 
                    ${submissions.filter(s => s.status === 'pending').length} pending • 
                    ${submissions.filter(s => s.status === 'rejected').length} rejected
                </div>
            </div>
            <div class="group-items" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                ${submissions.map(sub => `
                    <div class="group-item" onclick="window.viewSubmission('${sub.id}')" style="background: #f8fafc; border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.2s;">
                        <div class="group-item-name" style="font-weight: 600; margin-bottom: 5px;">${sub.farmerName}</div>
                        <div class="group-item-details" style="font-size: 12px; color: #64748b;">
                            ID: ${sub.farmerId}<br>
                            Area: ${sub.area.toFixed(2)} ha<br>
                            Status: <span class="status-badge ${sub.status}" style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${sub.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ===========================================
// TOGGLE VIEW (Table / Group)
// ===========================================
window.toggleView = function() {
    const tableView = document.getElementById('tableView');
    const groupView = document.getElementById('groupView');
    const toggleBtn = document.getElementById('toggleViewBtn');
    
    if (currentView === 'table') {
        // Switch to group view
        if (tableView) tableView.style.display = 'none';
        if (groupView) groupView.style.display = 'block';
        currentView = 'group';
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="fas fa-table"></i>';
            toggleBtn.title = 'Switch to Table View';
        }
        renderGroupView();
    } else {
        // Switch to table view
        if (tableView) tableView.style.display = 'block';
        if (groupView) groupView.style.display = 'none';
        currentView = 'table';
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i class="fas fa-layer-group"></i>';
            toggleBtn.title = 'Switch to Group View';
        }
        renderTable();
        updatePagination();
    }
};

// ===========================================
// PAGINATION
// ===========================================
function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    const pageNumbers = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const showingCount = document.getElementById('showingCount');
    
    if (!pageNumbers) return;
    
    // Update showing count
    const start = (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, filteredSubmissions.length);
    if (showingCount && filteredSubmissions.length > 0) {
        showingCount.textContent = `${start}-${end}`;
    } else if (showingCount) {
        showingCount.textContent = '0-0';
    }
    
    // Update buttons
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    // Generate page numbers
    let pagesHtml = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        pagesHtml += `<span class="page-number" onclick="window.goToPage(1)">1</span>`;
        if (startPage > 2) pagesHtml += `<span class="page-dots">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<span class="page-number ${i === currentPage ? 'active' : ''}" onclick="window.goToPage(${i})">${i}</span>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pagesHtml += `<span class="page-dots">...</span>`;
        pagesHtml += `<span class="page-number" onclick="window.goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbers.innerHTML = pagesHtml || '<span class="page-number active">1</span>';
}

window.goToPage = function(page) {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    updatePagination();
};

window.prevPage = function() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
    }
};

window.nextPage = function() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
    }
};

// ===========================================
// SUBMISSION ACTIONS
// ===========================================
window.viewSubmission = function(id) {
    const submission = allSubmissions.find(s => s.id === id);
    if (!submission) return;
    
    showPreviewModal(submission);
};

window.approveSubmission = async function(id) {
    const submission = allSubmissions.find(s => s.id === id);
    if (!submission) return;
    
    if (confirm(`Approve submission for ${submission.farmerName}?`)) {
        try {
            if (window.supabase) {
                const { error } = await window.supabase
                    .from('farms')
                    .update({ status: 'validated', updated_by: 'Admin' })
                    .eq('id', id);
                
                if (error) throw error;
                showNotification('Submission approved!', 'success');
            } else {
                // Update local data
                submission.status = 'validated';
                showNotification('Submission approved (demo mode)!', 'success');
            }
            
            // Refresh the view
            filterTable();
        } catch (error) {
            console.error('Error approving:', error);
            showNotification('Error approving submission', 'error');
        }
    }
};

window.rejectSubmission = async function(id) {
    const submission = allSubmissions.find(s => s.id === id);
    if (!submission) return;
    
    const reason = prompt('Please enter rejection reason:', 'Invalid geometry');
    if (reason) {
        try {
            if (window.supabase) {
                const { error } = await window.supabase
                    .from('farms')
                    .update({ status: 'rejected', updated_by: 'Admin', rejection_reason: reason })
                    .eq('id', id);
                
                if (error) throw error;
                showNotification('Submission rejected!', 'info');
            } else {
                submission.status = 'rejected';
                showNotification('Submission rejected (demo mode)!', 'info');
            }
            
            filterTable();
        } catch (error) {
            console.error('Error rejecting:', error);
            showNotification('Error rejecting submission', 'error');
        }
    }
};

// ===========================================
// PREVIEW MODAL
// ===========================================
function showPreviewModal(submission) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.preview-modal-overlay');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'preview-modal-overlay';
    modal.innerHTML = `
        <div class="preview-modal-content">
            <div class="preview-modal-header">
                <h3>
                    <i class="fas fa-file-alt"></i>
                    Submission Details
                </h3>
                <button class="preview-modal-close" onclick="this.closest('.preview-modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="preview-modal-body">
                <div class="preview-grid">
                    <div class="preview-info">
                        <div class="preview-info-section">
                            <h4><i class="fas fa-user"></i> Farmer Information</h4>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Farmer ID:</span>
                                <span class="preview-info-value">${submission.farmerId}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Farmer Name:</span>
                                <span class="preview-info-value">${submission.farmerName}</span>
                            </div>
                        </div>
                        
                        <div class="preview-info-section">
                            <h4><i class="fas fa-building"></i> Organization</h4>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Cooperative:</span>
                                <span class="preview-info-value">${submission.cooperative}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Supplier:</span>
                                <span class="preview-info-value">${submission.supplier}</span>
                            </div>
                        </div>
                        
                        <div class="preview-info-section">
                            <h4><i class="fas fa-chart-line"></i> Farm Data</h4>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Area:</span>
                                <span class="preview-info-value">${submission.area.toFixed(2)} ha</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Status:</span>
                                <span class="preview-info-value">
                                    <span class="status-badge ${submission.status}">${submission.status}</span>
                                </span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Enumerator:</span>
                                <span class="preview-info-value">${submission.enumerator}</span>
                            </div>
                            <div class="preview-info-row">
                                <span class="preview-info-label">Submitted:</span>
                                <span class="preview-info-value">${new Date(submission.submissionDate).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        ${submission.status === 'pending' ? `
                            <div class="preview-actions">
                                <h4><i class="fas fa-check-double"></i> Actions</h4>
                                <div class="preview-action-buttons">
                                    <button class="preview-btn validate" onclick="window.approveSubmission('${submission.id}'); document.querySelector('.preview-modal-overlay').remove()">
                                        <i class="fas fa-check"></i> Approve
                                    </button>
                                    <button class="preview-btn reject" onclick="window.rejectSubmission('${submission.id}'); document.querySelector('.preview-modal-overlay').remove()">
                                        <i class="fas fa-times"></i> Reject
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div class="preview-actions">
                                <div class="preview-info-row">
                                    <span class="preview-info-label">Reviewed by:</span>
                                    <span class="preview-info-value">${submission.updatedBy}</span>
                                </div>
                            </div>
                        `}
                    </div>
                    
                    <div class="preview-map-container">
                        <h4><i class="fas fa-map"></i> Farm Location</h4>
                        <div id="previewMap" style="height: 400px; border-radius: 8px; background: #f1f5f9;"></div>
                        <div id="previewMapError" style="display: none;" class="error">No geometry data available</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize map after modal is added
    setTimeout(() => {
        const mapContainer = document.getElementById('previewMap');
        const mapError = document.getElementById('previewMapError');
        
        if (submission.geometry && mapContainer) {
            try {
                const map = L.map('previewMap').setView([7.539989, -5.547080], 8);
                L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    maxZoom: 20,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
                }).addTo(map);
                
                const geom = typeof submission.geometry === 'string' 
                    ? JSON.parse(submission.geometry) 
                    : submission.geometry;
                
                const geoJsonLayer = L.geoJSON(geom, {
                    style: { color: '#2c6e49', weight: 2, fillOpacity: 0.3 }
                }).addTo(map);
                
                map.fitBounds(geoJsonLayer.getBounds());
                
            } catch (e) {
                console.error('Map error:', e);
                if (mapContainer) mapContainer.style.display = 'none';
                if (mapError) mapError.style.display = 'block';
            }
        } else {
            if (mapContainer) mapContainer.style.display = 'none';
            if (mapError) mapError.style.display = 'block';
        }
    }, 100);
    
    // Close modal on overlay click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// ===========================================
// NOTIFICATION
// ===========================================
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

// Add animation styles if not already added
if (!document.getElementById('submissions-animations')) {
    const style = document.createElement('style');
    style.id = 'submissions-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .page-number {
            cursor: pointer;
            padding: 5px 10px;
            margin: 0 2px;
            border-radius: 4px;
            transition: all 0.2s;
        }
        .page-number:hover {
            background: #e2e8f0;
        }
        .page-number.active {
            background: #2c6e49;
            color: white;
        }
        .page-dots {
            padding: 5px 10px;
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ Submissions page ready');
