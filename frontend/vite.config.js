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

      // Legacy support (keep during migration)
      '@js': resolve(__dirname, './src/js'),
      '@css': resolve(__dirname, './src/css'),
      '@pages': resolve(__dirname, './src/js/pages'),
      '@assets': resolve(__dirname, './src/assets'),
    },
  },

  // Multi-page app configuration
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'public/index.html'),
        signup: resolve(__dirname, 'public/signup.html'),
        signin: resolve(__dirname, 'public/signin.html'),
        dashboard: resolve(__dirname, 'public/dashboard.html'),
        projects: resolve(__dirname, 'public/projects.html'),
        tasks: resolve(__dirname, 'public/tasks.html'),
        admin: resolve(__dirname, 'public/admin.html'),
      },
    },
    outDir: '../dist',
    emptyOutDir: true,
  },

  // Dev server configuration
  server: {
    port: 5173,
    strictPort: true,
    open: '/public/index.html',
  },
});
