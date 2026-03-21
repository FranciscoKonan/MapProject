// Add these functions to your existing live-mapping.js

// ===========================================
// SUPPLIER AND COOPERATIVE SEARCH
// ===========================================

let supplierSearchTerm = '';
let coopSearchTerm = '';

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

// Update your updateFilterOptions function to call initSearchListeners
function updateFilterOptions() {
    uniqueSuppliers = [...new Set(allFarms.map(f => f.supplier))].sort();
    uniqueCooperatives = [...new Set(allFarms.map(f => f.cooperative))].sort();
    
    // Initialize search listeners
    initSearchListeners();
    
    // Update selects
    updateSupplierFilter();
    updateCooperativeFilter();
    
    console.log('📊 Suppliers:', uniqueSuppliers);
    console.log('📊 Cooperatives:', uniqueCooperatives);
}
