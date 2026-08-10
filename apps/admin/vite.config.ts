import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');
  const base = env.VITE_BASE_PATH || '/pos/';
  const apiProxy = {
    [`${base}api`]: {
      target: `http://127.0.0.1:${env.PORT || '3002'}`,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(new RegExp(`^${base.replace(/\/$/, '')}/api`), '/api'),
    },
  };
  return {
    base,
    envDir: '../../',
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
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
          start_url: base,
          scope: base,
          lang: 'es-AR',
          orientation: 'any',
          icons: [
            { src: `${base}icons/pwa-icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: `${base}icons/maskable-icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: `${base}index.html`,
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
  };
});
