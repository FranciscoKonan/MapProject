// ===========================================
// NOTIFICATION SYSTEM
// ===========================================

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `alert-notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <div class="alert-notification-icon"><i class="${icons[type]}"></i></div>
            <div class="alert-notification-content">
                <div class="alert-notification-title">${this.getTitle(type)}</div>
                <div class="alert-notification-message">${message}</div>
            </div>
            <button class="alert-notification-close"><i class="fas fa-times"></i></button>
        `;

        this.container.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        if (duration > 0) setTimeout(() => this.remove(notification), duration);
        
        const closeBtn = notification.querySelector('.alert-notification-close');
        closeBtn.addEventListener('click', () => this.remove(notification));
        return notification;
    }

    getTitle(type) {
        const titles = { 
            success: 'Success', 
            error: 'Error', 
            warning: 'Warning', 
            info: 'Information' 
        };
        return titles[type] || 'Notification';
    }

    remove(notification) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }

    success(message, d) { return this.show(message, 'success', d); }
    error(message, d) { return this.show(message, 'error', d); }
    warning(message, d) { return this.show(message, 'warning', d); }
    info(message, d) { return this.show(message, 'info', d); }
}

// Create global notification instance
window.notification = new NotificationSystem();

// ===========================================
// DATA MANAGER
// ===========================================

class DataManager {
    constructor() {
        this.apiBaseUrl = 'http://127.0.0.1:3000/api';
        this.farms = [];
        this.alerts = [];
        this.stats = { 
            totalFarms: 0, 
            totalArea: 0, 
            activePlots: 0, 
            qualityAlerts: 0 
        };
        this.refreshInterval = null;
        this.backendAvailable = false;
    }

