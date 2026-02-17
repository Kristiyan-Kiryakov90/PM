/**
 * Landing Page - Main Entry Point
 * Initializes landing page, checks authentication, sets up interactive demos
 */

import supabase from '@services/supabase.js';
import { authUtils } from '@utils/auth.js';
import { checkBootstrap, setupBootstrapForm } from './landing-forms.js';
import { initLandingBoard, initAppDemoCarousel } from './landing-animations.js';

// Initialize page
async function init() {
  try {
    console.log('=== INDEX PAGE INIT ===');

    // Wait for session to be restored from storage
    console.log('Waiting for auth session to be restored...');
    let currentUser = null;
    await new Promise((resolve) => {
      let isResolved = false;
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, 'User:', session?.user?.email);
        if (!isResolved && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
          currentUser = session?.user || null;
          isResolved = true;
          data.subscription.unsubscribe();
          resolve();
        }
      });
      // Timeout fallback in case auth doesn't emit
      setTimeout(() => {
        if (!isResolved) {
          console.log('Auth state change timeout, resolving anyway');
          isResolved = true;
          data.subscription.unsubscribe();
          resolve();
        }
      }, 1000);
    });

    console.log('Session restored. Current user:', currentUser?.email);
    console.log('Index page: showing landing page (no auto-redirect)');

    // Check if bootstrap modal needed
    await checkBootstrap();

    // Init landing board interactions (design-only demo interactions)
    initLandingBoard();
    initAppDemoCarousel();

    // Attach form handler
    setupBootstrapForm();
  } catch (error) {
    console.error('Init error:', error);
  }
}

init();
