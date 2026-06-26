/**
 * TestRunTab – start, monitor, and view results of automated CPX-AP tests.
 *
 * Polls /test-run/status every second during an active run so progress
 * updates appear live, regardless of whether the run was started from the
 * web UI or CI.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
    Box, Button, Stack, Typography, Checkbox, FormControlLabel,
    LinearProgress, Chip, Alert, Paper, CircularProgress,
    Tooltip, IconButton,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RefreshIcon from '@mui/icons-material/Refresh'

const POLL_MS = 800

const TOPO_PATH = 'topology.jsonc'
const CONN_PATH = 'connections.jsonc'

interface Checkpoint {
    test: string
    status: 'running' | 'passed' | 'failed'
    timestamp: number
    error?: string
}

interface LogEntry {
    level: string
    message: string
    timestamp: string
}

interface TestRunState {
    run_id?: string
    status: 'idle' | 'starting' | 'running' | 'completed' | 'error'
    source?: string
    ip_address?: string
    tests?: string[]
    progress?: { completed: number; total: number; current_test: string | null }
    results?: Array<{ test_id?: string; passed?: boolean; error?: string;[k: string]: unknown }>
    checkpoints?: Checkpoint[]
    logs?: LogEntry[]
    error?: string
}

const AVAILABLE_TESTS = [
    { id: 'validate-connections', label: 'Connection Validation' },
    { id: 'compare-topology', label: 'Topology Comparison' },
    { id: 'condition-counter', label: 'Condition Counter' },
    { id: 'valve-condition-counter', label: 'Valve CC (VABX)' },
    { id: 'remanent-params', label: 'Remanent Parameters' },
]

interface Props {
    ip: string
}

export default function TestRunTab({ ip }: Props) {
    const [selected, setSelected] = useState<string[]>(['validate-connections', 'compare-topology'])
    const [runState, setRunState] = useState<TestRunState>({ status: 'idle' })
    const [sseLogs, setSseLogs] = useState<LogEntry[]>([])
    const [busy, setBusy] = useState(false)
    const logsEndRef = useRef<HTMLDivElement>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const esRef = useRef<EventSource | null>(null)

    const isRunning = runState.status === 'running'
    const isStarting = runState.status === 'starting'
    const progress = runState.progress
        ? (runState.progress.completed / Math.max(runState.progress.total, 1)) * 100
        : 0

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

    // Auto-scroll logs
    useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [displayLogs])

    async function doStart() {
        if (selected.length === 0) return
        // Clear previous state
        setSseLogs([])
        if (esRef.current) { esRef.current.close(); esRef.current = null }
        setRunState({ status: 'starting', tests: selected, checkpoints: [], logs: [] })
        setBusy(true)
        try {
            const r = await fetch('/test-run/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip_address: ip,
                    connections_path: CONN_PATH,
                    topology_path: TOPO_PATH,
                    tests: selected,
                    source: 'web',
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

    const cpMap = new Map((runState.checkpoints ?? []).map(c => [c.test, c]))

    return (
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start', height: '100%', overflow: 'auto' }}>

            {/* ── Left column: selection + progress + results ── */}
            <Stack spacing={2} sx={{ flex: '0 0 auto', width: 440 }}>
                {/* ── Test selection ── */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Select Tests
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                        {AVAILABLE_TESTS.map(t => (
                            <FormControlLabel
                                key={t.id}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={selected.includes(t.id)}
                                        onChange={() => toggleTest(t.id)}
                                        disabled={isRunning || isStarting}
                                    />
                                }
                                label={<Typography variant="caption">{t.label}</Typography>}
                                sx={{ mr: 1 }}
                            />
                        ))}
                    </Stack>
                    <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={isStarting || busy ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                            onClick={doStart}
                            disabled={isRunning || isStarting || busy || selected.length === 0}
                            size="small"
                        >
                            {isStarting ? 'Starting…' : isRunning ? 'Running…' : busy ? 'Waiting…' : 'Start Test Run'}
                        </Button>
                        {runState.source && runState.source !== 'web' && (
                            <Chip label={`By: ${runState.source}`} size="small" color="info" />
                        )}
                        {isStarting && (
                            <Typography variant="caption" color="text.secondary">
                                Connecting to device…
                            </Typography>
                        )}
                    </Stack>
                </Paper>

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
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }} spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {isRunning ? 'Running…' : 'Completed'}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title="Refresh">
                                <IconButton size="small" onClick={fetchStatus}>
                                    <RefreshIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <LinearProgress
                            variant={isRunning ? 'indeterminate' : 'determinate'}
                            value={progress}
                            sx={{ mb: 2, height: 6, borderRadius: 3 }}
                            color={runState.status === 'completed' ? 'success' : 'primary'}
                        />

                        {runState.progress && (
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                {runState.progress.completed} / {runState.progress.total} tests
                                {runState.progress.current_test && (
                                    <> · Current: <strong>{runState.progress.current_test}</strong></>
                                )}
                            </Typography>
                        )}

                        {/* Per-test status */}
                        <Stack spacing={0.5}>
                            {(runState.tests ?? selected).map(testId => {
                                const cp = cpMap.get(testId)
                                const status = cp?.status ?? 'pending'
                                const color =
                                    status === 'passed' ? 'success' :
                                        status === 'failed' ? 'error' :
                                            status === 'running' ? 'info' : 'default'
                                return (
                                    <Stack key={testId} direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                                        <Chip label={testId} size="small" color={color}
                                            variant={status === 'pending' ? 'outlined' : 'filled'}
                                            sx={{ minWidth: 180, justifyContent: 'flex-start' }}
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            {status === 'passed' ? '✓' : status === 'failed' ? '✗' :
                                                status === 'running' ? '⏳' : '○'}{' '}
                                            {status}
                                        </Typography>
                                        {cp?.error && (
                                            <Typography variant="caption" color="error" sx={{ flex: 1 }}>
                                                {cp.error}
                                            </Typography>
                                        )}
                                    </Stack>
                                )
                            })}
                        </Stack>
                    </Paper>
                )}

                {/* ── Results ── */}
                {runState.status === 'completed' && runState.results && runState.results.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 1.5, overflow: 'auto', maxHeight: 400 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                            Detailed Results
                        </Typography>
                        <pre style={{ margin: 0, fontSize: '0.72rem', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(runState.results, null, 2)}
                        </pre>
                    </Paper>
                )}

                {runState.status === 'idle' && !busy && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        Select tests and click <strong>Start Test Run</strong>.
                    </Typography>
                )}
            </Stack>

            {/* ── Right column: live log ── */}
            <Box sx={{ flex: 1, minWidth: 0, position: 'sticky', top: 0 }}>
                <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }} spacing={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                            Live Log
                        </Typography>
                        {runState.logs && runState.logs.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                {displayLogs.length} entries{sseLogs.length > 0 ? ' (live)' : ''}
                            </Typography>
                        )}
                    </Stack>
                    <Box sx={{
                        height: 'calc(100vh - 220px)',
                        overflow: 'auto',
                        background: '#1e1e1e', color: '#d4d4d4',
                        borderRadius: 1, p: 1, fontFamily: 'monospace',
                        fontSize: '0.75rem', lineHeight: 1.6,
                    }}>
                        {displayLogs.length === 0 && (
                            <Box sx={{ color: '#555', fontStyle: 'italic', mt: 1 }}>
                                No log entries yet. Start a test run to see output here.
                            </Box>
                        )}
                        {displayLogs.map((entry, i) => (
                            <div key={i} style={{
                                color: entry.level === 'error' ? '#f44747' :
                                    entry.level === 'warning' ? '#cca700' : '#d4d4d4',
                            }}>
                                <span style={{ color: '#608b4e', userSelect: 'none' }}>
                                    [{entry.timestamp?.slice(11, 19) ?? '--:--:--'}]
                                </span>{' '}
                                {entry.message}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </Box>
                </Paper>
            </Box>

        </Box>
    )
}
