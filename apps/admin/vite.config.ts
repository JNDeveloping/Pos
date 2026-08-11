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
          description: 'Administración web de El Rincón de los Nietos',
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
          // El Service Worker conserva solamente el shell. Las respuestas /api nunca
          // ingresan a Cache Storage y PostgreSQL continúa como única fuente de verdad.
        },
        devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
      }),
    ],
  };
});
