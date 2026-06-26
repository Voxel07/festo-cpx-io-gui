import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
        port: 5173,
        proxy: {
            // Forward API calls to the FastAPI backend during dev.
            // SVG images and icon mapping are served locally from public/svg/.
            '/topology':    { target: 'http://localhost:8000', changeOrigin: true },
            '/compare':     { target: 'http://localhost:8000', changeOrigin: true },
            '/connections': { target: 'http://localhost:8000', changeOrigin: true },
            '/test-run':    { target: 'http://localhost:8000', changeOrigin: true },
            '/validate-connections': { target: 'http://localhost:8000', changeOrigin: true },
            '/io':          { target: 'http://localhost:8000', changeOrigin: true },
            '/pocketbase':  { target: 'http://localhost:8000', changeOrigin: true },
        },
    },
    build: {
        // Write compiled assets into festo-cpx-io/dist so FastAPI can serve them
        outDir: '../../festo-cpx-io/dist',
        emptyOutDir: true,
    },
})
