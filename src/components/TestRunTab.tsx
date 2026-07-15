/**
 * TestRunTab – start, monitor, and view results of automated CPX-AP tests.
 *
 * Polls /test-run/status continuously (idle: 5 s, active: 2 s) so any run
 * started from the UI, CI, or another external API client appears live.
 * PocketBase realtime provides instant push-notification when a new run
 * starts externally and streams log entries for external runs.
 */
import { useReducer, useEffect, useRef, useCallback, useState } from 'react'
import { Box, Stack, Typography, Alert, Paper, CircularProgress } from '@mui/material'
import TestSelection from './TestSelection'
import TestProgress from './TestProgress'
import TestResults from './TestResults'
import TestLiveLog from './TestLiveLog'
import { usePocketBaseRealtime } from '../hooks/usePocketBaseRealtime'

/** Fast poll interval while a run is active (started locally or detected externally). */
const POLL_MS = 2000
/** Slow background poll while idle — detects externally-started runs. */
const POLL_IDLE_MS = 5000

const CONFIG_PATH = 'data/bench_config.json'

export interface Checkpoint {
    test: string
    status: 'running' | 'passed' | 'failed' | 'skipped'
    timestamp: number
    error?: string
}

export interface LogEntry {
    level: string
    message: string
    timestamp: string
}

export interface TestResult {
    test_id?: string
    passed?: boolean
    error?: string
    duration_ms?: number
    [k: string]: unknown
}

export interface TestRunState {
    run_id?: string
    status: 'idle' | 'starting' | 'running' | 'completed' | 'error'
    source?: string
    ip_address?: string
    tests?: string[]
    progress?: { completed: number; total: number; current_test: string | null; current_module: string | null }
    results?: TestResult[]
    checkpoints?: Checkpoint[]
    logs?: LogEntry[]
    error?: string
}

const AVAILABLE_TESTS = [
    { id: 'connection-validation', label: 'Connection Validation' },
    { id: 'compare-topology', label: 'Topology Comparison' },
    { id: 'output-toggle', label: 'Output Toggle' },
    { id: 'valve-toggle', label: 'Valve Toggle' },
    { id: 'dio-toggle', label: 'DIO Toggle' },
    { id: 'condition-counter', label: 'Condition Counter' },
    { id: 'valve-condition-counter', label: 'Valve CC' },
    { id: 'remanent-params', label: 'Remanent Parameters' },
    { id: 'factory-reset', label: 'Factory Reset' },
    { id: 'open-load-diag', label: 'Open-Load Diagnostic' },
]

function parseJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) } catch { return value }
}

function normalizeTests(value: unknown): string[] {
    const parsed = parseJsonValue(value)
    if (Array.isArray(parsed)) return parsed.map(String)
    return typeof parsed === 'string' && parsed.length > 0 ? [parsed] : []
}

function normalizeResults(value: unknown): TestResult[] {
    const parsed = parseJsonValue(value)
    if (Array.isArray(parsed)) return parsed.filter((item): item is TestResult => !!item && typeof item === 'object')
    if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>
        if ('test_id' in record) return [record as TestResult]
        return Object.values(record).filter((item): item is TestResult => !!item && typeof item === 'object')
    }
    return []
}

function normalizeCheckpoints(value: unknown): Checkpoint[] {
    const parsed = parseJsonValue(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Checkpoint => !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).test === 'string')
}

function normalizeRunState(value: unknown): TestRunState {
    const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const rawStatus = String(raw.status ?? 'idle')
    const status: TestRunState['status'] =
        rawStatus === 'failed' ? 'error' :
            rawStatus === 'idle' || rawStatus === 'starting' || rawStatus === 'running' || rawStatus === 'completed' || rawStatus === 'error'
                ? rawStatus
                : 'error'
    return {
        ...raw,
        status,
        tests: normalizeTests(raw.tests),
        results: normalizeResults(raw.results),
        checkpoints: normalizeCheckpoints(raw.checkpoints),
        logs: Array.isArray(raw.logs) ? raw.logs as LogEntry[] : [],
    } as TestRunState
}

interface Props {
    ip: string
}

interface RunTabState {
    selected: string[]
    runState: TestRunState
    sseLogs: LogEntry[]
    /** Log entries streamed from PocketBase realtime (external runs / SSE fallback). */
    pbLogs: LogEntry[]
    busy: boolean
}

const initialRunTabState: RunTabState = {
    selected: ['connection-validation', 'compare-topology'],
    runState: { status: 'idle' },
    sseLogs: [],
    pbLogs: [],
    busy: false,
}

