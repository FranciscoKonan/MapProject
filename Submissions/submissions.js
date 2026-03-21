// ===========================================
// SUBMISSIONS PAGE - COMPLETE JAVASCRIPT
// ===========================================

console.log('🚀 Submissions page loading...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;
let rowsPerPage = 10;
let currentSort = { column: 'submissionDate', direction: 'desc' };
let currentView = 'table';
let uniqueSuppliers = [];
let uniqueCooperatives = [];
let supplierSearchTerm = '';
let coopSearchTerm = '';

// ===========================================
// SUPABASE CONFIGURATION
// ===========================================
const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Load user data from localStorage
    const userData = localStorage.getItem('mappingtrace_user');
    if (userData) {
        const user = JSON.parse(userData);
        document.getElementById('userName').textContent = user.fullName || 'User';
        document.getElementById('userRole').textContent = user.role || 'User';
        document.getElementById('userAvatar').textContent = user.avatar || 'U';
    }
    
    // Initialize Supabase
    initSupabase();
    
    // Setup event listeners
    setupEventListeners();
});

function initSupabase(retryCount = 0) {
    console.log('Initializing Supabase...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 10) {
            console.log(`Waiting for Supabase... (${retryCount + 1}/10)`);
            setTimeout(() => initSupabase(retryCount + 1), 500);
            return;
        }
        console.error('Supabase library failed to load');
        loadSampleData();
        return;
    }
    
    try {
        window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
        loadSubmissions();
    } catch (error) {
        console.error('Supabase init error:', error);
        loadSampleData();
    }
}

// ===========================================
// LOAD SUBMISSIONS
// ===========================================
async function loadSubmissions() {
    console.log('Loading submissions from Supabase...');
    
    try {
        // Check session
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            console.log('No session, using sample data');
            loadSampleData();
            return;
        }
        
        // Fetch farms
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (farms && farms.length > 0) {
            allSubmissions = farms.map(farm => ({
                id: farm.id,
                farmerId: farm.farmer_id || farm.id,
                farmerName: farm.farmer_name || 'Unknown',
                cooperative: farm.cooperative || farm.cooperative_name || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                area: farm.area || 0,
                status: farm.status || 'pending',
                enumerator: farm.enumerator || 'N/A',
                submissionDate: farm.created_at || new Date().toISOString()
            }));
            console.log(`✅ Loaded ${allSubmissions.length} submissions`);
        } else {
            loadSampleData();
            return;
        }
        
        updateFilterOptions();
        applyFilters();
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        loadSampleData();
    }
}

// ===========================================
// SAMPLE DATA
// ===========================================
function loadSampleData() {
    console.log('Loading sample data...');
    
    allSubmissions = [
        { id: '1', farmerId: 'F12345', farmerName: 'Koffi Jean', cooperative: 'GCC Cooperative', supplier: 'GCC', area: 2.5, status: 'validated', enumerator: 'EN001', submissionDate: new Date().toISOString() },
        { id: '2', farmerId: 'F12346', farmerName: 'Konan Marie', cooperative: 'SITAPA Cooperative', supplier: 'SITAPA', area: 1.8, status: 'pending', enumerator: 'EN002', submissionDate: new Date().toISOString() },
        { id: '3', farmerId: 'F12347', farmerName: 'N\'Guessan Paul', cooperative: 'COOP-CI', supplier: 'Other', area: 3.2, status: 'rejected', enumerator: 'EN003', submissionDate: new Date().toISOString() },
        { id: '4', farmerId: 'F12348', farmerName: 'Yao Michel', cooperative: 'GCC Cooperative', supplier: 'GCC', area: 4.1, status: 'validated', enumerator: 'EN001', submissionDate: new Date().toISOString() },
        { id: '5', farmerId: 'F12349', farmerName: 'Traore Amadou', cooperative: 'SITAPA Cooperative', supplier: 'SITAPA', area: 1.2, status: 'pending', enumerator: 'EN002', submissionDate: new Date().toISOString() },
        { id: '6', farmerId: 'F12350', farmerName: 'Kouassi Alphonse', cooperative: 'GCC Cooperative', supplier: 'GCC', area: 5.3, status: 'validated', enumerator: 'EN003', submissionDate: new Date().toISOString() },
        { id: '7', farmerId: 'F12351', farmerName: 'Diomande Issa', cooperative: 'COOP-CI', supplier: 'Other', area: 2.2, status: 'pending', enumerator: 'EN001', submissionDate: new Date().toISOString() }
    ];
    
    updateFilterOptions();
    applyFilters();
    showNotification('Using sample data (demo mode)', 'info');
}

