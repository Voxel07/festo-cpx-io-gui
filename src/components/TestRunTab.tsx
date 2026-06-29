/**
 * TestRunTab – start, monitor, and view results of automated CPX-AP tests.
 *
 * Polls /test-run/status every second during an active run so progress
 * updates appear live, regardless of whether the run was started from the
 * web UI or CI.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Box, Stack, Typography, Alert, Paper, CircularProgress, TextField, Tooltip } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TestSelection from './TestSelection'
import TestProgress from './TestProgress'
import TestResults from './TestResults'
import TestLiveLog from './TestLiveLog'

const POLL_MS = 2000

const CONFIG_PATH = 'bench_config.json'

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
    { id: 'valve-toggle', label: 'Valve Toggle (VABX)' },
    { id: 'condition-counter', label: 'Condition Counter' },
    { id: 'valve-condition-counter', label: 'Valve CC (VABX)' },
    { id: 'remanent-params', label: 'Remanent Parameters' },
    { id: 'factory-reset', label: 'Factory Reset' },
    { id: 'open-load-diag', label: 'Open-Load Diagnostic' },
]

/** Tests that require a power supply comport to perform a real power cycle. */
const POWER_CYCLE_TESTS = new Set(['remanent-params', 'condition-counter', 'factory-reset'])

interface Props {
    ip: string
}

export default function TestRunTab({ ip }: Props) {
    const [selected, setSelected] = useState<string[]>(['connection-validation', 'compare-topology'])
    const [runState, setRunState] = useState<TestRunState>({ status: 'idle' })
    const [sseLogs, setSseLogs] = useState<LogEntry[]>([])
    const [busy, setBusy] = useState(false)
    const [psComport, setPsComport] = useState<string>('')
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const esRef = useRef<EventSource | null>(null)

    /** True when at least one selected test benefits from a power supply. */
    const needsPs = useMemo(
        () => selected.some(id => POWER_CYCLE_TESTS.has(id)),
        [selected],
    )

    const isRunning = runState.status === 'running'
    const isStarting = runState.status === 'starting'
    const progress = runState.progress
        ? (runState.progress.completed / Math.max(runState.progress.total, 1)) * 100
        : 0

    // Display only the unique selected tests (backend may report per-module instances).
    const displayTests = useMemo(() => {
        const serverTests = runState.tests
        if (!serverTests || serverTests.length === 0) return selected
        // Deduplicate while preserving order.
        return [...new Set(serverTests)]
    }, [runState.tests, selected])

    const fetchStatus = useCallback(async () => {
        try {
            const r = await fetch('/test-run/status')
            if (!r.ok) return
            const d: TestRunState = await r.json()
            setRunState(d)
            if (d.status !== 'running' && d.status !== 'starting') setBusy(false)
        } catch { /* backend may be restarting */ }
    }, [])

    useEffect(() => {
        if (isRunning || isStarting || busy) {
            timerRef.current = setInterval(fetchStatus, POLL_MS)
        }
        return () => {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        }
    }, [isRunning, isStarting, busy, fetchStatus])

    useEffect(() => { fetchStatus() }, [fetchStatus])

    // ── SSE: open a log stream as soon as we have a run_id ──────────────
    useEffect(() => {
        const runId = runState.run_id
        if (!runId) return
        setSseLogs([])   // clear previous run logs
        const es = new EventSource(`/test-run/${runId}/stream`)
        esRef.current = es
        es.onmessage = (e) => {
            try {
                const entry = JSON.parse(e.data) as LogEntry & { type?: string }
                if (entry.type === 'done') { es.close(); esRef.current = null; return }
                if (entry.level) setSseLogs(prev => [...prev, entry as LogEntry])
            } catch { /* ignore malformed frames */ }
        }
        es.onerror = () => { es.close(); esRef.current = null }
        return () => { es.close(); esRef.current = null }
    }, [runState.run_id])

    // Merge SSE logs with any logs that arrived via polling (dedup by timestamp+msg)
    const displayLogs = useMemo(() => {
        if (sseLogs.length > 0) return sseLogs
        return runState.logs ?? []
    }, [sseLogs, runState.logs])

    async function doStart() {
        if (selected.length === 0) return
        // Clear previous state
        setSseLogs([])
        if (esRef.current) { esRef.current.close(); esRef.current = null }
        setRunState({ status: 'starting', tests: selected, checkpoints: [], logs: [] })
        setBusy(true)

        // Build per-test parameter overrides: inject power_supply_comport where needed.
        const testParameters: Record<string, Record<string, unknown>> = {}
        if (psComport.trim()) {
            for (const id of selected) {
                if (POWER_CYCLE_TESTS.has(id)) {
                    testParameters[id] = { power_supply_comport: psComport.trim() }
                }
            }
        }

        try {
            const r = await fetch('/test-run/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip_address: ip,
                    config_path: CONFIG_PATH,
                    tests: selected,
                    source: 'web',
                    test_parameters: testParameters,
                }),
            })
            if (!r.ok) {
                const err = await r.json()
                setRunState(prev => ({ ...prev, status: 'error', error: err.detail ?? 'Failed to start' }))
                setBusy(false)
                return
            }
            await fetchStatus()
        } catch (e) {
            setRunState(prev => ({ ...prev, status: 'error', error: (e as Error).message }))
            setBusy(false)
        }
    }

    function toggleTest(id: string) {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id],
        )
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
                />

                {/* ── Power-supply comport (shown when a power-cycle test is selected) ── */}
                {needsPs && (
                    <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" fontWeight={600}>
                                Power Supply
                            </Typography>
                            <Tooltip title="Serial port of the HMP40x0 power supply used for power-cycle tests (e.g. COM3 or /dev/ttyUSB0). Leave empty to skip the power-cycle phase.">
                                <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', cursor: 'help' }} />
                            </Tooltip>
                        </Stack>
                        <TextField
                            size="small"
                            label="Comport (e.g. COM3)"
                            value={psComport}
                            onChange={e => setPsComport(e.target.value)}
                            disabled={isRunning || isStarting}
                            placeholder="COM3"
                            fullWidth
                            inputProps={{ spellCheck: false }}
                        />
                    </Paper>
                )}

                {/* ── Error ── */}
                {runState.status === 'error' && runState.error && (
                    <Alert severity="error" onClose={() => setRunState({ status: 'idle' })}>
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
