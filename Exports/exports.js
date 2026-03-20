// ===========================================
// EXPORTS PAGE - COMPLETE APPLICATION
// ===========================================

console.log('🚀 Exports initializing...');

// ===========================================
// GLOBAL VARIABLES
// ===========================================
let allFarms = [];
let filteredFarms = [];
let selectedSuppliers = new Set();
let selectedCooperatives = new Set();
let selectedStatuses = new Set(['validated', 'pending', 'rejected']);
let exportFormat = 'csv';

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
// LOADING INDICATOR
// ===========================================
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

// ===========================================
// LOAD FARMS
// ===========================================
function loadFarms() {
    console.log('🔍 Loading farms for export...');
    showLoading();
    
    // Try from Supabase first
    loadFarmsFromSupabase();
}

async function loadFarmsFromSupabase() {
    if (!window.supabase) {
        console.error('❌ Supabase not available');
        loadSampleData();
        return;
    }
    
    try {
        console.log('📡 Loading farms from Supabase...');
        const { data: farms, error } = await window.supabase
            .from('farms')
            .select('*');
            
        if (error) throw error;
        
        if (farms && farms.length > 0) {
            console.log(`✅ Loaded ${farms.length} farms from Supabase`);
            
            // Transform farms data
            allFarms = farms.map(farm => {
                let supplier = farm.supplier || 'Unknown';
                
                let cooperative = 'Unassigned';
                if (farm.cooperative_name) cooperative = farm.cooperative_name;
                else if (farm.cooperative) cooperative = farm.cooperative;
                else if (farm.coop) cooperative = farm.coop;
                
                return {
                    id: farm.id,
                    farm_id: farm.farm_id || farm.id,
                    farm_name: farm.farm_name || '',
                    farmerName: farm.farmer_name || farm.farmerName || 'Unknown',
                    farmer_name: farm.farmer_name || farm.farmerName || 'Unknown',
                    supplier: supplier,
                    cooperative: cooperative,
                    cooperative_name: cooperative,
                    area: farm.area || 0,
                    status: farm.status || 'pending',
                    submission_date: farm.submission_date || farm.created_at,
                    enumerator: farm.enumerator || 'N/A',
                    geometry: farm.geometry
                };
            });
            
            processFarms();
        } else {
            console.log('⚠️ No farms found in Supabase');
            loadSampleData();
        }
    } catch (error) {
        console.error('Error loading farms:', error);
        loadSampleData();
    }
}

function processFarms() {
    // Extract unique suppliers and cooperatives
    allSuppliers = [...new Set(allFarms.map(f => f.supplier).filter(Boolean))].sort();
    allCooperatives = [...new Set(allFarms.map(f => f.cooperative).filter(Boolean))].sort();
    
    console.log('📊 Suppliers found:', allSuppliers);
    console.log('📊 Cooperatives found:', allCooperatives);
    
    updateStats();
    populateFilters();
    updateExportCount();
    updatePreviewHeader();
    hideLoading();
}

// ===========================================
// UPDATE STATS
// ===========================================
function updateStats() {
    document.getElementById('totalFarms').textContent = allFarms.length;
    
    const totalArea = allFarms.reduce((sum, farm) => sum + (parseFloat(farm.area) || 0), 0);
    document.getElementById('totalArea').textContent = `${totalArea.toFixed(2)} ha`;
    
    const validated = allFarms.filter(f => f.status === 'validated').length;
    const pending = allFarms.filter(f => f.status === 'pending').length;
    const rejected = allFarms.filter(f => f.status === 'rejected').length;
    
    document.getElementById('validatedCount').textContent = validated;
    document.getElementById('pendingCount').textContent = pending;
}

// ===========================================
// POPULATE FILTERS
// ===========================================
function populateFilters() {
    selectedSuppliers = new Set(allSuppliers);
    selectedCooperatives = new Set(allCooperatives);
    
    updateSupplierList();
    updateCooperativeList();
    
    // Event listeners
    document.getElementById('selectAllSuppliers')?.addEventListener('change', toggleAllSuppliers);
    document.getElementById('selectAllCooperatives')?.addEventListener('change', toggleAllCooperatives);
    
    document.querySelectorAll('.status-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedStatuses.add(e.target.value);
            else selectedStatuses.delete(e.target.value);
            updateSelectedFilters();
        });
    });
    
    document.querySelectorAll('.format-option').forEach(opt => {
        opt.addEventListener('click', () => selectFormat(opt.dataset.format));
    });
    
    initSearchListeners();
}

