import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  envDir: '../../',
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0') },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/pwa-icon.svg', 'icons/maskable-icon.svg'],
      manifest: {
        name: 'El Rincón de los Nietos',
        short_name: 'El Rincón POS',
        description: 'Administración y punto de venta offline-first',
        theme_color: '#125633',
        background_color: '#effbf3',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'es-AR',
        orientation: 'any',
        icons: [
          { src: '/icons/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        runtimeCaching: [],
        // API responses deliberately never enter Cache Storage. Domain data lives
        // in IndexedDB and is updated only by SyncService.
      },
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
});
