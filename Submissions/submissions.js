// ===========================================
// SUBMISSIONS PAGE - MAPPINGTRACE
// ===========================================

console.log('🚀 Submissions page loading...');

// Global variables
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;
let rowsPerPage = 10;
let sortColumn = 'submission_date';
let sortDirection = 'desc';
let supabaseClient = null;

const SUPABASE_URL = 'https://vzrufmelftbqpsemnjbd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnVmbWVsZnRicXBzZW1uamJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzYwNTMsImV4cCI6MjA4NjY1MjA1M30.1NPN666Lt9WZHupvp_XIFu-SnsaextHH_JvXgQPtyV0';

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 Submissions DOM loaded');
    loadUserData();
    initSupabaseAndLoad();
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

function initSupabaseAndLoad(retryCount = 0) {
    console.log('🔧 Initializing Supabase...');
    
    if (typeof window.supabase === 'undefined') {
        if (retryCount < 20) {
            console.log(`⏳ Waiting for Supabase... (${retryCount + 1}/20)`);
            setTimeout(() => initSupabaseAndLoad(retryCount + 1), 500);
            return;
        }
        console.error('❌ Supabase library failed to load');
        showNotification('Database connection issue. Please refresh.', 'error');
        return;
    }
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabase = supabaseClient;
        console.log('✅ Supabase client created');
        
        checkSessionAndLoadSubmissions();
        
    } catch (error) {
        console.error('❌ Supabase init error:', error);
        if (retryCount < 5) {
            setTimeout(() => initSupabaseAndLoad(retryCount + 1), 1000);
        }
    }
}

async function checkSessionAndLoadSubmissions() {
    try {
        console.log('🔐 Checking session...');
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Session error:', error);
            return;
        }
        
        if (!session) {
            console.log('⚠️ No active session, redirecting to login');
            showNotification('Please login to view submissions', 'warning');
            setTimeout(() => {
                window.location.href = '../login.html';
            }, 2000);
            return;
        }
        
        console.log('👤 User logged in:', session.user.email);
        await loadSubmissionsFromSupabase();
        
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// ===========================================
// LOAD SUBMISSIONS
// ===========================================

async function loadSubmissionsFromSupabase() {
    console.log('📡 Loading submissions from Supabase farms table...');
    showNotification('Loading submissions...', 'info');
    
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr><td colspan="8" style="text-align:center;padding:60px;">
                <i class="fas fa-spinner fa-spin" style="font-size:48px;color:#2c6e49;"></i>
                <p style="margin-top:15px;">Loading submissions from database...</p>
            </td></tr>
        `;
    }
    
    try {
        const { data: farms, error } = await supabaseClient
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        console.log('Raw farms data:', farms);
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms from database`);
            
            allSubmissions = farms.map(farm => ({
                id: farm.id,
                farmer_id: farm.farmer_id || farm.id,
                farmer_name: farm.farmer_name || 'Unknown Farmer',
                cooperative: farm.cooperative_name || farm.cooperative || 'Unassigned',
                supplier: farm.supplier || 'Unknown',
                area: parseFloat(farm.area) || 0,
                status: farm.status || 'pending',
                enumerator: farm.enumerator || 'N/A',
                submission_date: farm.submission_date || farm.created_at,
                created_at: farm.created_at,
                geometry: farm.geometry
            }));
            
            console.log(`📊 Processed ${allSubmissions.length} submissions`);
            
            updateSupplierFilter();
            applyFiltersAndRender();
            
            showNotification(`Loaded ${allSubmissions.length} submissions`, 'success');
            
        } else {
            console.log('⚠️ No farms found in database');
            tableBody.innerHTML = `
                <tr><td colspan="8" style="text-align:center;padding:60px;">
                    <i class="fas fa-check-circle" style="font-size:48px;color:#22c55e;"></i>
                    <h3>No Submissions Found</h3>
                    <p style="color:#64748b;">No farms have been submitted yet.</p>
                </td></tr>
            `;
        }
        
    } catch (error) {
        console.error('Error loading submissions:', error);
        showNotification('Error loading submissions: ' + error.message, 'error');
        
        if (tableBody) {
            tableBody.innerHTML = `
                <tr><td colspan="8" style="text-align:center;padding:60px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#dc2626;"></i>
                    <h3>Error Loading Data</h3>
                    <p style="color:#64748b;">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top:15px;padding:8px 16px;background:#2c6e49;color:white;border:none;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </td></tr>
            `;
        }
    }
}

