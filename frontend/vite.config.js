import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root directory for source files
  root: '.',

  // Public directory for static assets
  publicDir: 'public',

  // Read .env from project root (parent directory)
  envDir: resolve(__dirname, '..'),

  // Environment variables prefix
  envPrefix: 'VITE_',

  // Path aliases for cleaner imports
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),

      // Feature aliases
      '@features': resolve(__dirname, './src/features'),
      '@tasks': resolve(__dirname, './src/features/tasks'),
      '@admin': resolve(__dirname, './src/features/admin'),
      '@dashboard': resolve(__dirname, './src/features/dashboard'),
      '@projects': resolve(__dirname, './src/features/projects'),
      '@reports': resolve(__dirname, './src/features/reports'),
      '@landing': resolve(__dirname, './src/features/landing'),
      '@auth': resolve(__dirname, './src/features/auth'),
      '@profile': resolve(__dirname, './src/features/profile'),

      // Shared aliases
      '@shared': resolve(__dirname, './src/shared'),
      '@components': resolve(__dirname, './src/shared/components'),
      '@services': resolve(__dirname, './src/shared/services'),
      '@utils': resolve(__dirname, './src/shared/utils'),

      // Style aliases (for JS imports)
      '@styles': resolve(__dirname, './src/styles'),

      // Assets
      '@assets': resolve(__dirname, './src/assets'),
    },
  },

  // Multi-page app configuration
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        signup: resolve(__dirname, 'signup.html'),
        signin: resolve(__dirname, 'signin.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        projects: resolve(__dirname, 'projects.html'),
        tasks: resolve(__dirname, 'tasks.html'),
        admin: resolve(__dirname, 'admin.html'),
        reports: resolve(__dirname, 'reports.html'),
        profile: resolve(__dirname, 'profile.html'),
      },
    },
    outDir: '../dist',
    emptyOutDir: true,
  },

  // Dev server configuration
  server: {
    port: 5173,
    strictPort: true,
    open: '/index.html',
    headers: securityHeaders(),
  },

  // Preview server (production build)
  preview: {
    headers: securityHeaders(),
  },
});

function securityHeaders() {
  const supabaseOrigin = 'https://zuupemhuaovzqqhyyocz.supabase.co';
  const csp = [
    "default-src 'self'",
    `script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com`,
    `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
    `connect-src 'self' ${supabaseOrigin} wss://zuupemhuaovzqqhyyocz.supabase.co`,
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}
