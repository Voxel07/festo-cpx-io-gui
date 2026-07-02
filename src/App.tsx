import { lazy, Suspense, useReducer, useRef, useEffect, useMemo } from 'react'
import { Box, Tabs, Tab, CircularProgress, Typography } from '@mui/material'
import AppHeader from './components/AppHeader'
import type { Topology, DiffStatus, TopologyModule, BenchConfig } from './types'
import { AlertsManager, AlertsContext } from './utils/AlertsManager'
import type { AlertsManagerRef } from './utils/AlertsManager'

const GenerateCompareTab = lazy(() => import('./components/GenerateCompareTab'))
const TestRunTab = lazy(() => import('./components/TestRunTab'))
const HistoryTab = lazy(() => import('./components/HistoryTab'))
const TopologyFlow = lazy(() => import('./components/TopologyFlow'))
const ConnectionsFlow = lazy(() => import('./components/ConnectionsFlow'))
const RawModeTab = lazy(() => import('./components/RawModeTab'))
const DiagnosticsModal = lazy(() => import('./components/DiagnosticsModal'))

const MIN_CANVAS_H = 140
const MAX_CANVAS_H = 800
const DEFAULT_CANVAS_H = 320

const MIN_CANVAS_W = 300
const MAX_CANVAS_W = 3000

interface AppState {
    tab: number
    ip: string
    timeout: number
    topology: Topology | null
    diffStatus: DiffStatus | null
    removedModules: TopologyModule[]
    canvasH: number
    canvasW: number | null
    fullscreen: boolean
    pbStatus: 'unknown' | 'ok' | 'error'
    pbChecking: boolean
    showTopology: boolean
    activeModuleAddr: number | null
    rawSelectedAddr: number | null
    diagOpen: boolean
    rawConfig: BenchConfig | null
    configPath: string
}

const initialAppState: AppState = {
    tab: 0,
    ip: '192.168.0.11',
    timeout: 0,
    topology: null,
    diffStatus: null,
    removedModules: [],
    canvasH: DEFAULT_CANVAS_H,
    canvasW: null,
    fullscreen: false,
    pbStatus: 'unknown',
    pbChecking: false,
    showTopology: true,
    activeModuleAddr: null,
    rawSelectedAddr: null,
    diagOpen: false,
    rawConfig: null,
    configPath: 'bench_config.json',
}

type AppAction =
    | { type: 'SET_TAB'; tab: number }
    | { type: 'SET_IP'; ip: string }
    | { type: 'SET_TIMEOUT'; timeout: number }
    | { type: 'SET_TOPOLOGY'; topology: Topology | null }
    | { type: 'SET_DIFF_STATUS'; status: DiffStatus | null }
    | { type: 'SET_REMOVED_MODULES'; removed: TopologyModule[] }
    | { type: 'SET_CANVAS_H'; height: number }
    | { type: 'SET_CANVAS_W'; width: number | null }
    | { type: 'SET_FULLSCREEN'; fullscreen: boolean }
    | { type: 'SET_PB_STATUS'; status: 'unknown' | 'ok' | 'error' }
    | { type: 'SET_PB_CHECKING'; checking: boolean }
    | { type: 'TOGGLE_TOPOLOGY' }
    | { type: 'SET_ACTIVE_MODULE_ADDR'; addr: number | null }
    | { type: 'SET_RAW_SELECTED_ADDR'; addr: number | null }
    | { type: 'SET_DIAG_OPEN'; open: boolean }
    | { type: 'SET_RAW_CONFIG'; config: BenchConfig | null }
    | { type: 'SET_RESULT'; topo: Topology | null; status: DiffStatus | null; removed: TopologyModule[]; config?: BenchConfig }
    | { type: 'CONFIG_LOAD'; config: BenchConfig }
    | { type: 'MODULE_VALVE_CHANGE'; addr: number; mountedValves: number[]; valveSlots?: number }
    | { type: 'SET_CONFIG_PATH'; path: string }