// ===========================================
// FILTER AND SORT FUNCTIONS
// ===========================================

function updateSupplierFilter() {
    const suppliers = [...new Set(allSubmissions.map(s => s.supplier))];
    const supplierSelect = document.getElementById('supplierFilter');
    if (supplierSelect) {
        supplierSelect.innerHTML = '<option value="all">All Suppliers</option>' + 
            suppliers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    }
}

function applyFiltersAndRender() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const supplier = document.getElementById('supplierFilter')?.value || 'all';
    const status = document.getElementById('statusFilter')?.value || 'all';
    
    filteredSubmissions = allSubmissions.filter(sub => {
        if (searchTerm && !sub.farmer_name.toLowerCase().includes(searchTerm) && 
            !sub.farmer_id.toLowerCase().includes(searchTerm) &&
            !sub.cooperative.toLowerCase().includes(searchTerm)) {
            return false;
        }
        if (supplier !== 'all' && sub.supplier !== supplier) return false;
        if (status !== 'all' && sub.status !== status) return false;
        return true;
    });
    
    // Apply sorting
    filteredSubmissions.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        
        if (sortColumn === 'submission_date') {
            valA = new Date(valA);
            valB = new Date(valB);
        } else if (sortColumn === 'area') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    updateStats();
    currentPage = 1;
    renderTable();
    updatePagination();
}

function updateStats() {
    const validated = filteredSubmissions.filter(s => s.status === 'validated').length;
    const pending = filteredSubmissions.filter(s => s.status === 'pending').length;
    const rejected = filteredSubmissions.filter(s => s.status === 'rejected').length;
    
    document.getElementById('totalSubmissions').textContent = filteredSubmissions.length;
    document.getElementById('validatedCount').textContent = validated;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('rejectedCount').textContent = rejected;
}

function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    applyFiltersAndRender();
}

function renderTable() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = filteredSubmissions.slice(start, start + rowsPerPage);
    
    if (pageData.length === 0) {
        tableBody.innerHTML = `
            <tr><td colspan="8" style="text-align:center;padding:60px;">
                <i class="fas fa-inbox" style="font-size:48px;color:#94a3b8;"></i>
                <p style="margin-top:15px;color:#64748b;">No submissions found</p>
            </td></tr>
        `;
        document.getElementById('showingCount').textContent = '0';
        document.getElementById('totalCount').textContent = filteredSubmissions.length;
        return;
    }
    
    tableBody.innerHTML = pageData.map(sub => `
        <tr>
            <td><strong>${escapeHtml(sub.farmer_name)}</strong></td>
            <td>${escapeHtml(sub.farmer_id)}</td>
            <td>${escapeHtml(sub.cooperative)}</td>
            <td>${escapeHtml(sub.supplier)}</td>
            <td>${sub.area.toFixed(2)}</td>
            <td>${formatDate(sub.submission_date)}</td>
            <td><span class="status-badge ${sub.status}">${sub.status}</span></td>
            <td class="action-buttons">
                <button class="action-btn view" onclick="viewSubmission('${sub.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${sub.status === 'pending' ? `
                    <button class="action-btn validate" onclick="updateStatus('${sub.id}', 'validated')">
                        <i class="fas fa-check"></i> Validate
                    </button>
                    <button class="action-btn reject" onclick="updateStatus('${sub.id}', 'rejected')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
    
    document.getElementById('showingCount').textContent = `${start + 1}-${Math.min(start + rowsPerPage, filteredSubmissions.length)}`;
    document.getElementById('totalCount').textContent = filteredSubmissions.length;
}

