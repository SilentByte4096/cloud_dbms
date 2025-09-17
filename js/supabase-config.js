// js/supabase-config.js
// Wait for Supabase to load from CDN
const initializeSupabase = () => {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      const { createClient } = supabase;
      
      window.supabase = createClient(
        "https://mpelyxgntqnpueykkhka.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wZWx5eGdudHFucHVleWtraGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzU1MDYsImV4cCI6MjA3MjMxMTUwNn0.Zk9T0WuVZ-mVqarQcRd21v5c0OwxH1aPB4gKURvn5W4"
      );
      
      console.log('✅ Supabase client initialized successfully');
      
      // Dispatch custom event to notify other scripts
      window.dispatchEvent(new CustomEvent('supabaseReady'));
      
    } catch (error) {
      console.error('❌ Failed to initialize Supabase client:', error);
    }
  } else {
    console.error('❌ Supabase library not loaded from CDN');
    console.log('Available globals:', Object.keys(window).filter(key => key.toLowerCase().includes('supa')));
  }
};

// Try multiple initialization approaches
const tryInitialize = () => {
  // Method 1: Check if already loaded
  if (typeof supabase !== 'undefined') {
    initializeSupabase();
    return;
  }
  
  // Method 2: Wait for window load
  if (document.readyState === 'loading') {
    window.addEventListener('load', initializeSupabase);
  } else {
    // Method 3: Delayed retry for CDN
    setTimeout(() => {
      if (typeof supabase !== 'undefined') {
        initializeSupabase();
      } else {
        console.warn('⚠️ Supabase CDN still not loaded, retrying...');
        setTimeout(initializeSupabase, 500);
      }
    }, 100);
  }
};

// Start initialization
tryInitialize();