// ===========================================
// FILTER OPTIONS
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
// APPLY FILTERS
// ===========================================
function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const cooperative = document.getElementById('cooperativeFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredSubmissions = allSubmissions.filter(sub => {
        // Search filter
        if (searchTerm) {
            const matches = sub.farmerId.toLowerCase().includes(searchTerm) ||
                           sub.farmerName.toLowerCase().includes(searchTerm);
            if (!matches) return false;
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
    
    // Render current view
    if (currentView === 'table') {
        renderTableView();
        updatePagination();
    } else {
        renderGroupView();
    }
}

function sortSubmissions() {
    filteredSubmissions.sort((a, b) => {
        let aVal = a[currentSort.column];
        let bVal = b[currentSort.column];
        
        if (currentSort.column === 'area') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// ===========================================
// UPDATE STATS
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
    document.getElementById('totalRecords').textContent = total;
}

// ===========================================
// RENDER TABLE VIEW
// ===========================================
function renderTableView() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredSubmissions.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;">No submissions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = pageData.map(sub => `
        <tr>
            <td>${sub.farmerId}</td>
            <td>${sub.farmerName}</td>
            <td>${sub.cooperative}</td>
            <td>${sub.supplier}</td>
            <td>${sub.area.toFixed(2)}</td>
            <td><span class="status-badge ${sub.status}">${sub.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewSubmission('${sub.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${sub.status === 'pending' ? `
                        <button class="action-btn validate" onclick="approveSubmission('${sub.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn reject" onclick="rejectSubmission('${sub.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
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
        container.innerHTML = '<div style="text-align:center;padding:40px;">No submissions found</div>';
        return;
    }
    
    container.innerHTML = Object.entries(groups).map(([supplier, submissions]) => `
        <div class="group-card">
            <div class="group-header">
                <div class="group-title">
                    <i class="fas fa-building"></i> ${supplier}
                </div>
                <div class="group-stats">
                    ${submissions.length} farms • 
                    ${submissions.filter(s => s.status === 'validated').length} validated • 
                    ${submissions.filter(s => s.status === 'pending').length} pending
                </div>
            </div>
            <div class="group-items">
                ${submissions.map(sub => `
                    <div class="group-item" onclick="viewSubmission('${sub.id}')">
                        <div class="group-item-name">${sub.farmerName}</div>
                        <div class="group-item-details">
                            ID: ${sub.farmerId}<br>
                            Area: ${sub.area.toFixed(2)} ha<br>
                            Status: <span class="status-badge ${sub.status}">${sub.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ===========================================
// PAGINATION
// ===========================================
function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, filteredSubmissions.length);
    
    document.getElementById('showingStart').textContent = start;
    document.getElementById('showingEnd').textContent = end;
    
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;
    
    let html = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (startPage > 1) {
        html += `<span class="page-number" onclick="goToPage(1)">1</span>`;
        if (startPage > 2) html += `<span class="page-dots">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<span class="page-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</span>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-dots">...</span>`;
        html += `<span class="page-number" onclick="goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbers.innerHTML = html || '<span class="page-number active">1</span>';
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTableView();
    updatePagination();
}

// ===========================================
// TOGGLE VIEW
// ===========================================
function toggleView() {
    const tableView = document.getElementById('tableView');
    const groupView = document.getElementById('groupView');
    const toggleBtn = document.getElementById('toggleViewBtn');
    
    if (currentView === 'table') {
        tableView.style.display = 'none';
        groupView.style.display = 'block';
        currentView = 'group';
        toggleBtn.innerHTML = '<i class="fas fa-table"></i> Table View';
        renderGroupView();
    } else {
        tableView.style.display = 'block';
        groupView.style.display = 'none';
        currentView = 'table';
        toggleBtn.innerHTML = '<i class="fas fa-layer-group"></i> Group View';
        renderTableView();
        updatePagination();
    }
}

// ===========================================
// ACTIONS
// ===========================================
function viewSubmission(id) {
    const submission = allSubmissions.find(s => s.id === id);
    if (!submission) return;
    
    showModal(submission);
}

function approveSubmission(id) {
    if (!confirm('Are you sure you want to approve this submission?')) return;
    
    const submission = allSubmissions.find(s => s.id === id);
    if (submission) {
        submission.status = 'validated';
        applyFilters();
        showNotification('Submission approved!', 'success');
    }
}

function rejectSubmission(id) {
    const reason = prompt('Please enter rejection reason:', 'Invalid data');
    if (!reason) return;
    
    const submission = allSubmissions.find(s => s.id === id);
    if (submission) {
        submission.status = 'rejected';
        applyFilters();
        showNotification('Submission rejected!', 'info');
    }
}

function showModal(submission) {
    // Remove existing modal
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-file-alt"></i> Submission Details</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-row">
                    <div class="modal-label">Farmer ID:</div>
                    <div class="modal-value">${submission.farmerId}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Farmer Name:</div>
                    <div class="modal-value">${submission.farmerName}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Cooperative:</div>
                    <div class="modal-value">${submission.cooperative}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Supplier:</div>
                    <div class="modal-value">${submission.supplier}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Area:</div>
                    <div class="modal-value">${submission.area.toFixed(2)} ha</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Status:</div>
                    <div class="modal-value">
                        <span class="status-badge ${submission.status}">${submission.status}</span>
                    </div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Enumerator:</div>
                    <div class="modal-value">${submission.enumerator}</div>
                </div>
                <div class="modal-row">
                    <div class="modal-label">Submitted:</div>
                    <div class="modal-value">${new Date(submission.submissionDate).toLocaleString()}</div>
                </div>
                ${submission.status === 'pending' ? `
                    <div class="modal-actions">
                        <button class="modal-btn approve" onclick="approveSubmission('${submission.id}'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="modal-btn reject" onclick="rejectSubmission('${submission.id}'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-times"></i> Reject
                        </button>
                        <button class="modal-btn cancel" onclick="this.closest('.modal-overlay').remove()">
                            Cancel
                        </button>
                    </div>
                ` : ''}
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
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadSubmissions());
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
        searchInput.addEventListener('input', () => applyFilters());
    }
    
    // Supplier search
    const supplierSearch = document.getElementById('supplierSearchInput');
    if (supplierSearch) {
        supplierSearch.addEventListener('input', (e) => {
            supplierSearchTerm = e.target.value.toLowerCase();
            updateSupplierFilter();
            applyFilters();
        });
    }
    
    // Cooperative search
    const coopSearch = document.getElementById('coopSearchInput');
    if (coopSearch) {
        coopSearch.addEventListener('input', (e) => {
            coopSearchTerm = e.target.value.toLowerCase();
            updateCooperativeFilter();
            applyFilters();
        });
    }
    
    // Filters
    const supplierFilter = document.getElementById('supplierFilter');
    if (supplierFilter) supplierFilter.addEventListener('change', () => applyFilters());
    
    const cooperativeFilter = document.getElementById('cooperativeFilter');
    if (cooperativeFilter) cooperativeFilter.addEventListener('change', () => applyFilters());
    
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', () => applyFilters());
    
    // Toggle view button
    const toggleBtn = document.getElementById('toggleViewBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleView());
    
    // Pagination buttons
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTableView(); updatePagination(); } });
    
    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.addEventListener('click', () => { const total = Math.ceil(filteredSubmissions.length / rowsPerPage); if (currentPage < total) { currentPage++; renderTableView(); updatePagination(); } });
    
    // Sort headers
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            applyFilters();
        });
    });
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (window.supabase) await window.supabase.auth.signOut();
            localStorage.clear();
            window.location.href = '../login.html';
        });
    }
}

// ===========================================
// EXPOSE GLOBAL FUNCTIONS
// ===========================================
window.viewSubmission = viewSubmission;
window.approveSubmission = approveSubmission;
window.rejectSubmission = rejectSubmission;
window.goToPage = goToPage;
window.toggleView = toggleView;
window.applyFilters = applyFilters;
