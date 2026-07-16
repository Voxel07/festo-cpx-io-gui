import { lazy, Suspense, useReducer, useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import AppHeader from './components/AppHeader'
import TopologyToolbar, { DEFAULT_MODULES_PER_ROW } from './components/TopologyToolbar'
import type { Topology, DiffStatus, TopologyModule, BenchConfig, DiagnosisEntry } from './types'
import { AlertsManager } from './utils/AlertsManager'
import { AlertsContext } from './utils/AlertsContext'
import type { AlertsManagerRef } from './utils/AlertsManagerTypes'

import AppTabContent from './components/AppTabContent'
import { LoadingChunk } from './components/LoadingChunk'
import { IoStateProvider } from './hooks/useIoStatePolling'

const TopologyFlow = lazy(() => import('./components/TopologyFlow'))
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
    showApCables: boolean
    showIoCables: boolean
    diagnoses: DiagnosisEntry[]
    mockTopology: Topology | null
    wrapThreshold: number
    cableGap: number
    hwConnected: boolean
    hwConnecting: boolean
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
    configPath: 'data/bench_config.json',
    showApCables: true,
    showIoCables: true,
    diagnoses: [] as DiagnosisEntry[],
    mockTopology: null,
    wrapThreshold: DEFAULT_MODULES_PER_ROW,
    cableGap: 20,
    hwConnected: false,
    hwConnecting: false,
}

type AppAction =
    | { type: 'SET_TAB'; tab: number }
    | { type: 'SET_IP'; ip: string }
    | { type: 'SET_TIMEOUT'; timeout: number }
    | { type: 'SET_TOPOLOGY'; topology: Topology | null }
    | { type: 'SET_DIFF_STATUS'; status: DiffStatus | null }
    | { type: 'SET_REMOVED_MODULES'; removed: TopologyModule[] }
    | { type: 'SET_MOCK_TOPOLOGY'; topo: Topology | null }
    | { type: 'SET_WRAP_THRESHOLD'; threshold: number }
    | { type: 'SET_CABLE_GAP'; gap: number }
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
    | { type: 'MOCK_MODULE_VALVE_CHANGE'; addr: number; mountedValves: number[]; valveSlots?: number }
    | { type: 'MOCK_MODULE_MOVE'; oldAddr: number; newAddr: number }
    | { type: 'SET_CONFIG_PATH'; path: string }
    | { type: 'TOGGLE_AP_CABLES' }
    | { type: 'TOGGLE_IO_CABLES' }
    | { type: 'SET_DIAGNOSES'; diagnoses: DiagnosisEntry[] }
    | { type: 'SET_HW_CONNECTED'; connected: boolean }
    | { type: 'SET_HW_CONNECTING'; connecting: boolean }