function updatePagination() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    const pageNumbers = document.getElementById('pageNumbers');
    
    if (!pageNumbers) return;
    
    let pagesHtml = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<button class="page-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    pageNumbers.innerHTML = pagesHtml;
    
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || totalPages === 0;
}

// ===========================================
// CRUD OPERATIONS
// ===========================================

async function updateStatus(submissionId, newStatus) {
    console.log(`Updating submission ${submissionId} to ${newStatus}`);
    
    try {
        const { error } = await supabaseClient
            .from('farms')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', submissionId);
        
        if (error) throw error;
        
        // Update local data
        const submission = allSubmissions.find(s => s.id === submissionId);
        if (submission) submission.status = newStatus;
        
        showNotification(`Submission ${newStatus} successfully`, 'success');
        applyFiltersAndRender();
        
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error updating status: ' + error.message, 'error');
    }
}

function viewSubmission(submissionId) {
    const submission = allSubmissions.find(s => s.id === submissionId);
    if (!submission) return;
    
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-tractor"></i> Submission Details</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="modal-section">
                    <div class="modal-section-title">Farm Information</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div><strong>Farmer Name:</strong><br>${escapeHtml(submission.farmer_name)}</div>
                        <div><strong>Farmer ID:</strong><br>${escapeHtml(submission.farmer_id)}</div>
                        <div><strong>Cooperative:</strong><br>${escapeHtml(submission.cooperative)}</div>
                        <div><strong>Supplier:</strong><br>${escapeHtml(submission.supplier)}</div>
                        <div><strong>Area:</strong><br>${submission.area.toFixed(2)} ha</div>
                        <div><strong>Status:</strong><br><span class="status-badge ${submission.status}">${submission.status}</span></div>
                        <div><strong>Enumerator:</strong><br>${escapeHtml(submission.enumerator)}</div>
                        <div><strong>Submission Date:</strong><br>${formatDate(submission.submission_date)}</div>
                    </div>
                </div>
                <div class="modal-actions">
                    ${submission.status === 'pending' ? `
                        <button class="modal-btn primary" onclick="updateStatus('${submission.id}', 'validated'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-check"></i> Validate
                        </button>
                        <button class="modal-btn danger" onclick="updateStatus('${submission.id}', 'rejected'); document.querySelector('.modal-overlay').remove()">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : ''}
                    <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ===========================================
// PAGINATION
// ===========================================

function goToPage(page) {
    currentPage = page;
    renderTable();
    updatePagination();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredSubmissions.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
    }
}

function filterSubmissions() {
    applyFiltersAndRender();
}

function refreshTable() {
    loadSubmissionsFromSupabase();
}

// ===========================================
// EXPORT FUNCTION
// ===========================================

function exportToCSV() {
    if (filteredSubmissions.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    const headers = ['Farmer Name', 'Farmer ID', 'Cooperative', 'Supplier', 'Area (ha)', 'Status', 'Enumerator', 'Submission Date'];
    const rows = filteredSubmissions.map(sub => [
        sub.farmer_name,
        sub.farmer_id,
        sub.cooperative,
        sub.supplier,
        sub.area.toFixed(2),
        sub.status,
        sub.enumerator,
        new Date(sub.submission_date).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `submissions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Export completed successfully', 'success');
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
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
    notification.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;background:${colors[type]};color:white;border-radius:8px;z-index:10001;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function setupEventListeners() {
    document.getElementById('searchInput')?.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') filterSubmissions();
    });
    document.getElementById('supplierFilter')?.addEventListener('change', () => applyFiltersAndRender());
    document.getElementById('statusFilter')?.addEventListener('change', () => applyFiltersAndRender());
    document.getElementById('refreshBtn')?.addEventListener('click', () => refreshTable());
    
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (supabaseClient) await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = '../login.html';
    });
}

// Make functions global
window.filterSubmissions = filterSubmissions;
window.sortTable = sortTable;
window.viewSubmission = viewSubmission;
window.updateStatus = updateStatus;
window.goToPage = goToPage;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.refreshTable = refreshTable;
window.exportToCSV = exportToCSV;

console.log('✅ Submissions page ready');
