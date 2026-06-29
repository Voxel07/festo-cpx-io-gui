import { useState, useRef, useCallback, useEffect } from 'react'
import { Box, AppBar, Toolbar, Typography, TextField, Tabs, Tab, Stack } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CloudIcon from '@mui/icons-material/Cloud'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import StorageIcon from '@mui/icons-material/Storage'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { TooltipButton } from './components/TooltipButton'
import GenerateCompareTab from './components/GenerateCompareTab'
import TestRunTab from './components/TestRunTab'
import HistoryTab from './components/HistoryTab'
import TopologyFlow from './components/TopologyFlow'
import ConnectionsFlow from './components/ConnectionsFlow'
import RawModeTab from './components/RawModeTab'
import DiagnosticsModal from './components/DiagnosticsModal'
import type { Topology, DiffStatus, TopologyModule, BenchConfig } from './types'
import { configToTopology } from './utils/configMapper'

const MIN_CANVAS_H = 140
const MAX_CANVAS_H = 800
const DEFAULT_CANVAS_H = 320

const MIN_CANVAS_W = 300
const MAX_CANVAS_W = 3000

export default function App() {
    const [tab, setTab] = useState(0)
    const [ip, setIp] = useState('192.168.0.11')
    const [timeout, setTimeout_] = useState(0)
    const [topology, setTopology] = useState<Topology | null>(null)
    const [diffStatus, setDiff] = useState<DiffStatus | null>(null)
    const [removedModules, setRemovedModules] = useState<TopologyModule[]>([])
    const [canvasH, setCanvasH] = useState(DEFAULT_CANVAS_H)
    const [canvasW, setCanvasW] = useState<number | null>(null)
    const [fullscreen, setFullscreen] = useState(false)
    const [pbStatus, setPbStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')
    const [pbChecking, setPbChecking] = useState(false)
    const [showTopology, setShowTopology] = useState(true)
    const [activeModuleAddr, setActiveModuleAddr] = useState<number | null>(null)
    const [rawSelectedAddr, setRawSelectedAddr] = useState<number | null>(null)
    const [diagOpen, setDiagOpen] = useState(false)

    // Clear selection outline when leaving Raw Mode tab
    useEffect(() => {
        if (tab !== 3) {
            setRawSelectedAddr(null)
        }
    }, [tab])

    async function checkPocketBase() {
        setPbChecking(true)
        try {
            const r = await fetch('/pocketbase/health')
            const d = await r.json()
            setPbStatus(d.status === 'ok' ? 'ok' : 'error')
        } catch {
            setPbStatus('error')
        } finally {
            setPbChecking(false)
        }
    }

    // Poll test-run status for topology highlighting (slow when idle)
    useEffect(() => {
        let active = false
        const poll = async () => {
            try {
                const r = await fetch('/test-run/status')
                if (!r.ok) return
                const d = await r.json()
                if (d.status === 'running') {
                    active = true
                    setActiveModuleAddr(d.progress?.current_module != null ? Number(d.progress.current_module) : null)
                } else {
                    if (active) setActiveModuleAddr(null)
                    active = false
                }
            } catch { /* ignore */ }
        }
        const timer = setInterval(poll, 2000)
        return () => clearInterval(timer)
    }, [])

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

    const [rawConfig, setRawConfig] = useState<BenchConfig | null>(null)

    function onResult(topo: Topology | null, status: DiffStatus | null, removed: TopologyModule[] = [], config?: BenchConfig) {
        setTopology(topo)
        setDiff(status)
        setRemovedModules(removed)
        if (config) setRawConfig(config)
    }

    /** Sync topology + rawConfig when a BenchConfig is loaded in ConnectionsFlow */
    function onConfigLoad(config: BenchConfig) {
        setRawConfig(config)
        setTopology(configToTopology(config))
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
        setRawConfig(prev => {
            if (!prev) return prev
            return {
                ...prev,
                module_instances: (prev.module_instances || []).map(inst =>
                    inst.address === addr ? { ...inst, mounted_valves: mountedValves } : inst
                )
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
                    <Stack direction="row" spacing={1} sx={{ ml: 'auto', alignItems: 'center' }}>
                        <TooltipButton
                            size="small"
                            variant="outlined"
                            onClick={() => setShowTopology(s => !s)}
                            tooltip={showTopology ? 'Hide topology map' : 'Show topology map'}
                            icon={showTopology ? <VisibilityOffIcon sx={{ fontSize: '1rem' }} /> : <VisibilityIcon sx={{ fontSize: '1rem' }} />}
                            sx={{ fontSize: '0.65rem', height: 26, px: 1, whiteSpace: 'nowrap', color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '& .MuiButton-startIcon': { mr: 0.5 } }}
                        >
                            Map
                        </TooltipButton>
                        <TooltipButton
                            size="small"
                            variant="outlined"
                            onClick={checkPocketBase}
                            disabled={pbChecking}
                            tooltip={pbStatus === 'ok' ? 'PocketBase: connected' : pbStatus === 'error' ? 'PocketBase: unreachable' : 'Check PocketBase connection'}
                            icon={pbStatus === 'ok' ? <CloudIcon sx={{ fontSize: '1rem' }} /> : pbStatus === 'error' ? <CloudOffIcon sx={{ fontSize: '1rem' }} /> : <StorageIcon sx={{ fontSize: '1rem' }} />}
                            sx={{
                                fontSize: '0.65rem', height: 26, px: 1, whiteSpace: 'nowrap',
                                borderColor: pbStatus === 'ok' ? '#4caf50' : pbStatus === 'error' ? '#f44336' : 'rgba(255,255,255,0.5)',
                                color: pbStatus === 'ok' ? '#4caf50' : pbStatus === 'error' ? '#f44336' : '#fff',
                                '&:hover': { borderColor: '#fff', color: '#fff' },
                                '& .MuiButton-startIcon': { mr: 0.5 }
                            }}
                        >
                            {pbChecking ? 'Checking...' : 'PocketBase'}
                        </TooltipButton>
                        <TooltipButton
                            size="small"
                            variant="outlined"
                            onClick={() => setDiagOpen(true)}
                            tooltip="Show live system diagnostics raised"
                            icon={<ReportProblemIcon sx={{ fontSize: '1rem' }} />}
                            sx={{
                                fontSize: '0.65rem', height: 26, px: 1, whiteSpace: 'nowrap',
                                borderColor: 'rgba(255,255,255,0.5)',
                                color: '#fff',
                                '&:hover': { borderColor: '#fff', color: '#fff' },
                                '& .MuiButton-startIcon': { mr: 0.5 }
                            }}
                        >
                            Diags
                        </TooltipButton>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* ── Topology canvas (collapsible) ── */}
            {showTopology && (
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
                        removedModules={removedModules}
                        fullscreen={fullscreen}
                        onToggleFullscreen={() => setFullscreen(f => !f)}
                        activeModuleAddr={activeModuleAddr}
                        selectedModuleAddr={tab === 3 ? rawSelectedAddr : null}
                        onSelectModuleAddr={tab === 3 ? setRawSelectedAddr : undefined}
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
            )}

            {/* ── Drag-resize handle ── */}
            {!fullscreen && showTopology && (
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
                        <Tab label="Topology" sx={{ minHeight: 38 }} />
                        <Tab label="Connections" sx={{ minHeight: 38 }} />
                        <Tab label="Test Run" sx={{ minHeight: 38 }} />
                        <Tab label="Raw Mode" sx={{ minHeight: 38 }} />
                        <Tab label="History" sx={{ minHeight: 38 }} />
                    </Tabs>
                </Box>
            )}

            {/* ── Tab content ── */}
            {!fullscreen && (
                <Box sx={{ flex: 1, overflow: 'hidden', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
                    {tab === 0 && (
                        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                            <GenerateCompareTab ip={ip} timeout={timeout} onResult={onResult} />
                        </Box>
                    )}
                    {tab === 1 && (
                        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                            <ConnectionsFlow
                                topology={topology}
                                diffStatus={diffStatus}
                                ip={ip}
                                onModuleValveChange={onModuleValveChange}
                                onConfigLoad={onConfigLoad}
                            />
                        </Box>
                    )}
                    {tab === 2 && <TestRunTab ip={ip} />}
                    {tab === 3 && (
                        <RawModeTab
                            topology={topology}
                            ip={ip}
                            selectedModuleAddr={rawSelectedAddr}
                            onSelectModuleAddr={setRawSelectedAddr}
                        />
                    )}
                    {tab === 4 && (
                        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                            <HistoryTab />
                        </Box>
                    )}
                </Box>
            )}
            <DiagnosticsModal open={diagOpen} onClose={() => setDiagOpen(false)} ip={ip} />
        </Box>
    )
}

const appBarFieldSx: SxProps<Theme> = {
    width: 170,
    '& .MuiInputBase-root': { background: 'rgba(255,255,255,0.12)' },
    '& .MuiInputLabel-root, & input': { color: '#fff' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
}