import { configToTopology } from './utils/topology'

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
        case 'TOGGLE_AP_CABLES':
            return { ...state, showApCables: !state.showApCables }
        case 'TOGGLE_IO_CABLES':
            return { ...state, showIoCables: !state.showIoCables }
        case 'SET_DIAGNOSES':
            return { ...state, diagnoses: action.diagnoses }
        case 'SET_HW_CONNECTED':
            return { ...state, hwConnected: action.connected }
        case 'SET_HW_CONNECTING':
            return { ...state, hwConnecting: action.connecting }
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
        case 'SET_MOCK_TOPOLOGY':
            return { ...state, mockTopology: action.topo }
        case 'SET_WRAP_THRESHOLD':
            return { ...state, wrapThreshold: action.threshold }
        case 'SET_CABLE_GAP':
            return { ...state, cableGap: action.gap }
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
                        if (inst) {
                            return {
                                ...m,
                                ...(inst.mounted_valves !== undefined
                                    ? { MountedValves: inst.mounted_valves }
                                    : {}),
                                ...(inst.valve_slots != null
                                    ? { ValveSlots: inst.valve_slots }
                                    : {}),
                            }
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
        case 'MOCK_MODULE_VALVE_CHANGE': {
            const nextMock = state.mockTopology ? {
                ...state.mockTopology,
                Topology: state.mockTopology.Topology.map((m: TopologyModule) =>
                    m.Adress === action.addr ? { ...m, MountedValves: action.mountedValves, ValveSlots: action.valveSlots ?? m.ValveSlots } : m
                ),
            } : null
            return {
                ...state,
                mockTopology: nextMock,
            }
        }
        case 'MODULE_VALVE_CHANGE': {
            const nextTopo = state.topology ? {
                ...state.topology,
                Topology: state.topology.Topology.map(m =>
                    m.Adress === action.addr ? { ...m, MountedValves: action.mountedValves, ValveSlots: action.valveSlots ?? m.ValveSlots } : m
                ),
            } : null
            const nextRaw = state.rawConfig ? {
                ...state.rawConfig,
                module_instances: (state.rawConfig.module_instances || []).map(inst =>
                    inst.address === action.addr ? { ...inst, mounted_valves: action.mountedValves, valve_slots: action.valveSlots ?? inst.valve_slots } : inst
                )
            } : null
            return {
                ...state,
                topology: nextTopo,
                rawConfig: nextRaw,
            }
        }
        case 'MOCK_MODULE_MOVE': {
            if (!state.mockTopology) return state
            const mods = [...state.mockTopology.Topology]
            mods.sort((a, b) => a.Adress - b.Adress)

            const oldIdx = mods.findIndex(m => m.Adress === action.oldAddr)
            if (oldIdx === -1) return state

            let newIdx = action.newAddr
            if (newIdx < 0) newIdx = 0
            if (newIdx >= mods.length) newIdx = mods.length - 1

            const [movingMod] = mods.splice(oldIdx, 1)
            mods.splice(newIdx, 0, movingMod)

            const newMods = mods.map((m, i) => ({ ...m, Adress: i }))

            return {
                ...state,
                mockTopology: {
                    ...state.mockTopology,
                    Topology: newMods
                }
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



export default function App() {
    const [state, dispatch] = useReducer(appReducer, initialAppState)
    const [hardwareOwnedByTest, setHardwareOwnedByTest] = useState(false)
    const [mockBuilderSection, setMockBuilderSection] = useState(() => Number(window.localStorage.getItem('festo.mock-builder.section.v1')) === 1 ? 1 : 0)
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
        showApCables,
        showIoCables,
        diagnoses,
        mockTopology,
        wrapThreshold,
        cableGap,
        hwConnected,
        hwConnecting,
    } = state
    const topologyVisibleForTab = tab !== 6 && (tab !== 5 || mockBuilderSection === 1)

    const alertsRef = useRef<AlertsManagerRef>(null)

    async function checkPocketBase(showFeedback = false) {
        dispatch({ type: 'SET_PB_CHECKING', checking: true })
        try {
            const r = await fetch('/pocketbase/health')
            const d = await r.json()
            const isOk = d.status === 'ok'
            dispatch({ type: 'SET_PB_STATUS', status: isOk ? 'ok' : 'error' })
            dispatch({ type: 'SET_PB_CHECKING', checking: false })
            if (showFeedback) {
                if (isOk) alertsRef.current?.showAlert('success', 'PocketBase connected successfully')
                else alertsRef.current?.showAlert('error', 'PocketBase connection failed')
            }
        } catch {
            dispatch({ type: 'SET_PB_STATUS', status: 'error' })
            dispatch({ type: 'SET_PB_CHECKING', checking: false })
            if (showFeedback) {
                alertsRef.current?.showAlert('error', 'PocketBase is unreachable')
            }
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

    // Poll system diagnoses for topology indicators
    const refreshDiagnoses = useCallback(async () => {
        if (!ip || !hwConnected) return
        try {
            const r = await fetch(`/io/diagnoses?ip_address=${encodeURIComponent(ip)}`)
            if (!r.ok) return
            const d: DiagnosisEntry[] = await r.json()
            dispatch({ type: 'SET_DIAGNOSES', diagnoses: d })
        } catch { /* ignore */ }
    }, [ip, hwConnected])

    useEffect(() => {
        refreshDiagnoses()
        const timer = setInterval(refreshDiagnoses, 5000)
        return () => clearInterval(timer)
    }, [refreshDiagnoses])

    // Auto-load data/bench_config.json on startup
    useEffect(() => {
        if (!configPath) return
        let cancelled = false
        fetch(`/config?file_path=${encodeURIComponent(configPath)}`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
                return r.json()
            })
            .then(config => {
                if (!cancelled && config?.test_bench) {
                    dispatch({ type: 'CONFIG_LOAD', config })
                    // Use the IP from the bench config if available
                    if (config.test_bench.ip_address) {
                        dispatch({ type: 'SET_IP', ip: config.test_bench.ip_address })
                    }
                }
            })
            .catch(err => {
                console.error("Auto-load config failed:", err)
                if (!cancelled) {
                    alertsRef.current?.showAlert('info', `Config file '${configPath}' not found. Please generate it in the Topology tab.`)
                }
            })
        return () => { cancelled = true }
    }, [configPath])

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

    /** Patch MountedValves on a module entry when user configures valves in ConnectionsFlow or Mock Builder */
    function onModuleValveChange(addr: number, mountedValves: number[], valveSlots?: number) {
        if (state.tab === 5) {
            dispatch({ type: 'MOCK_MODULE_VALVE_CHANGE', addr, mountedValves, valveSlots })
        } else {
            dispatch({ type: 'MODULE_VALVE_CHANGE', addr, mountedValves, valveSlots })
        }
    }

    function onRemoveModule(addr: number) {
        if (!mockTopology) return
        dispatch({
            type: 'SET_MOCK_TOPOLOGY',
            topo: {
                ...mockTopology,
                Topology: mockTopology.Topology.filter(m => m.Adress !== addr).map((m, i) => ({ ...m, Adress: i }))
            }
        })
    }

    function onMoveModule(oldAddr: number, newAddr: number) {
        dispatch({ type: 'MOCK_MODULE_MOVE', oldAddr, newAddr })
    }

    // ── HW connect / disconnect ──────────────────────────────────────
    function onConnect() {
        dispatch({ type: 'SET_HW_CONNECTING', connecting: true })
        fetch('/hw/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip_address: ip, timeout }),
        })
            .then(r => {
                if (!r.ok) return r.json().then(d => { throw new Error(d.detail || 'Connection failed') })
                return r.json()
            })
            .then(() => {
                dispatch({ type: 'SET_HW_CONNECTED', connected: true })
                alertsRef.current?.showAlert('success', `Connected to ${ip}`)
            })
            .catch(err => {
                alertsRef.current?.showAlert('error', `HW connect failed: ${err.message}`)
            })
            .finally(() => dispatch({ type: 'SET_HW_CONNECTING', connecting: false }))
    }

    function onDisconnect() {
        fetch('/hw/disconnect', { method: 'POST' })
            .then(() => {
                dispatch({ type: 'SET_HW_CONNECTED', connected: false })
                alertsRef.current?.showAlert('info', 'Disconnected from hardware')
            })
            .catch(err => {
                alertsRef.current?.showAlert('error', `HW disconnect failed: ${err.message}`)
            })
    }

    // Poll HW connection status periodically
    useEffect(() => {
        const poll = () => {
            fetch('/hw/status')
                .then(r => r.json())
                .then((d: { connected?: boolean; test_running?: boolean }) => {
                    dispatch({ type: 'SET_HW_CONNECTED', connected: !!d.connected })
                    setHardwareOwnedByTest(!!d.test_running)
                })
                .catch(() => { })
        }
        poll()
        const timer = setInterval(poll, 1000)
        return () => clearInterval(timer)
    }, [])

    const alertsContextValue = useMemo(() => ({
        showAlert: (sev: any, msg: any) => alertsRef.current?.showAlert(sev, msg)
    }), [])

    return (
        <AlertsContext.Provider value={alertsContextValue}>
            <IoStateProvider ipAddress={ip} intervalMs={500} isConnected={hwConnected} paused={hardwareOwnedByTest}>
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
                        hwConnected={hwConnected}
                        hwConnecting={hwConnecting}
                        hwBusy={hardwareOwnedByTest}
                        onConnect={onConnect}
                        onDisconnect={onDisconnect}
                    />

                    {/* ── Topology toolbar (below AppHeader) ── */}
                    {showTopology && topologyVisibleForTab && (
                        <TopologyToolbar
                            showApCables={showApCables}
                            onToggleApCables={() => dispatch({ type: 'TOGGLE_AP_CABLES' })}
                            showIoCables={showIoCables}
                            onToggleIoCables={() => dispatch({ type: 'TOGGLE_IO_CABLES' })}
                            fullscreen={fullscreen}
                            onToggleFullscreen={() => dispatch({ type: 'SET_FULLSCREEN', fullscreen: !fullscreen })}
                            showLegend={!!diffStatus}
                            wrapThreshold={wrapThreshold}
                            onWrapThresholdChange={val => dispatch({ type: 'SET_WRAP_THRESHOLD', threshold: val })}
                            cableGap={cableGap}
                            onCableGapChange={val => dispatch({ type: 'SET_CABLE_GAP', gap: val })}
                        />
                    )}

                    {/* ── Topology canvas (collapsible) ── */}
                    {showTopology && topologyVisibleForTab && (
                        <Box sx={fullscreen
                            ? { position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }
                            : {
                                display: 'flex', flexDirection: 'row',
                                height: canvasH, flexShrink: 0,
                                borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default',
                            }
                        }>
                            {/* Toolbar overlay in fullscreen mode */}
                            {fullscreen && (
                                <TopologyToolbar
                                    showApCables={showApCables}
                                    onToggleApCables={() => dispatch({ type: 'TOGGLE_AP_CABLES' })}
                                    showIoCables={showIoCables}
                                    onToggleIoCables={() => dispatch({ type: 'TOGGLE_IO_CABLES' })}
                                    fullscreen={fullscreen}
                                    onToggleFullscreen={() => dispatch({ type: 'SET_FULLSCREEN', fullscreen: !fullscreen })}
                                    showLegend={tab === 0 && !!diffStatus}
                                    wrapThreshold={wrapThreshold}
                                    onWrapThresholdChange={val => dispatch({ type: 'SET_WRAP_THRESHOLD', threshold: val })}
                                    cableGap={cableGap}
                                    onCableGapChange={val => dispatch({ type: 'SET_CABLE_GAP', gap: val })}
                                />
                            )}
                            {/* Canvas area (width-constrained when user has dragged) */}
                            <Box sx={{
                                width: canvasW ?? undefined,
                                height: fullscreen ? undefined : '100%',
                                flex: fullscreen ? 1 : (canvasW ? 'none' : 1),
                                overflow: 'hidden',
                                position: 'relative',
                            }}>
                                <Suspense fallback={<LoadingChunk label="Loading topology…" />}>
                                    <TopologyFlow
                                        topology={tab === 5 ? mockTopology : topology}
                                        diffStatus={tab === 0 ? diffStatus : null}
                                        removedModules={tab === 0 ? removedModules : []}
                                        activeModuleAddr={activeModuleAddr}
                                        selectedModuleAddr={tab === 3 ? rawSelectedAddr : null}
                                        onSelectModuleAddr={tab === 3 ? (addr => dispatch({ type: 'SET_RAW_SELECTED_ADDR', addr })) : undefined}
                                        rawConfig={rawConfig}
                                        showApCables={showApCables}
                                        showIoCables={showIoCables}
                                        diagnoses={diagnoses}
                                        wrapThreshold={wrapThreshold}
                                        cableGap={cableGap}
                                        isMockMode={tab === 5}
                                        onRemoveModule={onRemoveModule}
                                        onMoveModule={tab === 5 ? onMoveModule : undefined}
                                    />
                                </Suspense>
                            </Box>

                            {/* Right-edge width resize handle */}
                            {!fullscreen && (
                                <Box onMouseDown={onWidthDragStart} sx={{
                                    width: 6, flexShrink: 0, cursor: 'col-resize',
                                    bgcolor: 'divider',
                                    '&:hover': { bgcolor: 'primary.main' },
                                    transition: 'background-color 0.15s',
                                    userSelect: 'none',
                                }} />
                            )}
                        </Box>
                    )}

                    {/* ── Drag-resize handle ── */}
                    {!fullscreen && showTopology && topologyVisibleForTab && (
                        <Box onMouseDown={onDragStart} sx={{
                            height: 6, flexShrink: 0, cursor: 'row-resize',
                            bgcolor: 'divider',
                            '&:hover': { bgcolor: 'primary.main' },
                            transition: 'background-color 0.15s',
                            userSelect: 'none',
                        }} />
                    )}

                    {/* ── Tab bar ── */}
                    {!fullscreen && (
                        <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            <Tabs value={tab} onChange={(_, v) => dispatch({ type: 'SET_TAB', tab: v })} sx={{ minHeight: 38, flex: 1 }}
                                variant="scrollable" scrollButtons="auto">
                                <Tab label="Topology" sx={{ minHeight: 38 }} />
                                <Tab label="Connections" sx={{ minHeight: 38 }} />
                                <Tab label="Test Run" sx={{ minHeight: 38 }} />
                                <Tab label="Raw Mode" sx={{ minHeight: 38 }} />
                                <Tab label="History" sx={{ minHeight: 38 }} />
                                <Tab label="Automation" sx={{ minHeight: 38 }} />
                                <Tab label="Architecture" sx={{ minHeight: 38 }} />
                            </Tabs>
                        </Box>
                    )}

                    {/* ── Tab content ── */}
                    {!fullscreen && (
                        <AppTabContent
                            tab={tab}
                            ip={ip}
                            timeout={timeout}
                            topology={topology}
                            diffStatus={diffStatus}
                            rawSelectedAddr={rawSelectedAddr}
                            rawConfig={rawConfig}
                            configPath={configPath}
                            hwConnected={hwConnected}
                            mockTopology={mockTopology}
                            wrapThreshold={wrapThreshold}
                            onWrapThresholdChange={val => dispatch({ type: 'SET_WRAP_THRESHOLD', threshold: val })}
                            cableGap={cableGap}
                            onCableGapChange={val => dispatch({ type: 'SET_CABLE_GAP', gap: val })}
                            onResult={onResult}
                            onModuleValveChange={onModuleValveChange}
                            onConfigLoad={onConfigLoad}
                            onSetRawSelectedAddr={addr => dispatch({ type: 'SET_RAW_SELECTED_ADDR', addr })}
                            onSetMockTopology={topo => dispatch({ type: 'SET_MOCK_TOPOLOGY', topo })}
                            onMockBuilderSectionChange={setMockBuilderSection}
                            onTestRunActiveChange={active => {
                                if (active) setHardwareOwnedByTest(true)
                            }}
                        />
                    )}
                    {diagOpen && (
                        <Suspense fallback={null}>
                            <DiagnosticsModal open={diagOpen} onClose={() => dispatch({ type: 'SET_DIAG_OPEN', open: false })} ip={ip} diagnoses={diagnoses} onRefresh={refreshDiagnoses} />
                        </Suspense>
                    )}
                </Box>
            </IoStateProvider>
        </AlertsContext.Provider>
    )
}