type RunTabAction =
    | { type: 'SET_SELECTED'; selected: string[] }
    | { type: 'SET_RUN_STATE'; state: TestRunState }
    | { type: 'SET_SSE_LOGS'; logs: LogEntry[] }
    | { type: 'APPEND_SSE_LOG'; log: LogEntry }
    | { type: 'APPEND_PB_LOG'; log: LogEntry }
    | { type: 'CLEAR_PB_LOGS' }
    | { type: 'SET_BUSY'; busy: boolean }
    | { type: 'START_RUN'; selected: string[] }
    | { type: 'RUN_START_FAIL'; error: string }
    | { type: 'DISMISS_RUN_ERROR' }

function mergeRunState(current: TestRunState, incoming: TestRunState): TestRunState {
    const sameRun = !current.run_id || !incoming.run_id || current.run_id === incoming.run_id
    if (!sameRun) return incoming
    return {
        ...current,
        ...incoming,
        run_id: incoming.run_id ?? current.run_id,
        source: incoming.source ?? current.source,
        tests: incoming.tests?.length ? incoming.tests : current.tests,
        progress: incoming.progress ?? current.progress,
        results: incoming.results?.length ? incoming.results : current.results,
        checkpoints: incoming.checkpoints?.length ? incoming.checkpoints : current.checkpoints,
        logs: incoming.logs?.length ? incoming.logs : current.logs,
        error: incoming.status === 'error' ? incoming.error ?? current.error : undefined,
    }
}

function runTabReducer(state: RunTabState, action: RunTabAction): RunTabState {
    switch (action.type) {
        case 'SET_SELECTED':
            return { ...state, selected: action.selected }
        case 'SET_RUN_STATE':
            // The API can briefly report idle while a worker is starting,
            // restarting, or persisting its terminal result. Never erase the
            // visible run card because of that transient snapshot.
            if (action.state.status === 'idle' && state.runState.status !== 'idle') return state
            return { ...state, runState: mergeRunState(state.runState, action.state) }
        case 'SET_SSE_LOGS':
            return { ...state, sseLogs: action.logs }
        case 'APPEND_SSE_LOG': {
            const next = [...state.sseLogs, action.log]
            return { ...state, sseLogs: next.length > 500 ? next.slice(-500) : next }
        }
        case 'APPEND_PB_LOG': {
            const next = [...state.pbLogs, action.log]
            return { ...state, pbLogs: next.length > 500 ? next.slice(-500) : next }
        }
        case 'CLEAR_PB_LOGS':
            return { ...state, pbLogs: [] }
        case 'SET_BUSY':
            return { ...state, busy: action.busy }
        case 'START_RUN':
            return {
                ...state,
                sseLogs: [],
                pbLogs: [],
                runState: { status: 'starting', tests: action.selected, checkpoints: [], logs: [] },
                busy: true,
            }
        case 'RUN_START_FAIL':
            return {
                ...state,
                runState: { ...state.runState, status: 'error', error: action.error },
                busy: false,
            }
        case 'DISMISS_RUN_ERROR':
            return { ...state, runState: { ...state.runState, error: undefined } }
        default:
            return state
    }
}

