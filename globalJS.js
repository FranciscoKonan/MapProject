// ===========================================
// GLOBAL JS - Dashboard Data Management
// ===========================================

console.log('🌍 Global JS loading...');

// Global variables
let globalFarms = [];
let globalAlerts = [];
let currentSortColumn = 'submissionDate';
let currentSortDirection = 'desc';
let currentPage = 1;
let rowsPerPage = 10;

// ===========================================
// WAIT FOR SUPABASE
// ===========================================
function waitForSupabase() {
    return new Promise((resolve) => {
        if (window.supabase && window.supabase.auth) {
            console.log('✅ Global JS: Supabase already ready');
            resolve(window.supabase);
            return;
        }
        
        window.addEventListener('supabase-ready', () => {
            console.log('✅ Global JS: Supabase ready event received');
            resolve(window.supabase);
        });
        
        // Fallback timeout
        setTimeout(() => {
            if (window.supabase && window.supabase.auth) {
                console.log('✅ Global JS: Supabase ready (timeout)');
                resolve(window.supabase);
            } else {
                console.error('❌ Global JS: Supabase timeout');
                resolve(null);
            }
        }, 10000);
    });
}

// ===========================================
// LOAD USER DATA
// ===========================================
function loadUserData() {
    const userData = localStorage.getItem('mappingtrace_user');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            const userAvatarEl = document.getElementById('userAvatar');
            
            if (userNameEl) userNameEl.textContent = user.fullName || 'User';
            if (userRoleEl) userRoleEl.textContent = user.role || 'User';
            if (userAvatarEl) userAvatarEl.textContent = user.avatar || 'U';
            
            console.log('👤 User loaded:', user.fullName);
        } catch (e) {
            console.warn('Error parsing user data:', e);
        }
    }
}