// ===========================================
// SEARCH FUNCTIONS
// ===========================================
function initSearchListeners() {
    const supplierSearch = document.getElementById('supplierSearch');
    const coopSearch = document.getElementById('coopSearch');
    
    if (supplierSearch) {
        supplierSearch.addEventListener('input', (e) => {
            supplierSearchTerm = e.target.value.toLowerCase();
            updateSupplierList();
        });
    }
    
    if (coopSearch) {
        coopSearch.addEventListener('input', (e) => {
            coopSearchTerm = e.target.value.toLowerCase();
            updateCooperativeList();
        });
    }
}

function updateSupplierList() {
    const supplierList = document.getElementById('supplierList');
    if (!supplierList) return;
    
    const filtered = allSuppliers.filter(s => s.toLowerCase().includes(supplierSearchTerm));
    
    if (filtered.length === 0 && supplierSearchTerm) {
        supplierList.innerHTML = `<div class="search-empty-state"><i class="fas fa-search"></i><span>No suppliers matching "${supplierSearchTerm}"</span></div>`;
        return;
    }
    
    const selectedValues = Array.from(selectedSuppliers);
    
    supplierList.innerHTML = filtered.map(supplier => `
        <label class="checkbox-item">
            <input type="checkbox" class="supplier-checkbox" value="${supplier}" ${selectedValues.includes(supplier) ? 'checked' : ''}>
            <span class="checkbox-label">${supplier}</span>
        </label>
    `).join('');
    
    document.querySelectorAll('.supplier-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedSuppliers.add(e.target.value);
            else selectedSuppliers.delete(e.target.value);
            updateSelectedFilters();
            updateSelectAllCheckbox('supplier');
        });
    });
}

function updateCooperativeList() {
    const cooperativeList = document.getElementById('cooperativeList');
    if (!cooperativeList) return;
    
    const filtered = allCooperatives.filter(c => c.toLowerCase().includes(coopSearchTerm));
    
    if (filtered.length === 0 && coopSearchTerm) {
        cooperativeList.innerHTML = `<div class="search-empty-state"><i class="fas fa-search"></i><span>No cooperatives matching "${coopSearchTerm}"</span></div>`;
        return;
    }
    
    const selectedValues = Array.from(selectedCooperatives);
    
    cooperativeList.innerHTML = filtered.map(coop => `
        <label class="checkbox-item">
            <input type="checkbox" class="cooperative-checkbox" value="${coop}" ${selectedValues.includes(coop) ? 'checked' : ''}>
            <span class="checkbox-label">${coop}</span>
        </label>
    `).join('');
    
    document.querySelectorAll('.cooperative-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedCooperatives.add(e.target.value);
            else selectedCooperatives.delete(e.target.value);
            updateSelectedFilters();
            updateSelectAllCheckbox('cooperative');
        });
    });
}

function updateSelectAllCheckbox(type) {
    if (type === 'supplier') {
        const checkboxes = document.querySelectorAll('.supplier-checkbox');
        const selectAll = document.getElementById('selectAllSuppliers');
        if (selectAll && checkboxes.length) {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            selectAll.checked = allChecked;
            selectAll.indeterminate = !allChecked && Array.from(checkboxes).some(cb => cb.checked);
        }
    } else if (type === 'cooperative') {
        const checkboxes = document.querySelectorAll('.cooperative-checkbox');
        const selectAll = document.getElementById('selectAllCooperatives');
        if (selectAll && checkboxes.length) {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            selectAll.checked = allChecked;
            selectAll.indeterminate = !allChecked && Array.from(checkboxes).some(cb => cb.checked);
        }
    }
}

