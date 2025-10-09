// Authentication functions

// Show authentication modal
function showAuth(type) {
    const modal = document.getElementById('authModal')
    const loginForm = document.getElementById('loginForm')
    const signupForm = document.getElementById('signupForm')
    
    if (type === 'login') {
        loginForm.style.display = 'block'
        signupForm.style.display = 'none'
    } else {
        loginForm.style.display = 'none'
        signupForm.style.display = 'block'
    }
    
    modal.style.display = 'block'
}

// Close authentication modal
function closeAuth() {
    document.getElementById('authModal').style.display = 'none'
}

// Handle login
async function handleLogin(event) {
    event.preventDefault()
    
    const email = document.getElementById('loginEmail').value
    const password = document.getElementById('loginPassword').value
    
    try {
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email,
            password
        })
        
        if (error) throw error
        
        // Ensure profile exists; create if missing
        let { data: profile, error: profileErr } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle()
        
        const userRole = data.user.user_metadata?.role
        const fullName = data.user.user_metadata?.full_name || data.user.email
        
        // If no role is found in metadata, something went wrong during signup
        if (!userRole) {
            throw new Error('User role not found. Please contact support.')
        }
        
        if (!profile) {
            // Create new profile
            const { error: upErr } = await window.supabase.from('profiles').insert([{
                id: data.user.id,
                full_name: fullName,
                email: data.user.email,
                user_type: userRole,
                created_at: new Date().toISOString()
            }])
            if (upErr) throw upErr
            profile = { user_type: userRole }
        } else if (profile.user_type !== userRole) {
            // Profile exists but user_type is wrong, update it
            const { error: updateErr } = await window.supabase
                .from('profiles')
                .update({ user_type: userRole })
                .eq('id', data.user.id)
            if (updateErr) throw updateErr
            profile.user_type = userRole
        }
        
        // Redirect based on role
        if (profile?.user_type === 'teacher') {
            window.location.href = 'dashboard-teacher.html'
        } else {
            window.location.href = 'dashboard-student.html'
        }
        
    } catch (error) {
        console.error('Login error:', error)
        window.utils.showNotification(error.message, 'error')
    }
}

// Handle signup
async function handleSignup(event) {
    event.preventDefault()
    
    const name = document.getElementById('signupName').value
    const email = document.getElementById('signupEmail').value
    const password = document.getElementById('signupPassword').value
    const role = document.getElementById('userRole').value
    
    try {
        const { data, error } = await window.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    role: role
                }
            }
        })
        
        if (error) throw error
        
        // Do NOT insert profile here (email confirmation may be required)
        // Profile will be created on first login (see handleLogin)
        window.utils.showNotification('Account created! Please check your email to verify, then log in.', 'success')
        closeAuth()
        
    } catch (error) {
        console.error('Signup error:', error)
        window.utils.showNotification(error.message, 'error')
    }
}

// Check if user is authenticated
async function checkAuth() {
    // Wait for Supabase to be initialized
    if (!window.supabase) {
        console.error('Supabase not initialized');
        return null;
    }
    
    try {
        const { data: { user } } = await window.supabase.auth.getUser()
        
        if (!user) {
            // Redirect to landing page if not authenticated
            if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
                window.location.href = 'index.html'
            }
            return null
        }
        
        // Get user profile
        const { data: profile } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
        
        window.appState.currentUser = user
        window.appState.userRole = profile?.user_type
        
        return { user, profile }
    } catch (error) {
        console.error('Error in checkAuth:', error);
        return null;
    }
}

// Logout function
async function logout() {
    try {
        const { error } = await window.supabase.auth.signOut()
        if (error) throw error
        
        window.location.href = 'index.html'
    } catch (error) {
        console.error('Logout error:', error)
        window.utils.showNotification('Error logging out', 'error')
    }
}

// Initialize auth state on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('authModal')
        if (event.target === modal) {
            closeAuth()
        }
    }
    
    // Check authentication status
    if (window.location.pathname.includes('dashboard')) {
        await checkAuth()
    }
})