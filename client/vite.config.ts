import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tanstackRouter from "@tanstack/router-plugin/vite";
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        tailwindcss(),
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
        }),
        react(),
        tsconfigPaths()
    ],
    server: {
        proxy: {
            '/api': {
                target: 'https://dev-kopimap.mwyndham.dev',
                changeOrigin: true,
                secure: true, // use `true` if your backend has a valid SSL cert
                cookieDomainRewrite: 'localhost', // rewrite cookie domain to local
            },
        },
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom'],
                    maplibre: ['maplibre-react-components']
                }
            }
        }
    },
})
