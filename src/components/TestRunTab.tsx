/**
 * TestRunTab – start, monitor, and view results of automated CPX-AP tests.
 *
 * Polls /test-run/status continuously (idle: 5 s, active: 2 s) so any run
 * started from the UI, CI, or another external API client appears live.
 * PocketBase realtime provides instant push-notification when a new run
 * starts externally and streams log entries for external runs.
 */
import { useReducer, useEffect, useRef, useCallback } from 'react'
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

export interface TestRunState {
    run_id?: string
    status: 'idle' | 'starting' | 'running' | 'completed' | 'error'
    source?: string
    ip_address?: string
    tests?: string[]
    progress?: { completed: number; total: number; current_test: string | null; current_module: string | null }
    results?: Array<{ test_id?: string; passed?: boolean; error?: string; duration_ms?: number;[k: string]: unknown }>
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

function runTabReducer(state: RunTabState, action: RunTabAction): RunTabState {
    switch (action.type) {
        case 'SET_SELECTED':
            return { ...state, selected: action.selected }
        case 'SET_RUN_STATE':
            return { ...state, runState: action.state }
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
        default:
            return state
    }
}

export default function TestRunTab({ ip }: Props) {
    const [state, dispatch] = useReducer(runTabReducer, initialRunTabState)
    const { selected, runState, sseLogs, pbLogs, busy } = state
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const esRef = useRef<EventSource | null>(null)

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

    const fetchStatus = useCallback(async () => {
        try {
            const r = await fetch('/test-run/status')
            if (!r.ok) return
            const d: TestRunState = await r.json()
            dispatch({ type: 'SET_RUN_STATE', state: d })
            if (d.status !== 'running' && d.status !== 'starting') {
                dispatch({ type: 'SET_BUSY', busy: false })
            }
        } catch { /* backend may be restarting */ }
    }, [])

    // Always poll — even when idle — so externally-started runs are detected
    // automatically.  Switch to the faster interval as soon as a run is active.
    useEffect(() => {
        const interval = isActive ? POLL_MS : POLL_IDLE_MS
        timerRef.current = setInterval(fetchStatus, interval)
        return () => {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        }
    }, [isActive, fetchStatus])

    useEffect(() => { fetchStatus() }, [fetchStatus])

    // ── Clear PB logs when a new run starts (run_id changes) ────────────
    useEffect(() => {
        dispatch({ type: 'CLEAR_PB_LOGS' })
    }, [runState.run_id])

    // ── PocketBase realtime: instant run detection + log streaming ───────
    // The SSE log guard: only forward PB logs while no SSE stream is active
    // (avoids duplicates when both are streaming the same run).
    const sseActiveRef = useRef(false)
    useEffect(() => { sseActiveRef.current = sseLogs.length > 0 }, [sseLogs.length])

    usePocketBaseRealtime({
        activeRunId: runState.run_id ?? null,
        onRunStarted: useCallback(() => {
            // A run was started externally — refresh immediately to get run_id
            // and switch to active polling speed.
            fetchStatus()
        }, [fetchStatus]),
        onRunCompleted: useCallback(() => {
            // Run finished externally — fetch final results.
            fetchStatus()
        }, [fetchStatus]),
        onLog: useCallback((entry) => {
            // Only use PB logs as fallback when the SSE stream isn't active yet
            if (!sseActiveRef.current) {
                dispatch({ type: 'APPEND_PB_LOG', log: entry })
            }
        }, []),
    })

    // ── SSE: open a log stream as soon as we have a run_id ──────────────
    useEffect(() => {
        const runId = runState.run_id
        if (!runId) return
        dispatch({ type: 'SET_SSE_LOGS', logs: [] })   // clear previous run logs
        const es = new EventSource(`/test-run/${runId}/stream`)
        esRef.current = es
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
        es.onerror = () => { es.close(); esRef.current = null }
        return () => { es.close(); esRef.current = null }
    }, [runState.run_id])

    // Log priority: SSE stream (richest, real-time) → PocketBase realtime
    // (external runs before SSE opens) → polling snapshot (last resort).
    const displayLogs = sseLogs.length > 0 ? sseLogs : pbLogs.length > 0 ? pbLogs : (runState.logs ?? [])

    async function doStart() {
        if (selected.length === 0) return
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
        try {
            await fetch('/test-run/abort', { method: 'POST' })
        } catch { /* ignore */ }
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
                    runSource={runState.source}
                    onToggleTest={toggleTest}
                    onStart={doStart}
                    onAbort={doAbort}
                />

                {/* ── Error ── */}
                {runState.status === 'error' && runState.error && (
                    <Alert severity="error" onClose={() => dispatch({ type: 'SET_RUN_STATE', state: { status: 'idle' } })}>
                        {runState.error}
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
                {(isRunning || runState.status === 'completed') && (
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
                {(runState.status === 'completed' || isRunning) && runState.results && runState.results.length > 0 && (
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
                sseLogsActive={sseLogs.length > 0}
                hasLogs={!!runState.logs && runState.logs.length > 0}
            />

        </Box>
    )
}