// ===========================================
// FILTER HANDLING
// ===========================================
function updateSelectedFilters() {
    const selectedSuppliersArr = Array.from(document.querySelectorAll('.supplier-checkbox:checked')).map(cb => cb.value);
    const selectedCooperativesArr = Array.from(document.querySelectorAll('.cooperative-checkbox:checked')).map(cb => cb.value);
    const selectedStatusesArr = Array.from(document.querySelectorAll('.status-checkbox:checked')).map(cb => cb.value);
    
    filteredFarms = allFarms.filter(farm => {
        if (selectedSuppliersArr.length && !selectedSuppliersArr.includes(farm.supplier)) return false;
        
        const farmCoop = farm.cooperative || farm.cooperative_name;
        if (selectedCooperativesArr.length && farmCoop && !selectedCooperativesArr.includes(farmCoop)) return false;
        if (selectedCooperativesArr.length && !farmCoop && !selectedCooperativesArr.includes('Unassigned')) return false;
        
        if (selectedStatusesArr.length && !selectedStatusesArr.includes(farm.status)) return false;
        
        return true;
    });
    
    updateExportCount();
}

function toggleAllSuppliers(e) {
    const checked = e.target.checked;
    document.querySelectorAll('.supplier-checkbox').forEach(cb => {
        cb.checked = checked;
        if (checked) selectedSuppliers.add(cb.value);
        else selectedSuppliers.delete(cb.value);
    });
    updateSelectedFilters();
}

function toggleAllCooperatives(e) {
    const checked = e.target.checked;
    document.querySelectorAll('.cooperative-checkbox').forEach(cb => {
        cb.checked = checked;
        if (checked) selectedCooperatives.add(cb.value);
        else selectedCooperatives.delete(cb.value);
    });
    updateSelectedFilters();
}

function selectFormat(format) {
    exportFormat = format;
    document.querySelectorAll('.format-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.format === format);
    });
    document.querySelector(`input[name="exportFormat"][value="${format}"]`).checked = true;
}

function updateExportCount() {
    document.getElementById('exportCount').textContent = filteredFarms.length;
    const totalArea = filteredFarms.reduce((sum, farm) => sum + (parseFloat(farm.area) || 0), 0);
    document.getElementById('exportArea').textContent = `${totalArea.toFixed(2)} ha`;
}

// ===========================================
// PREVIEW FUNCTIONS
// ===========================================
function updatePreviewHeader() {
    const header = document.getElementById('previewHeader');
    if (header) {
        header.innerHTML = `
            <tr><th>Farm ID</th><th>Farm Name</th><th>Farmer Name</th><th>Supplier</th><th>Cooperative</th><th>Area (ha)</th><th>Status</th></tr>
        `;
    }
}