// ===========================================
// LOAD FARMS DATA
// ===========================================
async function loadFarmsData() {
    console.log('📡 Loading farms data...');
    showLoading(true);
    
    try {
        if (!window.supabase) {
            console.error('❌ Supabase not available');
            showLoading(false);
            return;
        }
        
        // Check session
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            console.log('⚠️ No session, redirecting to login');
            window.location.href = 'login.html';
            showLoading(false);
            return;
        }
        
        console.log('👤 User logged in:', session.user.email);
        
        // Fetch farms
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms`);
            globalFarms = farms;
            
            // Update KPI
            updateKPIs(farms);
            
            // Update table
            updateTable(farms);
            
            // Update alerts
            updateAlertsCount(farms);
            
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('farms-loaded', { detail: { farms: farms } }));
            
        } else {
            console.log('⚠️ No farms found');
            updateKPIs([]);
            updateTable([]);
        }
        
    } catch (error) {
        console.error('Error loading farms:', error);
        showNotification('Error loading data: ' + error.message, 'error');
    }
    
    showLoading(false);
}

// ===========================================
// UPDATE KPIs
// ===========================================
function updateKPIs(farms) {
    // Total farms
    const farmsCount = document.getElementById('farmsCount');
    if (farmsCount) farmsCount.textContent = farms.length;
    
    // Total area
    const totalArea = farms.reduce((sum, farm) => sum + (parseFloat(farm.area) || 0), 0);
    const totalAreaEl = document.getElementById('totalArea');
    if (totalAreaEl) totalAreaEl.textContent = totalArea.toFixed(1);
    
    // Active plots (validated)
    const activePlots = farms.filter(f => f.status === 'validated').length;
    const activePlotsEl = document.getElementById('activePlots');
    if (activePlotsEl) activePlotsEl.textContent = activePlots;
}

// ===========================================
// UPDATE ALERTS COUNT
// ===========================================
function updateAlertsCount(farms) {
    // Simple alert detection
    let alertCount = 0;
    farms.forEach(farm => {
        // Check for missing geometry
        if (!farm.geometry) alertCount++;
        // Check for missing data
        if (!farm.farmer_name) alertCount++;
        // Check for area issues
        if (farm.area === 0) alertCount++;
    });
    
    const alertsCount = document.getElementById('alertsCount');
    const alertsBadge = document.getElementById('alertsBadge');
    const notificationBadge = document.getElementById('notificationBadge');
    
    if (alertsCount) alertsCount.textContent = alertCount;
    if (alertsBadge) alertsBadge.textContent = alertCount;
    if (notificationBadge) {
        notificationBadge.textContent = alertCount;
        notificationBadge.style.display = alertCount > 0 ? 'flex' : 'none';
    }
}

// ===========================================
// UPDATE TABLE
// ===========================================
function updateTable(farms) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    // Sort farms
    const sortedFarms = [...farms].sort((a, b) => {
        let aVal = a[currentSortColumn];
        let bVal = b[currentSortColumn];
        
        if (currentSortColumn === 'area') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (currentSortColumn === 'submissionDate') {
            aVal = new Date(aVal || a.created_at).getTime();
            bVal = new Date(bVal || b.created_at).getTime();
        } else {
            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
        }
        
        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Paginate
    const start = (currentPage - 1) * rowsPerPage;
    const pageFarms = sortedFarms.slice(start, start + rowsPerPage);
    const totalCount = sortedFarms.length;
    
    // Update showing count
    const showingCount = document.getElementById('showingCount');
    const totalCountEl = document.getElementById('totalCount');
    if (showingCount) showingCount.textContent = `${start + 1}-${Math.min(start + rowsPerPage, totalCount)}`;
    if (totalCountEl) totalCountEl.textContent = totalCount;
    
    if (pageFarms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;">No farms found</td></tr>';
        updatePagination(1, Math.ceil(totalCount / rowsPerPage));
        return;
    }
    
    tbody.innerHTML = pageFarms.map(farm => `
        <tr>
            <td>${farm.farmer_id || farm.id}</td>
            <td>${farm.farmer_name || 'Unknown'}</td>
            <td>${farm.cooperative || farm.cooperative_name || 'Unassigned'}</td>
            <td>${(farm.area || 0).toFixed(2)}</td>
            <td>${new Date(farm.created_at || farm.submission_date).toLocaleDateString()}</td>
            <td><span class="status-badge ${farm.status || 'pending'}">${farm.status || 'pending'}</span></td>
            <td>
                <button class="action-btn view" onclick="viewFarm('${farm.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                ${(farm.status === 'pending') ? `
                    <button class="action-btn approve" onclick="approveFarm('${farm.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="action-btn reject" onclick="rejectFarm('${farm.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
    
    updatePagination(currentPage, Math.ceil(totalCount / rowsPerPage));
}

function updatePagination(current, total) {
    const pageNumbers = document.getElementById('pageNumbers');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (!pageNumbers) return;
    
    if (prevBtn) prevBtn.disabled = current === 1;
    if (nextBtn) nextBtn.disabled = current === total || total === 0;
    
    let html = '';
    for (let i = 1; i <= Math.min(total, 5); i++) {
        html += `<span class="page-number ${i === current ? 'active' : ''}" onclick="goToPage(${i})">${i}</span>`;
    }
    pageNumbers.innerHTML = html;
}

// ===========================================
// TABLE FUNCTIONS
// ===========================================
window.sortTable = function(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    updateTable(globalFarms);
};

window.filterTable = function() {
    const searchTerm = document.getElementById('tableSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    
    let filteredFarms = globalFarms;
    
    if (searchTerm) {
        filteredFarms = filteredFarms.filter(farm => 
            (farm.farmer_id || '').toLowerCase().includes(searchTerm) ||
            (farm.farmer_name || '').toLowerCase().includes(searchTerm)
        );
    }
    
    if (statusFilter !== 'all') {
        filteredFarms = filteredFarms.filter(farm => farm.status === statusFilter);
    }
    
    updateTable(filteredFarms);
};

window.refreshTable = function() {
    loadFarmsData();
};

window.goToPage = function(page) {
    currentPage = page;
    updateTable(globalFarms);
};

window.prevPage = function() {
    if (currentPage > 1) {
        currentPage--;
        updateTable(globalFarms);
    }
};

window.nextPage = function() {
    const total = Math.ceil(globalFarms.length / rowsPerPage);
    if (currentPage < total) {
        currentPage++;
        updateTable(globalFarms);
    }
};

// ===========================================
// FARM ACTIONS
// ===========================================
window.viewFarm = function(farmId) {
    const farm = globalFarms.find(f => f.id === farmId);
    if (farm) {
        alert(`Farm: ${farm.farmer_name || 'Unknown'}\nID: ${farm.farmer_id || farm.id}\nArea: ${farm.area || 0} ha\nStatus: ${farm.status || 'pending'}`);
    }
};

window.approveFarm = async function(farmId) {
    if (!confirm('Approve this farm?')) return;
    
    try {
        const { error } = await window.supabase
            .from('farms')
            .update({ status: 'validated' })
            .eq('id', farmId);
        
        if (error) throw error;
        
        showNotification('Farm approved!', 'success');
        loadFarmsData();
        
    } catch (error) {
        console.error('Error approving farm:', error);
        showNotification('Error approving farm', 'error');
    }
};

window.rejectFarm = async function(farmId) {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    
    try {
        const { error } = await window.supabase
            .from('farms')
            .update({ status: 'rejected', rejection_reason: reason })
            .eq('id', farmId);
        
        if (error) throw error;
        
        showNotification('Farm rejected!', 'info');
        loadFarmsData();
        
    } catch (error) {
        console.error('Error rejecting farm:', error);
        showNotification('Error rejecting farm', 'error');
    }
};

// ===========================================
// ALERT FUNCTIONS
// ===========================================
window.refreshAlerts = function() {
    loadFarmsData();
    showNotification('Alerts refreshed', 'info');
};

window.viewAllAlerts = function() {
    const alertCount = document.getElementById('alertsCount')?.textContent || 0;
    if (alertCount === '0') {
        showNotification('No alerts to display', 'info');
    } else {
        alert(`Total Alerts: ${alertCount}\n\nCheck farms with missing data or geometry issues.`);
    }
};

// ===========================================
// MAP FUNCTIONS
// ===========================================
window.refreshMapData = function() {
    showNotification('Map data refreshed', 'info');
    if (typeof window.loadFarmsToMap === 'function') {
        window.loadFarmsToMap(globalFarms);
    }
};

window.zoomIn = function() {
    if (window.map) window.map.zoomIn();
};

window.zoomOut = function() {
    if (window.map) window.map.zoomOut();
};

window.resetView = function() {
    if (window.map) window.map.setView([7.539989, -5.547080], 8);
};

window.locateMe = function() {
    if (!window.map) return;
    window.map.locate({ setView: true, maxZoom: 16 });
    window.map.once('locationfound', function(e) {
        L.marker(e.latlng).addTo(window.map).bindPopup('You are here').openPopup();
    });
};

window.setBaseLayer = function(type) {
    showNotification(`Switched to ${type} view`, 'info');
};

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

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 Global JS: DOM ready');
    
    loadUserData();
    
    const supabase = await waitForSupabase();
    
    if (!supabase) {
        console.error('❌ Global JS: Supabase not available');
        showNotification('Failed to initialize. Please refresh.', 'error');
        showLoading(false);
        return;
    }
    
    console.log('✅ Global JS: Supabase ready, loading dashboard data...');
    loadFarmsData();
});

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }
    .status-badge.validated { background: #d1fae5; color: #065f46; }
    .status-badge.pending { background: #fff3cd; color: #856404; }
    .status-badge.rejected { background: #fee2e2; color: #991b1b; }
    .action-btn {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin: 0 2px;
    }
    .action-btn.view { background: #2196F3; color: white; }
    .action-btn.approve { background: #4CAF50; color: white; }
    .action-btn.reject { background: #f44336; color: white; }
    .page-number {
        cursor: pointer;
        padding: 5px 10px;
        margin: 0 2px;
        border-radius: 4px;
        border: 1px solid #e2e8f0;
        background: white;
    }
    .page-number:hover { background: #e2e8f0; }
    .page-number.active { background: #2c6e49; color: white; border-color: #2c6e49; }
`;
document.head.appendChild(style);

console.log('✅ Global JS ready');
