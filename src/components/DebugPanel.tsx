import { useEffect, useRef } from 'react'
import { Box, Typography, Paper, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { Panel, useStore } from '@xyflow/react'

export function DebugPanel({ onClose }: { onClose: () => void }) {
    // Exact edge count from React Flow store
    const totalEdges = useStore(s => s.edges.length)
    const totalNodes = useStore(s => s.nodes.length)

    const frameRef = useRef(0)
    const lastTimeRef = useRef(0)
    const frameCountRef = useRef(0)
    const lastFpsTimeRef = useRef(0)
    const droppedRef = useRef(0)
    const currentDtRef = useRef(0)

    useEffect(() => {
        const startedAt = performance.now()
        lastTimeRef.current = startedAt
        lastFpsTimeRef.current = startedAt
        const loop = (time: number) => {
            const currentDt = time - lastTimeRef.current
            lastTimeRef.current = time
            currentDtRef.current = currentDt

            let didDrop = false
            if (currentDt > 1000 / 60 * 1.5) {
                droppedRef.current += 1
                didDrop = true
            }

            frameCountRef.current++
            const elapsed = time - lastFpsTimeRef.current
            if (elapsed >= 1000) {
                const newFps = Math.round((frameCountRef.current * 1000) / elapsed)
                const fpsEl = document.getElementById('debug-fps')
                if (fpsEl) {
                    fpsEl.textContent = String(newFps)
                    fpsEl.style.color = newFps < 30 ? '#d32f2f' : '#2e7d32' // error.main : success.main
                }
                frameCountRef.current = 0
                lastFpsTimeRef.current = time
            }

            const dtEl = document.getElementById('debug-dt')
            if (dtEl) dtEl.textContent = `${currentDt.toFixed(1)} ms`

            if (didDrop) {
                const dropEl = document.getElementById('debug-dropped')
                if (dropEl) {
                    dropEl.textContent = String(droppedRef.current)
                    dropEl.style.color = droppedRef.current > 0 ? '#ed6c02' : 'inherit' // warning.main
                }
            }

            frameRef.current = requestAnimationFrame(loop)
        }

        frameRef.current = requestAnimationFrame(loop)

        return () => {
            cancelAnimationFrame(frameRef.current)
        }
    }, [])

    useEffect(() => {
        const handleProfile = (e: CustomEvent) => {
            const rtEl = document.getElementById('debug-rt')
            if (rtEl) rtEl.textContent = `${e.detail.actualDuration.toFixed(2)} ms`
        }
        window.addEventListener('topology-render-profile', handleProfile as EventListener)
        return () => window.removeEventListener('topology-render-profile', handleProfile as EventListener)
    }, [])

    return (
        <Panel position="bottom-right" style={{ pointerEvents: 'auto', zIndex: 1000 }}>
            <Paper sx={{ p: 2, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 1, backdropFilter: 'blur(4px)' }} elevation={4}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Debug Info</Typography>
                    <IconButton size="small" onClick={onClose} sx={{ p: 0 }}><CloseIcon fontSize="small" /></IconButton>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">FPS</Typography>
                    <Typography id="debug-fps" variant="body2" sx={{ fontWeight: 'bold' }}>0</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Frame Time</Typography>
                    <Typography id="debug-dt" variant="body2" sx={{ fontWeight: 'bold' }}>0.0 ms</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Dropped</Typography>
                    <Typography id="debug-dropped" variant="body2" sx={{ fontWeight: 'bold' }}>0</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">React Render</Typography>
                    <Typography id="debug-rt" variant="body2" sx={{ fontWeight: 'bold' }}>0.00 ms</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <Typography variant="body2" color="text.secondary">RF Nodes</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{totalNodes}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">RF Edges</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{totalEdges}</Typography>
                </Box>
            </Paper>
        </Panel>
    )
}