function previewData() {
    const previewSection = document.getElementById('previewSection');
    const previewBody = document.getElementById('previewBody');
    const previewTotal = document.getElementById('previewTotal');
    
    if (!previewSection || !previewBody) return;
    
    if (filteredFarms.length === 0) {
        showNotification('No farms to preview', 'warning');
        return;
    }
    
    const previewFarms = filteredFarms.slice(0, 10);
    
    previewBody.innerHTML = previewFarms.map(farm => `
        <tr>
            <td>${farm.farm_id || farm.id || ''}</td>
            <td>${farm.farm_name || ''}</td>
            <td>${farm.farmerName || farm.farmer_name || 'Unknown'}</td>
            <td>${farm.supplier || 'Unknown'}</td>
            <td>${farm.cooperative || farm.cooperative_name || 'Unassigned'}</td>
            <td>${(farm.area || 0).toFixed(2)}</td>
            <td><span class="status-badge ${farm.status}">${farm.status}</span></td>
        </tr>
    `).join('');
    
    previewTotal.textContent = filteredFarms.length;
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.hidePreview = function() {
    document.getElementById('previewSection').style.display = 'none';
};

// ===========================================
// EXPORT FUNCTIONS
// ===========================================
function exportData() {
    if (filteredFarms.length === 0) {
        showNotification('No farms selected for export', 'warning');
        return;
    }
    
    showNotification(`Exporting ${filteredFarms.length} farms as ${exportFormat.toUpperCase()}...`, 'info');
    
    switch(exportFormat) {
        case 'csv': exportToCSV(); break;
        case 'excel': exportToExcel(); break;
        case 'geojson': exportToGeoJSON(); break;
        case 'kml': exportToKML(); break;
        default: showNotification('Unsupported format', 'error');
    }
}

function exportToCSV() {
    const headers = ['Farm ID', 'Farm Name', 'Farmer Name', 'Supplier', 'Cooperative', 'Area (ha)', 'Status', 'Submission Date'];
    const rows = filteredFarms.map(farm => [
        farm.farm_id || farm.id || '',
        farm.farm_name || '',
        farm.farmerName || farm.farmer_name || 'Unknown',
        farm.supplier || 'Unknown',
        farm.cooperative || farm.cooperative_name || 'Unassigned',
        (farm.area || 0).toFixed(2),
        farm.status || 'pending',
        farm.submission_date ? new Date(farm.submission_date).toLocaleDateString() : ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `farms_export_${new Date().toISOString().slice(0,10)}.csv`;
    saveAs(blob, filename);
    addToHistory(filename, filteredFarms.length, 'CSV');
    showNotification(`Exported ${filteredFarms.length} farms to CSV`, 'success');
}

function exportToExcel() {
    const worksheet = XLSX.utils.json_to_sheet(filteredFarms.map(farm => ({
        'Farm ID': farm.farm_id || farm.id || '',
        'Farm Name': farm.farm_name || '',
        'Farmer Name': farm.farmerName || farm.farmer_name || 'Unknown',
        'Supplier': farm.supplier || 'Unknown',
        'Cooperative': farm.cooperative || farm.cooperative_name || 'Unassigned',
        'Area (ha)': parseFloat(farm.area) || 0,
        'Status': farm.status || 'pending',
        'Submission Date': farm.submission_date ? new Date(farm.submission_date).toLocaleDateString() : ''
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Farms');
    const filename = `farms_export_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    addToHistory(filename, filteredFarms.length, 'Excel');
    showNotification(`Exported ${filteredFarms.length} farms to Excel`, 'success');
}

function exportToGeoJSON() {
    const features = filteredFarms.map(farm => ({
        type: 'Feature',
        properties: {
            id: farm.farm_id || farm.id,
            farm_name: farm.farm_name || '',
            farmer_name: farm.farmerName || farm.farmer_name || 'Unknown',
            supplier: farm.supplier || 'Unknown',
            cooperative: farm.cooperative || farm.cooperative_name || 'Unassigned',
            area: parseFloat(farm.area) || 0,
            status: farm.status || 'pending',
            submission_date: farm.submission_date
        },
        geometry: farm.geometry || { type: 'Point', coordinates: [0, 0] }
    }));
    
    const geojson = { type: 'FeatureCollection', features: features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const filename = `farms_export_${new Date().toISOString().slice(0,10)}.geojson`;
    saveAs(blob, filename);
    addToHistory(filename, filteredFarms.length, 'GeoJSON');
    showNotification(`Exported ${filteredFarms.length} farms to GeoJSON`, 'success');
}

function exportToKML() {
    let kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Farm Exports</name>`;
    kml += filteredFarms.map(farm => `
        <Placemark>
            <name>${farm.farmerName || farm.farmer_name || 'Farm'}</name>
            <description>Farmer: ${farm.farmerName || farm.farmer_name || 'Unknown'}\nSupplier: ${farm.supplier || 'Unknown'}\nCooperative: ${farm.cooperative || farm.cooperative_name || 'Unassigned'}\nArea: ${farm.area || 0} ha\nStatus: ${farm.status || 'pending'}</description>
            <Point><coordinates>0,0</coordinates></Point>
        </Placemark>
    `).join('');
    kml += `</Document></kml>`;
    
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const filename = `farms_export_${new Date().toISOString().slice(0,10)}.kml`;
    saveAs(blob, filename);
    addToHistory(filename, filteredFarms.length, 'KML');
    showNotification(`Exported ${filteredFarms.length} farms to KML`, 'success');
}

// ===========================================
// RESET FILTERS
// ===========================================
function resetFilters() {
    supplierSearchTerm = '';
    coopSearchTerm = '';
    
    document.getElementById('supplierSearch').value = '';
    document.getElementById('coopSearch').value = '';
    
    selectedSuppliers = new Set(allSuppliers);
    selectedCooperatives = new Set(allCooperatives);
    selectedStatuses = new Set(['validated', 'pending', 'rejected']);
    
    document.querySelectorAll('.supplier-checkbox').forEach(cb => cb.checked = true);
    document.querySelectorAll('.cooperative-checkbox').forEach(cb => cb.checked = true);
    document.querySelectorAll('.status-checkbox').forEach(cb => cb.checked = true);
    
    document.getElementById('selectAllSuppliers').checked = true;
    document.getElementById('selectAllCooperatives').checked = true;
    
    updateSupplierList();
    updateCooperativeList();
    updateSelectedFilters();
    showNotification('Filters reset', 'success');
}

// ===========================================
// EXPORT HISTORY
// ===========================================
function addToHistory(filename, count, format) {
    const historyList = document.getElementById('exportHistory');
    if (!historyList) return;
    
    if (historyList.querySelector('.empty-history')) historyList.innerHTML = '';
    
    const icon = format === 'CSV' ? 'file-csv' : format === 'Excel' ? 'file-excel' : 'file';
    const date = new Date();
    
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <div class="history-info">
            <div class="history-icon"><i class="fas fa-${icon}"></i></div>
            <div class="history-details">
                <div class="history-filename">${filename}</div>
                <div class="history-meta"><span><i class="fas fa-layer-group"></i> ${count} farms</span><span><i class="fas fa-clock"></i> ${date.toLocaleTimeString()}</span></div>
            </div>
        </div>
        <button class="history-download" onclick="window.open('${filename}')"><i class="fas fa-download"></i></button>
    `;
    
    historyList.insertBefore(historyItem, historyList.firstChild);
    while (historyList.children.length > 10) historyList.removeChild(historyList.lastChild);
}

// ===========================================
// SAMPLE DATA (FALLBACK)
// ===========================================
function loadSampleData() {
    console.log('📊 Loading sample data');
    allFarms = [
        { id: '1', farm_id: 'F12345', farm_name: 'Koffi Jean Farm', farmerName: 'Koffi Jean', farmer_name: 'Koffi Jean', supplier: 'GCC', cooperative: 'GCC Cooperative', cooperative_name: 'GCC Cooperative', area: 2.5, status: 'validated', enumerator: 'EN001', submission_date: '2024-01-15T10:30:00Z' },
        { id: '2', farm_id: 'F12346', farm_name: 'Konan Marie Farm', farmerName: 'Konan Marie', farmer_name: 'Konan Marie', supplier: 'SITAPA', cooperative: 'SITAPA Cooperative', cooperative_name: 'SITAPA Cooperative', area: 1.8, status: 'pending', enumerator: 'EN002', submission_date: '2024-01-16T14:20:00Z' },
        { id: '3', farm_id: 'F12347', farm_name: 'N\'Guessan Paul Farm', farmerName: 'N\'Guessan Paul', farmer_name: 'N\'Guessan Paul', supplier: 'Other', cooperative: 'COOP-CI', cooperative_name: 'COOP-CI', area: 3.2, status: 'rejected', enumerator: 'EN003', submission_date: '2024-01-14T09:15:00Z' }
    ];
    processFarms();
    hideLoading();
    showNotification('📊 Using sample data', 'info');
}

// ===========================================
// NOTIFICATION FUNCTION
// ===========================================
function showNotification(message, type = 'info') {
    const colors = { success: '#4CAF50', error: '#F44336', warning: '#FFC107', info: '#2196F3' };
    const notification = document.createElement('div');
    notification.style.cssText = `position:fixed; top:20px; right:20px; padding:12px 20px; background:${colors[type]}; color:white; border-radius:8px; z-index:10000; animation:slideIn 0.3s ease; font-family:'Inter',sans-serif;`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease'; setTimeout(() => notification.remove(), 300); }, 3000);
}

// ===========================================
// DEBUG FUNCTION
// ===========================================
window.debugExports = function() {
    console.log('=== EXPORTS DEBUG ===');
    console.log('All farms:', allFarms.length);
    console.log('Filtered farms:', filteredFarms.length);
    console.log('Suppliers:', allSuppliers);
    console.log('Cooperatives:', allCooperatives);
    if (allFarms.length) console.log('Sample farm:', allFarms[0]);
};

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📌 DOM Ready - Exports Page');
    setTimeout(() => loadFarms(), 500);
    
    document.getElementById('exportBtn')?.addEventListener('click', exportData);
    document.getElementById('previewBtn')?.addEventListener('click', previewData);
    document.getElementById('resetBtn')?.addEventListener('click', resetFilters);
    document.getElementById('refreshBtn')?.addEventListener('click', () => { showNotification('Refreshing data...', 'info'); loadFarms(); });
    document.getElementById('notificationsBtn')?.addEventListener('click', () => showNotification('No new notifications', 'info'));
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem('mappingtrace_user'); window.location.href = '../login.html'; });
});

// Add animations
const style = document.createElement('style');
style.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}`;
document.head.appendChild(style);

console.log('✅ Exports initialized');