export default function TestRunTab({ ip }: Props) {
    const [state, dispatch] = useReducer(runTabReducer, initialRunTabState)
    const { selected, runState, sseLogs, pbLogs, busy } = state
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const statusControllerRef = useRef<AbortController | null>(null)
    const statusGenerationRef = useRef(0)
    const esRef = useRef<EventSource | null>(null)
    const activeRunIdRef = useRef<string | null>(runState.run_id ?? null)
    const externalRunRef = useRef(false)
    const sseHealthyRef = useRef(false)
    const [sseHealthy, setSseHealthy] = useState(false)
    const [abortPending, setAbortPending] = useState(false)
    const [abortError, setAbortError] = useState<string | null>(null)

    const isRunning = runState.status === 'running'
    const isStarting = runState.status === 'starting'
    const isActive = isRunning || isStarting || busy
    const progress = runState.progress
        ? (runState.progress.completed / Math.max(runState.progress.total, 1)) * 100
        : 0
    // Display only the unique selected tests (backend may report per-module instances).
    const displayTests = (() => {
        const serverTests = runState.tests
        if (!serverTests || serverTests.length === 0) return selected
        // Deduplicate while preserving order.
        return [...new Set(serverTests)]
    })()
    const showProgress = runState.status !== 'idle' && displayTests.length > 0

    useEffect(() => {
        activeRunIdRef.current = runState.run_id ?? null
        externalRunRef.current = !!runState.source && runState.source !== 'web'
    }, [runState.run_id, runState.source])

    const fetchStatus = useCallback(async () => {
        const generation = ++statusGenerationRef.current
        statusControllerRef.current?.abort()
        const controller = new AbortController()
        statusControllerRef.current = controller
        try {
            const r = await fetch('/test-run/status', { signal: controller.signal })
            if (!r.ok) return
            const d = normalizeRunState(await r.json())
            if (generation !== statusGenerationRef.current) return
            if (d.status === 'idle' && externalRunRef.current) return
            dispatch({ type: 'SET_RUN_STATE', state: d })
            if (d.status !== 'running' && d.status !== 'starting') {
                dispatch({ type: 'SET_BUSY', busy: false })
            }
        } catch { /* backend may be restarting */ }
    }, [])

    const fetchRunDetail = useCallback(async (runId: string) => {
        try {
            const r = await fetch(`/test-run/${encodeURIComponent(runId)}`)
            if (!r.ok) return
            const d = normalizeRunState(await r.json())
            dispatch({ type: 'SET_RUN_STATE', state: d })
            const status = d.status
            if (status !== 'running' && status !== 'starting') {
                dispatch({ type: 'SET_BUSY', busy: false })
            }
        } catch { /* external run may be briefly unavailable */ }
    }, [])

    // Always poll — even when idle — so externally-started runs are detected
    // automatically.  Switch to the faster interval as soon as a run is active.
    useEffect(() => {
        const interval = isActive ? POLL_MS : POLL_IDLE_MS
        let stopped = false
        const poll = async () => {
            await fetchStatus()
            if (!stopped) timerRef.current = setTimeout(poll, interval)
        }
        void poll()
        return () => {
            stopped = true
            statusControllerRef.current?.abort()
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
        }
    }, [isActive, fetchStatus])

    // ── Clear PB logs when a new run starts (run_id changes) ────────────
    useEffect(() => {
        dispatch({ type: 'CLEAR_PB_LOGS' })
    }, [runState.run_id])

    // ── PocketBase realtime: instant run detection + log streaming ───────
    // The SSE log guard: only forward PB logs while no SSE stream is active
    // (avoids duplicates when both are streaming the same run).
    // PocketBase is the fallback until the local SSE connection is healthy.

    usePocketBaseRealtime({
        activeRunId: runState.run_id ?? null,
        onRunStarted: useCallback((runId, source) => {
            // A run was started externally — refresh immediately to get run_id
            // and switch to active polling speed.
            activeRunIdRef.current = runId
            externalRunRef.current = source !== 'web'
            dispatch({ type: 'SET_RUN_STATE', state: {
                run_id: runId, source, status: 'running', tests: [], logs: [], checkpoints: [], results: [],
            } })
            void fetchRunDetail(runId)
        }, [fetchRunDetail]),
        onRunCompleted: useCallback((runId) => {
            // Run finished externally — fetch final results.
            if (activeRunIdRef.current === runId) void fetchRunDetail(runId)
        }, [fetchRunDetail]),
        onLog: useCallback((entry, runId) => {
            // Only use PB logs as fallback when the SSE stream isn't active yet
            if (activeRunIdRef.current === runId && !sseHealthyRef.current) {
                dispatch({ type: 'APPEND_PB_LOG', log: entry })
            }
        }, []),
    })

    // ── SSE: open a log stream as soon as we have a run_id ──────────────
    useEffect(() => {
        const runId = runState.run_id
        if (!runId || externalRunRef.current) {
            sseHealthyRef.current = false
            setSseHealthy(false)
            return
        }
        dispatch({ type: 'SET_SSE_LOGS', logs: [] })   // clear previous run logs
        const es = new EventSource(`/test-run/${runId}/stream`)
        esRef.current = es
        es.onopen = () => {
            sseHealthyRef.current = true
            setSseHealthy(true)
        }
        es.onmessage = (e) => {
            if (e.origin !== window.location.origin) return
            try {
                const entry = JSON.parse(e.data) as LogEntry & { type?: string }
                if (entry.type === 'done') { es.close(); esRef.current = null; return }
                if (entry.level) {
                    dispatch({ type: 'APPEND_SSE_LOG', log: entry as LogEntry })
                }
            } catch { /* ignore malformed frames */ }
        }
        es.onerror = () => {
            sseHealthyRef.current = false
            setSseHealthy(false)
            es.close(); esRef.current = null
        }
        return () => {
            sseHealthyRef.current = false
            setSseHealthy(false)
            es.close(); esRef.current = null
        }
    }, [runState.run_id])

    // Log priority: SSE stream (richest, real-time) → PocketBase realtime
    // (external runs before SSE opens) → polling snapshot (last resort).
    const displayLogs = sseHealthy && sseLogs.length > 0
        ? sseLogs
        : pbLogs.length > 0 ? pbLogs : (runState.logs ?? [])

    async function doStart() {
        if (selected.length === 0) return
        setAbortPending(false)
        if (esRef.current) { esRef.current.close(); esRef.current = null }
        dispatch({ type: 'START_RUN', selected })

        try {
            const r = await fetch('/test-run/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip_address: ip,
                    config_path: CONFIG_PATH,
                    tests: selected,
                    source: 'web',
                }),
            })
            if (!r.ok) {
                const err = await r.json()
                dispatch({ type: 'RUN_START_FAIL', error: err.detail ?? 'Failed to start' })
                return
            }
            await fetchStatus()
        } catch (e) {
            dispatch({ type: 'RUN_START_FAIL', error: (e as Error).message })
        }
    }

    function toggleTest(id: string) {
        const nextSelected = selected.includes(id) ? selected.filter(t => t !== id) : [...selected, id]
        dispatch({ type: 'SET_SELECTED', selected: nextSelected })
    }

    async function doAbort() {
        if (!isActive || abortPending) return
        setAbortError(null)
        setAbortPending(true)
        try {
            const response = await fetch('/test-run/abort', { method: 'POST' })
            if (!response.ok) {
                let message = 'Failed to abort the test run.'
                try {
                    const payload = await response.json() as { detail?: string }
                    if (payload.detail) message = payload.detail
                } catch { /* response did not contain JSON */ }
                setAbortPending(false)
                setAbortError(message)
                return
            }
            // Keep the button in its pending state until polling observes that
            // the worker has stopped. The backend checks the abort flag at a
            // safe boundary between hardware test operations.
            await fetchStatus()
        } catch (error) {
            setAbortPending(false)
            setAbortError(error instanceof Error ? error.message : 'Failed to abort the test run.')
        }
    }

    return (
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'stretch', flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* ── Left column: selection + progress + results ── */}
            <Stack spacing={2} sx={{ flex: '0 0 auto', width: 440, overflowY: 'auto', maxHeight: '100%', pr: 1 }}>
                <TestSelection
                    availableTests={AVAILABLE_TESTS}
                    selected={selected}
                    isRunning={isRunning}
                    isStarting={isStarting}
                    busy={busy}
                    canAbort={isActive}
                    isAborting={abortPending}
                    runSource={runState.source}
                    onToggleTest={toggleTest}
                    onStart={doStart}
                    onAbort={doAbort}
                />

                {/* ── Error ── */}
                {runState.status === 'error' && runState.error && (
                    <Alert severity="error" onClose={() => dispatch({ type: 'DISMISS_RUN_ERROR' })}>
                        {runState.error}
                    </Alert>
                )}
                {abortError && (
                    <Alert severity="error" onClose={() => setAbortError(null)}>
                        {abortError}
                    </Alert>
                )}

                {/* ── Starting spinner ── */}
                {isStarting && (
                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                        <CircularProgress size={24} sx={{ mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            Initialising test run…
                        </Typography>
                    </Paper>
                )}

                {/* ── Progress ── */}
                {showProgress && (
                    <TestProgress
                        status={runState.status}
                        progress={progress}
                        progressDetail={runState.progress}
                        tests={displayTests}
                        checkpoints={runState.checkpoints ?? []}
                        results={runState.results}
                        logs={displayLogs}
                        onRefresh={fetchStatus}
                    />
                )}

                {/* ── Results ── */}
                {(runState.status === 'completed' || runState.status === 'error' || isRunning) && runState.results && runState.results.length > 0 && (
                    <TestResults
                        status={runState.status}
                        results={runState.results}
                        currentModule={runState.progress?.current_module ?? null}
                    />
                )}

                {runState.status === 'idle' && !busy && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        Select tests and click <strong>Start Test Run</strong>.
                    </Typography>
                )}
            </Stack>

            {/* ── Right column: live log ── */}
            <TestLiveLog
                displayLogs={displayLogs}
                sseLogsActive={sseHealthy && sseLogs.length > 0}
                hasLogs={!!runState.logs && runState.logs.length > 0}
            />

        </Box>
    )
}
