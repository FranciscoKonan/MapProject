// ===========================================
// AUTH JS - Authentication Management
// ===========================================

console.log('🔐 Auth JS loading...');

let authSupabase = null;

// ===========================================
// WAIT FOR SUPABASE
// ===========================================
function waitForAuthSupabase() {
    return new Promise((resolve) => {
        if (window.supabase && window.supabase.auth) {
            console.log('✅ Auth JS: Supabase already ready');
            authSupabase = window.supabase;
            resolve(window.supabase);
            return;
        }
        
        window.addEventListener('supabase-ready', () => {
            console.log('✅ Auth JS: Supabase ready event');
            authSupabase = window.supabase;
            resolve(window.supabase);
        });
        
        // Fallback timeout
        setTimeout(() => {
            if (window.supabase && window.supabase.auth) {
                console.log('✅ Auth JS: Supabase ready (timeout)');
                authSupabase = window.supabase;
                resolve(window.supabase);
            } else {
                console.error('❌ Auth JS: Supabase timeout');
                resolve(null);
            }
        }, 10000);
    });
}

// ===========================================
// CHECK AUTHENTICATION
// ===========================================
async function checkAuth() {
    const supabase = await waitForAuthSupabase();
    if (!supabase) return false;
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            console.log('🔐 No active session');
            return false;
        }
        
        console.log('🔐 User logged in:', session.user.email);
        return true;
        
    } catch (err) {
        console.error('Auth check error:', err);
        return false;
    }
}

// ===========================================
// GET CURRENT USER
// ===========================================
async function getCurrentUser() {
    const supabase = await waitForAuthSupabase();
    if (!supabase) return null;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (err) {
        console.error('Error getting user:', err);
        return null;
    }
}

// ===========================================
// LOGOUT
// ===========================================
async function logout() {
    const supabase = await waitForAuthSupabase();
    
    if (supabase) {
        try {
            await supabase.auth.signOut();
            console.log('🔐 Logged out successfully');
        } catch (err) {
            console.error('Logout error:', err);
        }
    }
    
    // Clear local storage
    localStorage.removeItem('mappingtrace_user');
    localStorage.removeItem('supabase.auth.token');
    
    // Redirect to login
    window.location.href = 'login.html';
}

// ===========================================
// LOGIN
// ===========================================
async function login(email, password) {
    const supabase = await waitForAuthSupabase();
    if (!supabase) {
        throw new Error('Supabase not initialized');
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) throw error;
    
    // Store user data
    const user = data.user;
    const userMetadata = user.user_metadata || {};
    
    let fullName = userMetadata.full_name || 
                  userMetadata.name || 
                  `${userMetadata.first_name || ''} ${userMetadata.last_name || ''}`.trim() ||
                  user.email.split('@')[0] || 
                  'User';
    
    // Capitalize
    fullName = fullName.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    
    let role = userMetadata.role || 'user';
    const roleDisplay = {
        'field_officer': 'Field Officer',
        'validator': 'Validator',
        'admin': 'Administrator',
        'viewer': 'Viewer',
        'user': 'User'
    };
    const displayRole = roleDisplay[role] || role;
    
    const initials = fullName
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2) || 'U';
    
    const userData = {
        fullName: fullName,
        role: displayRole,
        avatar: initials,
        email: user.email,
        id: user.id
    };
    
    localStorage.setItem('mappingtrace_user', JSON.stringify(userData));
    
    return { user, userData };
}

// ===========================================
// REGISTER
// ===========================================
async function register(email, password, userData) {
    const supabase = await waitForAuthSupabase();
    if (!supabase) {
        throw new Error('Supabase not initialized');
    }
    
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: userData
        }
    });
    
    if (error) throw error;
    
    return data;
}

// ===========================================
// CHECK IF LOGGED IN AND REDIRECT
// ===========================================
async function requireAuth() {
    const isLoggedIn = await checkAuth();
    
    if (!isLoggedIn) {
        console.log('🔐 Not logged in, redirecting to login');
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// ===========================================
// INITIALIZE AUTH
// ===========================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 Auth JS: DOM ready');
    
    // Wait for Supabase
    const supabase = await waitForAuthSupabase();
    if (!supabase) {
        console.error('❌ Auth JS: Supabase not available');
        return;
    }
    
    console.log('✅ Auth JS: Supabase ready');
    
    // Check if user is logged in and update UI
    const session = await checkAuth();
    
    if (!session && window.location.pathname.includes('Dashboard')) {
        console.log('🔐 No session on dashboard, but staying');
    }
    
    // Setup logout button if exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
});

// ===========================================
// EXPOSE GLOBAL FUNCTIONS
// ===========================================
window.auth = {
    checkAuth: checkAuth,
    getCurrentUser: getCurrentUser,
    login: login,
    register: register,
    logout: logout,
    requireAuth: requireAuth
};

// Also expose individual functions for backward compatibility
window.checkAuth = checkAuth;
window.logout = logout;
window.login = login;
window.register = register;
window.requireAuth = requireAuth;
window.getCurrentUser = getCurrentUser;

console.log('✅ Auth JS ready');