    async init() {
        console.log('🚀 Initializing DataManager...');
        this.backendAvailable = await this.checkBackendHealth();
        
        if (this.backendAvailable) {
            console.log('✅ Backend available');
            await Promise.all([this.loadFarms(), this.loadAlerts()]);
            this.calculateStats();
            this.setupAutoRefresh();
        } else {
            console.log('⚠️ Backend not available, using mock data');
            this.loadMockData();
        }
    }

    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/test`, { 
                mode: 'cors', 
                headers: { 'Accept': 'application/json' } 
            });
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Backend connected:', data);
                return true;
            }
            return false;
        } catch (error) {
            console.log('⚠️ Backend not reachable');
            return false;
        }
    }

    async loadFarms() {
    if (!this.backendAvailable) {
        console.log('📊 Backend not available, using existing data');
        return this.farms;
    }
    
    try {
        console.log('🔍 Fetching farms from:', `${this.apiBaseUrl}/polygons`);
        
        const response = await fetch(`${this.apiBaseUrl}/polygons`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const geojson = await response.json();
        
        // Convert GeoJSON features to farm objects
        this.farms = (geojson.features || []).map(feature => {
            const props = feature.properties || {};
            
            // Determine the correct area value - try multiple possible field names
            let areaValue = 0;
            if (props.real_area && props.real_area > 0) {
                areaValue = props.real_area;
            } else if (props.realArea && props.realArea > 0) {
                areaValue = props.realArea;
            } else if (props.declared_area && props.declared_area > 0) {
                areaValue = props.declared_area;
            } else if (props.declaredArea && props.declaredArea > 0) {
                areaValue = props.declaredArea;
            } else if (props.area && props.area > 0) {
                areaValue = props.area;
            }
            
            return {
                id: props.id,
                farm_id: props.farm_id,
                farmerName: props.farmer_name || props.farmerName || 'Unknown',
                farmerId: props.farmer_id || props.farmerId || '',
                cooperative: props.cooperative_name || props.cooperative || 'Unassigned',
                supplier: props.supplier || 'Unknown',
                declaredArea: props.declared_area || props.declaredArea || 0,
                realArea: props.real_area || props.realArea || areaValue,
                area: areaValue, // Add this for backward compatibility
                areaDifference: props.area_difference || props.areaDifference || 0,
                status: props.status || 'pending',
                submissionDate: props.submission_date || props.submissionDate || new Date().toISOString(),
                enumerator: props.enumerator || 'N/A',
                geometry: feature.geometry
            };
        });
        
        console.log(`✅ Loaded ${this.farms.length} farms from backend`);
        console.log('📊 Sample farm with area:', this.farms[0]); // Debug log
        
        // Trigger farms-updated event for alerts system
        window.dispatchEvent(new CustomEvent('farms-updated'));
        
        // Trigger map update
        if (window.refreshMapLayers && typeof window.refreshMapLayers === 'function') {
            window.refreshMapLayers();
        }
        
        return this.farms;
        
    } catch (error) {
        console.error('❌ Error loading farms:', error);
        return [];
    }
}

    async loadAlerts() {
        if (!this.backendAvailable) return this.alerts;
        try {
            const response = await fetch(`${this.apiBaseUrl}/alerts`);
            const data = await response.json();
            this.alerts = data.alerts || data || [];
            return this.alerts;
        } catch (error) {
            console.error('❌ Error loading alerts:', error);
            return [];
        }
    }

    calculateStats() {
        this.stats = {
            totalFarms: this.farms.length,
            totalArea: this.farms.reduce((sum, f) => {
                const area = parseFloat(f.realArea || f.declaredArea || f.area || 0);
                return sum + (isNaN(area) ? 0 : area);
            }, 0),
            activePlots: this.farms.filter(f => f.status === 'validated').length,
            qualityAlerts: this.alerts.length
        };
        this.updateDashboardKPIs();
        return this.stats;
    }

    updateDashboardKPIs() {
        this.updateText('farmsCount', this.stats.totalFarms);
        this.updateText('totalArea', this.stats.totalArea.toFixed(1));
        this.updateText('activePlots', this.stats.activePlots);
        this.updateText('alertsCount', this.stats.qualityAlerts);
        this.updateText('mapFarmsCount', this.stats.totalFarms);
        this.updateText('mapTotalArea', this.stats.totalArea.toFixed(1) + ' ha');
    }

    updateText(id, text) { 
        const el = document.getElementById(id); 
        if (el) el.textContent = text; 
    }

    setupAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(async () => {
            if (this.backendAvailable) await this.refreshData();
        }, 300000); // 5 minutes
    }

    async refreshData() {
        try {
            await Promise.all([this.loadFarms(), this.loadAlerts()]);
            this.calculateStats();
            if (window.tableData && typeof window.tableData.renderTable === 'function') {
                window.tableData.renderTable();
            }
            console.log('✅ Data refreshed');
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
        }
    }

    async syncWithKobo() {
        if (!this.backendAvailable) { 
            window.notification?.error('Backend not available'); 
            return null; 
        }
        try {
            window.notification?.info('Syncing with KoboCollect...');
            const response = await fetch('http://localhost:3000/sync-kobo');
            const result = await response.json();
            window.notification?.success('Sync completed');
            await this.refreshData();
            return result;
        } catch (error) {
            window.notification?.error('Sync failed: ' + error.message);
            return null;
        }
    }

    loadMockData() {
        this.farms = [
            { 
                id: 'FARM001', 
                farm_id: 'FARM001',
                farmerName: 'John Doe', 
                farmerId: 'P001',
                cooperative: 'Green Valley Coop', 
                supplier: 'SITAPA',
                declaredArea: 12.5, 
                realArea: 12.8,
                area: 12.5,
                status: 'validated', 
                submissionDate: '2024-01-15', 
                enumerator: 'ENUM001', 
                geometry: { 
                    type: 'Polygon', 
                    coordinates: [[[-0.09,51.505],[-0.09,51.51],[-0.08,51.51],[-0.08,51.505],[-0.09,51.505]]] 
                } 
            },
            { 
                id: 'FARM002', 
                farm_id: 'FARM002',
                farmerName: 'Jane Smith', 
                farmerId: 'P002',
                cooperative: 'Sunrise Farmers', 
                supplier: 'SITAPA',
                declaredArea: 8.3, 
                realArea: 8.1,
                area: 8.3,
                status: 'pending', 
                submissionDate: '2024-01-18', 
                enumerator: 'ENUM002', 
                geometry: { 
                    type: 'Polygon', 
                    coordinates: [[[-0.095,51.51],[-0.095,51.515],[-0.085,51.515],[-0.085,51.51],[-0.095,51.51]]] 
                } 
            },
            { 
                id: 'FARM003', 
                farm_id: 'FARM003',
                farmerName: 'Robert Johnson', 
                farmerId: 'P003',
                cooperative: 'Organic Harvest', 
                supplier: 'GCC',
                declaredArea: 15.2, 
                realArea: 15.5,
                area: 15.2,
                status: 'validated', 
                submissionDate: '2024-01-10', 
                enumerator: 'ENUM003', 
                geometry: { 
                    type: 'Polygon', 
                    coordinates: [[[-0.085,51.5],[-0.085,51.505],[-0.075,51.505],[-0.075,51.5],[-0.085,51.5]]] 
                } 
            }
        ];
        this.alerts = [{ 
            id: 'ALERT001', 
            type: 'overlap', 
            severity: 'high', 
            title: 'Farm Boundary Overlap', 
            description: 'FARM001 overlaps with FARM003', 
            farmId: 'FARM001', 
            affectedFarmId: 'FARM003',
            area: 1.5,
            date: new Date().toISOString() 
        }];
        this.calculateStats();
        window.notification?.info('Using mock data (offline mode)');
    }

    destroy() { 
        if (this.refreshInterval) clearInterval(this.refreshInterval); 
    }
}

// ===========================================
// GLOBAL INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', function() {
    window.dataManager = new DataManager();
    window.dataManager.init().catch(console.error);
    
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    }
    
    // Sync button
    const syncButton = document.getElementById('syncKoboBtn');
    if (syncButton) {
        syncButton.addEventListener('click', async () => window.dataManager?.syncWithKobo());
    }
});

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

window.utils = {
    formatDate: (date, format = 'DD/MM/YYYY') => {
        if (!date) return 'N/A';
        const d = new Date(date);
        const pad = n => n.toString().padStart(2, '0');
        return format
            .replace('DD', pad(d.getDate()))
            .replace('MM', pad(d.getMonth() + 1))
            .replace('YYYY', d.getFullYear());
    },
    
    debounce: (func, wait) => { 
        let t; 
        return (...args) => { 
            clearTimeout(t); 
            t = setTimeout(() => func(...args), wait); 
        }; 
    },
    
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    exportToFile: (data, filename, type = 'application/json') => {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
    
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            window.notification?.success('Copied to clipboard');
            return true;
        } catch (err) {
            window.notification?.error('Failed to copy');
            return false;
        }
    },
    
    getUrlParams: () => {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },
    
    safeJSONParse: (str, fallback = null) => {
        try {
            return JSON.parse(str);
        } catch {
            return fallback;
        }
    }
};

// ===========================================
// GLOBAL FUNCTIONS
// ===========================================

window.manualSync = async () => window.dataManager?.syncWithKobo();
window.refreshData = async () => window.dataManager?.refreshData();

console.log('🚀 Global utilities loaded');