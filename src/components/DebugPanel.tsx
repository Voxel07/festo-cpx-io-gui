import { useState, useEffect, useRef } from 'react'
import type { ProfilerOnRenderCallback } from 'react'
import { Box, Typography, Paper, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { Panel, useStore } from '@xyflow/react'

export function DebugPanel({ onClose }: { onClose: () => void }) {
    const [fps, setFps] = useState(0)
    const [dt, setDt] = useState(0)
    const [dropped, setDropped] = useState(0)

    // React Profiler metrics
    const [renderTime, setRenderTime] = useState(0)

    // Exact edge count from React Flow store
    const totalEdges = useStore(s => s.edges.length)
    const totalNodes = useStore(s => s.nodes.length)

    const frameRef = useRef(0)
    const lastTimeRef = useRef(performance.now())
    const frameCountRef = useRef(0)
    const lastFpsTimeRef = useRef(performance.now())
    const droppedRef = useRef(0)

    useEffect(() => {
        const loop = (time: number) => {
            const currentDt = time - lastTimeRef.current
            lastTimeRef.current = time
            setDt(currentDt)

            if (currentDt > 1000 / 60 * 1.5) {
                droppedRef.current += 1
                setDropped(droppedRef.current)
            }

            frameCountRef.current++
            const elapsed = time - lastFpsTimeRef.current
            if (elapsed >= 1000) {
                setFps(Math.round((frameCountRef.current * 1000) / elapsed))
                frameCountRef.current = 0
                lastFpsTimeRef.current = time
            }

            frameRef.current = requestAnimationFrame(loop)
        }

        frameRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(frameRef.current)
    }, [])

    useEffect(() => {
        const handleProfile = (e: CustomEvent) => {
            setRenderTime(e.detail.actualDuration)
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
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }} color={fps < 30 ? 'error.main' : 'success.main'}>{fps}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Frame Time</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{dt.toFixed(1)} ms</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Dropped</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }} color={dropped > 0 ? 'warning.main' : 'text.primary'}>{dropped}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">React Render</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{renderTime.toFixed(2)} ms</Typography>
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

// Render profiler to fire events that the panel can listen to
export const onRenderCallback: ProfilerOnRenderCallback = (
    id, phase, actualDuration
) => {
    window.dispatchEvent(new CustomEvent('topology-render-profile', {
        detail: { id, phase, actualDuration }
    }))
}
