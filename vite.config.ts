import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const reactCompiler = reactCompilerPreset()
reactCompiler.rolldown.filter ??= {}
reactCompiler.rolldown.filter.id = {
    exclude: ['src/utils/**', 'src/types.ts'],
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        babel({ presets: [reactCompiler], sourceMap: false })
    ],
    server: {
        port: 5173,
        proxy: {
            // Forward API calls to the FastAPI backend during dev.
            // SVG images and icon mapping are served locally from public/svg/.
            '/hw':          { target: 'http://localhost:8000', changeOrigin: true },
            '/config':      { target: 'http://localhost:8000', changeOrigin: true },
            '/test-run':    { target: 'http://localhost:8000', changeOrigin: true },
            '/io':          { target: 'http://localhost:8000', changeOrigin: true },
            '/pocketbase':  { target: 'http://localhost:8000', changeOrigin: true },
            '/metadata':    { target: 'http://localhost:8000', changeOrigin: true },
            '/dashboard':   { target: 'http://localhost:8000', changeOrigin: true },
        },
    },
    build: {
        // Write compiled assets into festo-cpx-io-api/dist so FastAPI can serve them
        outDir: '../festo-cpx-io-api/dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks(id: string) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'react-vendor'
                        if (id.includes('@mui/material') || id.includes('@mui/icons-material') || id.includes('@emotion')) return 'mui-vendor'
                        if (id.includes('@mui/x-data-grid')) return 'datagrid-vendor'
                        if (id.includes('recharts')) return 'recharts-vendor'
                        if (id.includes('@xyflow')) return 'xyflow-vendor'
                    }
                }
            }
        }
    },
})