export function configToTopology(config: BenchConfig): Topology {
    return {
        Name: config.test_bench.name || 'CPX-AP Bench',
        Description: config.test_bench.description || '',
        Version: config.test_bench.version || '1.0',
        Topology: (config.module_instances || []).map(inst => {
            const typeDef = config.module_types?.[inst.module_type_ref]
            return {
                Name: inst.display_name,
                Modulecode: inst.module_code,
                ProductKey: inst.product_key,
                Adress: inst.address,
                Type: inst.category, // Direct mapping from backend metadata!
                NumOfInputs: inst.num_inputs ?? typeDef?.num_inputs ?? 0,
                NumOfOutputs: inst.num_outputs ?? typeDef?.num_outputs ?? 0,
                NumOfInOuts: inst.num_inouts ?? typeDef?.num_configurable ?? 0,
                MountedValves: inst.mounted_valves ?? undefined,
                ValveSlots: inst.valve_slots ?? typeDef?.valve_count ?? undefined,
            }
        })
    }
}

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_TAB':
            return {
                ...state,
                tab: action.tab,
                rawSelectedAddr: action.tab !== 3 ? null : state.rawSelectedAddr,
            }
        case 'SET_CONFIG_PATH':
            return { ...state, configPath: action.path }
        case 'SET_IP':
            return { ...state, ip: action.ip }
        case 'SET_TIMEOUT':
            return { ...state, timeout: action.timeout }
        case 'SET_TOPOLOGY':
            return { ...state, topology: action.topology }
        case 'SET_DIFF_STATUS':
            return { ...state, diffStatus: action.status }
        case 'SET_REMOVED_MODULES':
            return { ...state, removedModules: action.removed }
        case 'SET_CANVAS_H':
            return { ...state, canvasH: action.height }
        case 'SET_CANVAS_W':
            return { ...state, canvasW: action.width }
        case 'SET_FULLSCREEN':
            return { ...state, fullscreen: action.fullscreen }
        case 'SET_PB_STATUS':
            return { ...state, pbStatus: action.status }
        case 'SET_PB_CHECKING':
            return { ...state, pbChecking: action.checking }
        case 'TOGGLE_TOPOLOGY':
            return { ...state, showTopology: !state.showTopology }
        case 'SET_ACTIVE_MODULE_ADDR':
            return { ...state, activeModuleAddr: action.addr }
        case 'SET_RAW_SELECTED_ADDR':
            return { ...state, rawSelectedAddr: action.addr }
        case 'SET_DIAG_OPEN':
            return { ...state, diagOpen: action.open }
        case 'SET_RAW_CONFIG':
            return { ...state, rawConfig: action.config }
        case 'SET_RESULT': {
            const newRaw = action.config !== undefined ? action.config : state.rawConfig
            let mergedTopo = action.topo
            if (mergedTopo && newRaw?.module_instances) {
                mergedTopo = {
                    ...mergedTopo,
                    Topology: mergedTopo.Topology.map(m => {
                        const inst = newRaw.module_instances.find(i => i.address === m.Adress)
                        if (inst && inst.mounted_valves) {
                            return { ...m, MountedValves: inst.mounted_valves }
                        }
                        return m
                    })
                }
            }
            return {
                ...state,
                topology: mergedTopo,
                diffStatus: action.status,
                removedModules: action.removed,
                rawConfig: newRaw,
            }
        }
        case 'CONFIG_LOAD':
            return {
                ...state,
                rawConfig: action.config,
                topology: configToTopology(action.config),
            }
        case 'MODULE_VALVE_CHANGE': {
            const nextTopo = state.topology ? {
                ...state.topology,
                Topology: state.topology.Topology.map(m =>
                    m.Adress === action.addr ? { ...m, MountedValves: action.mountedValves, ValveSlots: action.valveSlots } : m
                ),
            } : null
            const nextRaw = state.rawConfig ? {
                ...state.rawConfig,
                module_instances: (state.rawConfig.module_instances || []).map(inst =>
                    inst.address === action.addr ? { ...inst, mounted_valves: action.mountedValves, valve_slots: action.valveSlots } : inst
                )
            } : null
            return {
                ...state,
                topology: nextTopo,
                rawConfig: nextRaw,
            }
        }
        default:
            return state
    }
}

