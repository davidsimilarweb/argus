import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

declare const process: {
  cwd: () => string
  env: Record<string, string | undefined>
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_ARGUS_PROXY_TARGET || 'https://ios-sdk-server-staging.42matters.com'
  const healthTarget = env.VITE_ARGUS_HEALTHCHECK_TARGET || 'https://ios-sdk-server.42matters.com'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'Argus - iOS Device Fleet Management',
          short_name: 'Argus',
          description: 'Track and manage iOS devices, accounts, and deployments',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    server: {
      host: '0.0.0.0', // Listen on all network interfaces
      port: 5173,
      proxy: {
        // Proxy Argus API requests to the external server (avoids CORS)
        '/argus': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/internal': {
          target: healthTarget,
          changeOrigin: true,
          secure: true,
        }
      }
    }
  }
})
