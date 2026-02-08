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
      '@js': resolve(__dirname, './src/js'),
      '@services': resolve(__dirname, './src/js/services'),
      '@components': resolve(__dirname, './src/js/components'),
      '@pages': resolve(__dirname, './src/js/pages'),
      '@utils': resolve(__dirname, './src/js/utils'),
      '@css': resolve(__dirname, './src/css'),
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