async function pollTestRunStatus(onStatusUpdate: (active: boolean, currentModule: number | null) => void) {
    try {
        const r = await fetch('/test-run/status')
        if (!r.ok) return
        const d = await r.json()
        if (d.status === 'running') {
            const currentMod = d.progress?.current_module != null ? Number(d.progress.current_module) : null
            onStatusUpdate(true, currentMod)
        } else {
            onStatusUpdate(false, null)
        }
    } catch { /* ignore */ }
}

function LoadingChunk({ label = 'Loading…' }: { label?: string }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'text.secondary' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">{label}</Typography>
        </Box>
    )
}

export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialAppState)
    const {
        tab,
        ip,
        timeout,
        topology,
        diffStatus,
        removedModules,
        canvasH,
        canvasW,
        fullscreen,
        pbStatus,
        pbChecking,
        showTopology,
        activeModuleAddr,
        rawSelectedAddr,
        diagOpen,
        rawConfig,
        configPath,
    } = state

    const alertsRef = useRef<AlertsManagerRef>(null)

    async function checkPocketBase() {
        dispatch({ type: 'SET_PB_CHECKING', checking: true })
        try {
            const r = await fetch('/pocketbase/health')
            const d = await r.json()
            dispatch({ type: 'SET_PB_STATUS', status: d.status === 'ok' ? 'ok' : 'error' })
            dispatch({ type: 'SET_PB_CHECKING', checking: false })
        } catch {
            dispatch({ type: 'SET_PB_STATUS', status: 'error' })
            dispatch({ type: 'SET_PB_CHECKING', checking: false })
        }
    }

    // Poll test-run status for topology highlighting (slow when idle)


    useEffect(() => {
        let active = false
        const timer = setInterval(() => {
            pollTestRunStatus((isRunning, currentMod) => {
                if (isRunning) {
                    active = true
                    dispatch({ type: 'SET_ACTIVE_MODULE_ADDR', addr: currentMod })
                } else {
                    if (active) dispatch({ type: 'SET_ACTIVE_MODULE_ADDR', addr: null })
                    active = false
                }
            })
        }, 2000)
        return () => clearInterval(timer)
    }, [])

    // Auto-load bench_config.json on startup
    useEffect(() => {
        let cancelled = false
        fetch('/config?file_path=bench_config.json')
            .then(r => {
                if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
                return r.json()
            })
            .then(config => {
                if (!cancelled && config?.test_bench) {
                    dispatch({ type: 'CONFIG_LOAD', config })
                }
            })
            .catch(err => {
                console.error("Auto-load config failed:", err)
            })
        return () => { cancelled = true }
    }, [])

    // Drag-to-resize height handle
    const dragRef = useRef({ active: false, startY: 0, startH: 0 })
    function onDragStart(e: React.MouseEvent) {
        dragRef.current = { active: true, startY: e.clientY, startH: canvasH }
        e.preventDefault()
        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current.active) return
            const delta = ev.clientY - dragRef.current.startY
            dispatch({ type: 'SET_CANVAS_H', height: Math.min(MAX_CANVAS_H, Math.max(MIN_CANVAS_H, dragRef.current.startH + delta)) })
        }
        const onUp = () => {
            dragRef.current.active = false
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    // Drag-to-resize width handle
    const wDragRef = useRef({ active: false, startX: 0, startW: 0 })
    function onWidthDragStart(e: React.MouseEvent) {
        const startW = canvasW ?? (e.currentTarget.parentElement?.getBoundingClientRect().width ?? 800)
        wDragRef.current = { active: true, startX: e.clientX, startW }
        e.preventDefault()
        const onMove = (ev: MouseEvent) => {
            if (!wDragRef.current.active) return
            const delta = ev.clientX - wDragRef.current.startX
            dispatch({ type: 'SET_CANVAS_W', width: Math.min(MAX_CANVAS_W, Math.max(MIN_CANVAS_W, wDragRef.current.startW + delta)) })
        }
        const onUp = () => {
            wDragRef.current.active = false
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    function onResult(topo: Topology | null, status: DiffStatus | null, removed: TopologyModule[] = [], config?: BenchConfig) {
        dispatch({ type: 'SET_RESULT', topo, status, removed, config })
    }

    /** Sync topology + rawConfig when a BenchConfig is loaded in ConnectionsFlow */
    function onConfigLoad(config: BenchConfig) {
        dispatch({ type: 'CONFIG_LOAD', config })
    }

    /** Patch MountedValves on a module entry when user configures valves in ConnectionsFlow */
    function onModuleValveChange(addr: number, mountedValves: number[], valveSlots?: number) {
        dispatch({ type: 'MODULE_VALVE_CHANGE', addr, mountedValves, valveSlots })
    }

    const alertsContextValue = useMemo(() => ({
        showAlert: (sev: any, msg: any) => alertsRef.current?.showAlert(sev, msg)
    }), [])

    return (
        <AlertsContext.Provider value={alertsContextValue}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                <AlertsManager ref={alertsRef} />
                <AppHeader
                    ip={ip}
                    onIpChange={v => dispatch({ type: 'SET_IP', ip: v })}
                    timeout={timeout}
                    onTimeoutChange={v => dispatch({ type: 'SET_TIMEOUT', timeout: v })}
                    showTopology={showTopology}
                    onToggleTopology={() => dispatch({ type: 'TOGGLE_TOPOLOGY' })}
                    pbChecking={pbChecking}
                    pbStatus={pbStatus}
                    onCheckPocketBase={checkPocketBase}
                    onOpenDiagnostics={() => dispatch({ type: 'SET_DIAG_OPEN', open: true })}
                    configPath={configPath}
                    onConfigPathChange={path => dispatch({ type: 'SET_CONFIG_PATH', path })}
                />

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
                            <Suspense fallback={<LoadingChunk label="Loading topology…" />}>
                                <TopologyFlow
                                    topology={topology}
                                    diffStatus={diffStatus}
                                    removedModules={removedModules}
                                    fullscreen={fullscreen}
                                    onToggleFullscreen={() => dispatch({ type: 'SET_FULLSCREEN', fullscreen: !fullscreen })}
                                    activeModuleAddr={activeModuleAddr}
                                    selectedModuleAddr={tab === 3 ? rawSelectedAddr : null}
                                    onSelectModuleAddr={tab === 3 ? (addr => dispatch({ type: 'SET_RAW_SELECTED_ADDR', addr })) : undefined}
                                    rawConfig={rawConfig}
                                />
                            </Suspense>
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
                        <Tabs value={tab} onChange={(_, v) => dispatch({ type: 'SET_TAB', tab: v })} sx={{ minHeight: 38 }}
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
                                <Suspense fallback={<LoadingChunk label="Loading topology tools…" />}>
                                    <GenerateCompareTab ip={ip} timeout={timeout} onResult={onResult} configPath={configPath} />
                                </Suspense>
                            </Box>
                        )}
                        {tab === 1 && (
                            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                <Suspense fallback={<LoadingChunk label="Loading connection editor…" />}>
                                    <ConnectionsFlow
                                        topology={topology}
                                        diffStatus={diffStatus}
                                        ip={ip}
                                        onModuleValveChange={onModuleValveChange}
                                        onConfigLoad={onConfigLoad}
                                        rawConfig={rawConfig}
                                        configPath={configPath}
                                    />
                                </Suspense>
                            </Box>
                        )}
                        {tab === 2 && (
                            <Suspense fallback={<LoadingChunk label="Loading test runner…" />}>
                                <TestRunTab ip={ip} />
                            </Suspense>
                        )}
                        {tab === 3 && (
                            <Suspense fallback={<LoadingChunk label="Loading raw mode…" />}>
                                <RawModeTab
                                    topology={topology}
                                    ip={ip}
                                    selectedModuleAddr={rawSelectedAddr}
                                    onSelectModuleAddr={addr => dispatch({ type: 'SET_RAW_SELECTED_ADDR', addr })}
                                />
                            </Suspense>
                        )}
                        {tab === 4 && (
                            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                                <Suspense fallback={<LoadingChunk label="Loading history…" />}>
                                    <HistoryTab />
                                </Suspense>
                            </Box>
                        )}
                    </Box>
                )}
                {diagOpen && (
                    <Suspense fallback={null}>
                        <DiagnosticsModal open={diagOpen} onClose={() => dispatch({ type: 'SET_DIAG_OPEN', open: false })} ip={ip} />
                    </Suspense>
                )}
            </Box>
        </AlertsContext.Provider>
    )
}
