import { useState, useRef, useCallback } from 'react'
import { Box, AppBar, Toolbar, Typography, TextField, Tabs, Tab, Stack, Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import GenerateTab from './components/GenerateTab'
import CompareTab from './components/CompareTab'
import TestRunTab from './components/TestRunTab'
import HistoryTab from './components/HistoryTab'
import TopologyFlow from './components/TopologyFlow'
import ConnectionsFlow from './components/ConnectionsFlow'
import type { Topology, DiffStatus } from './types'

const DIFF_COLORS: Record<string, string> = {
    unchanged: '#1976d2',
    changed: '#ed6c02',
    added: '#2e7d32',
    removed: '#d32f2f',
}

const MIN_CANVAS_H = 140
const MAX_CANVAS_H = 800
const DEFAULT_CANVAS_H = 320

const MIN_CANVAS_W = 300
const MAX_CANVAS_W = 3000

export default function App() {
    const [tab, setTab] = useState(0)
    const [ip, setIp] = useState('192.168.1.11')
    const [timeout, setTimeout_] = useState(0)
    const [topology, setTopology] = useState<Topology | null>(null)
    const [diffStatus, setDiff] = useState<DiffStatus | null>(null)
    const [canvasH, setCanvasH] = useState(DEFAULT_CANVAS_H)
    const [canvasW, setCanvasW] = useState<number | null>(null)
    const [fullscreen, setFullscreen] = useState(false)

    // Drag-to-resize height handle
    const dragRef = useRef({ active: false, startY: 0, startH: 0 })
    const onDragStart = useCallback((e: React.MouseEvent) => {
        dragRef.current = { active: true, startY: e.clientY, startH: canvasH }
        e.preventDefault()
        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current.active) return
            const delta = ev.clientY - dragRef.current.startY
            setCanvasH(Math.min(MAX_CANVAS_H, Math.max(MIN_CANVAS_H, dragRef.current.startH + delta)))
        }
        const onUp = () => {
            dragRef.current.active = false
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [canvasH])

    // Drag-to-resize width handle
    const wDragRef = useRef({ active: false, startX: 0, startW: 0 })
    const onWidthDragStart = useCallback((e: React.MouseEvent) => {
        const startW = canvasW ?? (e.currentTarget.parentElement?.getBoundingClientRect().width ?? 800)
        wDragRef.current = { active: true, startX: e.clientX, startW }
        e.preventDefault()
        const onMove = (ev: MouseEvent) => {
            if (!wDragRef.current.active) return
            const delta = ev.clientX - wDragRef.current.startX
            setCanvasW(Math.min(MAX_CANVAS_W, Math.max(MIN_CANVAS_W, wDragRef.current.startW + delta)))
        }
        const onUp = () => {
            wDragRef.current.active = false
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [canvasW])

    function onResult(topo: Topology | null, status: DiffStatus | null) {
        setTopology(topo)
        setDiff(status)
    }

    /** Patch MountedValves on a module entry when user configures valves in ConnectionsFlow */
    function onModuleValveChange(addr: number, mountedValves: number[]) {
        setTopology(prev => {
            if (!prev) return prev
            return {
                ...prev,
                Topology: prev.Topology.map(m =>
                    m.Adress === addr ? { ...m, MountedValves: mountedValves } : m
                ),
            }
        })
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <AppBar position="static" sx={{ background: '#003366', flexShrink: 0, pt: 1, pb: 1 }}>
                <Toolbar variant="dense" sx={{ gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mr: 2, whiteSpace: 'nowrap' }}>
                        CPX-AP Topology Manager
                    </Typography>
                    <TextField
                        label="IP Address" value={ip}
                        onChange={e => setIp(e.target.value)}
                        size="small" variant="outlined" sx={appBarFieldSx}
                    />
                    <TextField
                        label="Timeout (s)" value={timeout}
                        onChange={e => setTimeout_(parseFloat(e.target.value) || 0)}
                        size="small" type="number" variant="outlined"
                        sx={{ ...appBarFieldSx, width: 120 }}
                    />
                    {diffStatus && (
                        <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                            {Object.entries(DIFF_COLORS).map(([lbl, col]) => (
                                <Chip key={lbl} label={lbl} size="small"
                                    sx={{ background: col, color: '#fff', fontSize: '0.65rem', height: 20, textTransform: 'capitalize' }}
                                />
                            ))}
                        </Stack>
                    )}
                </Toolbar>
            </AppBar>

            {/* ── Topology canvas ── */}
            <Box sx={fullscreen
                ? { position: 'fixed', inset: 0, zIndex: 1300, background: '#fafafa' }
                : {
                    display: 'flex', flexDirection: 'row',
                    height: canvasH, flexShrink: 0,
                    borderBottom: '1px solid #ddd', background: '#fafafa',
                }
            }>
                {/* Canvas area (width-constrained when user has dragged) */}
                <Box sx={{
                    flex: canvasW ? 'none' : 1,
                    width: canvasW ?? undefined,
                    height: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                }}>
                    <TopologyFlow
                        topology={topology}
                        diffStatus={diffStatus}
                        fullscreen={fullscreen}
                        onToggleFullscreen={() => setFullscreen(f => !f)}
                    />
                </Box>

                {/* Right-edge width resize handle */}
                {!fullscreen && (
                    <Box onMouseDown={onWidthDragStart} sx={{
                        width: 6, flexShrink: 0, cursor: 'col-resize',
                        background: 'linear-gradient(to right, #e0e0e0 0%, #bdbdbd 50%, #e0e0e0 100%)',
                        '&:hover': { background: '#1976d2' },
                        transition: 'background 0.15s',
                        userSelect: 'none',
                    }} />
                )}
            </Box>

            {/* ── Drag-resize handle ── */}
            {!fullscreen && (
                <Box onMouseDown={onDragStart} sx={{
                    height: 6, flexShrink: 0, cursor: 'row-resize',
                    background: 'linear-gradient(to bottom, #e0e0e0 0%, #bdbdbd 50%, #e0e0e0 100%)',
                    '&:hover': { background: '#1976d2' },
                    transition: 'background 0.15s',
                    userSelect: 'none',
                }} />
            )}

            {/* ── Tab bar ── */}
            {!fullscreen && (
                <Box sx={{ background: '#fff', borderBottom: '1px solid #ddd', flexShrink: 0 }}>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 38 }}
                         variant="scrollable" scrollButtons="auto">
                        <Tab label="Generate" sx={{ minHeight: 38 }} />
                        <Tab label="Compare" sx={{ minHeight: 38 }} />
                        <Tab label="Connections" sx={{ minHeight: 38 }} />
                        <Tab label="Test Run" sx={{ minHeight: 38 }} />
                        <Tab label="History" sx={{ minHeight: 38 }} />
                    </Tabs>
                </Box>
            )}

            {/* ── Tab content ── */}
            {!fullscreen && (
                <Box sx={{ flex: 1, overflow: 'auto', background: '#fafafa' }}>
                    {tab === 0 && <GenerateTab ip={ip} timeout={timeout} onResult={onResult} />}
                    {tab === 1 && <CompareTab ip={ip} timeout={timeout} onResult={onResult} />}
                    {tab === 2 && (
                        <Box sx={{ height: '100%', overflow: 'hidden' }}>
                            <ConnectionsFlow
                                topology={topology}
                                diffStatus={diffStatus}
                                onModuleValveChange={onModuleValveChange}
                            />
                        </Box>
                    )}
                    {tab === 3 && <TestRunTab ip={ip} />}
                    {tab === 4 && <HistoryTab />}
                </Box>
            )}
        </Box>
    )
}

const appBarFieldSx: SxProps<Theme> = {
    width: 170,
    '& .MuiInputBase-root': { background: 'rgba(255,255,255,0.12)' },
    '& .MuiInputLabel-root, & input': { color: '#fff' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
}
