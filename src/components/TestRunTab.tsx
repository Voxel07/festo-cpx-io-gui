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
    status: 'running' | 'passed' | 'failed' | 'skipped'
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
    progress?: { completed: number; total: number; current_test: string | null; current_module: string | null }
    results?: Array<{ test_id?: string; passed?: boolean; error?: string; duration_ms?: number;[k: string]: unknown }>
    checkpoints?: Checkpoint[]
    logs?: LogEntry[]
    error?: string
}

const AVAILABLE_TESTS = [
    { id: 'validate-connections', label: 'Connection Validation' },
    { id: 'compare-topology', label: 'Topology Comparison' },
    { id: 'output-toggle', label: 'Output Toggle' },
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
    const logsContainerRef = useRef<HTMLDivElement>(null)  // scroll container for smart auto-scroll
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

    // Smart auto-scroll: only scroll to bottom when user is already near the bottom.
    // Prevents fighting user scroll when reading earlier log entries.
    useEffect(() => {
        const container = logsContainerRef.current
        if (!container) return
        const threshold = 60  // px from bottom — if user scrolled up more than this, don't auto-scroll
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        if (distFromBottom < threshold) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [displayLogs])

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
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'stretch', flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* ── Left column: selection + progress + results ── */}
            <Stack spacing={2} sx={{ flex: '0 0 auto', width: 440, overflowY: 'auto', maxHeight: '100%', pr: 1 }}>
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
                                            status === 'skipped' ? 'warning' :
                                                status === 'running' ? 'info' : 'default'
                                // Find matching result for duration
                                const matchResult = (runState.results ?? []).find(
                                    r => (r as Record<string, unknown>).test_id === testId
                                )
                                const testDur = (matchResult as Record<string, unknown> | undefined)?.duration_ms as number | undefined
                                return (
                                    <Stack key={testId} direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                                        <Chip label={testId} size="small" color={color}
                                            variant={status === 'pending' ? 'outlined' : 'filled'}
                                            sx={{ minWidth: 180, justifyContent: 'flex-start' }}
                                        />
                                        <Typography variant="caption" color={status === 'skipped' ? 'warning.main' : 'text.secondary'}>
                                            {status === 'passed' ? '✓' : status === 'failed' ? '✗' :
                                                status === 'skipped' ? '⚠' :
                                                    status === 'running' ? '⏳' : '○'}{' '}
                                            {status}
                                        </Typography>
                                        {testDur !== undefined && testDur !== null && (
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                {testDur}ms
                                            </Typography>
                                        )}
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
                {(runState.status === 'completed' || isRunning) && runState.results && runState.results.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 1.5, overflow: 'auto', maxHeight: 400 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                            {isRunning ? 'Live Results' : 'Detailed Results'}
                        </Typography>
                        {runState.results.map((r, ri) => {
                            const subResults = (r as Record<string, unknown>).results as Array<Record<string, unknown>> | undefined
                            const testId = String((r as Record<string, unknown>).test_id ?? `Test ${ri + 1}`)
                            const passed = (r as Record<string, unknown>).passed
                            const dur = (r as Record<string, unknown>).duration_ms as number | undefined
                            return (
                                <Box key={ri} sx={{ mb: 1, borderBottom: '1px solid #eee', pb: 1 }}>
                                    {/* Test header with duration */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 700, flex: 1 }}>
                                            {testId}
                                        </Typography>
                                        {dur !== undefined && dur !== null && (
                                            <Chip
                                                label={`${dur}ms`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '0.65rem', height: 20 }}
                                            />
                                        )}
                                        <span style={{
                                            fontWeight: 700, fontSize: '0.85rem',
                                            color: passed ? '#2e7d32' : passed === false ? '#d32f2f' : '#888',
                                        }}>
                                            {passed ? '✓' : passed === false ? '✗' : '○'}
                                        </span>
                                    </Box>
                                    {/* Sub-results (per-module breakdown) */}
                                    {subResults && Array.isArray(subResults) && subResults.length > 0 ? (
                                        <Box sx={{ pl: 1, mt: 0.25 }}>
                                            {subResults.map((sr, si) => {
                                                const srPassed = sr.passed as boolean | undefined
                                                const srErr = sr.error as string | undefined
                                                const channels = sr.channels as Array<Record<string, unknown>> | undefined
                                                return (
                                                    <Box key={si}>
                                                        <Typography variant="caption" sx={{ display: 'block', color: '#777', fontSize: '0.62rem' }}>
                                                            #{sr.address ?? '?'} {String(sr.module ?? sr.connection ?? '')}
                                                            {sr.passed_channels !== undefined ? ` · ${sr.passed_channels}/${sr.total_channels} ch` : ''}
                                                            {sr.duration_ms !== undefined ? ` · ${sr.duration_ms}ms` : ''}
                                                            {' '}<span style={{ color: srPassed ? '#2e7d32' : srPassed === false ? '#d32f2f' : '#888' }}>
                                                                {srPassed ? '✓' : srPassed === false ? '✗' : '○'}
                                                            </span>
                                                        </Typography>
                                                        {srErr && (
                                                            <Typography variant="caption" sx={{ display: 'block', color: '#d32f2f', fontSize: '0.6rem', pl: 1 }}>
                                                                {srErr}
                                                            </Typography>
                                                        )}
                                                        {/* Per-channel errors */}
                                                        {channels && channels.filter(c => !c.passed).map((c, ci) => (
                                                            <Typography key={ci} variant="caption" sx={{ display: 'block', color: '#d32f2f', fontSize: '0.58rem', pl: 2 }}>
                                                                ch {String(c.channel)}: {String(c.error ?? 'readback LOW')} · {c.duration_ms}ms
                                                            </Typography>
                                                        ))}
                                                    </Box>
                                                )
                                            })}
                                        </Box>
                                    ) : (
                                        /* Fallback for results without sub-structure (e.g. compare-topology) */
                                        <Typography variant="caption" sx={{ display: 'block', color: '#777', fontSize: '0.62rem', pl: 1 }}>
                                            {String((r as Record<string, unknown>).error ?? (passed ? 'no differences' : 'differences found'))}
                                        </Typography>
                                    )}
                                    {(r as Record<string, unknown>).error && (
                                        <Typography variant="caption" color="error" sx={{ display: 'block', fontSize: '0.62rem' }}>
                                            {String((r as Record<string, unknown>).error)}
                                        </Typography>
                                    )}
                                </Box>
                            )
                        })}
                    </Paper>
                )}

                {runState.status === 'idle' && !busy && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        Select tests and click <strong>Start Test Run</strong>.
                    </Typography>
                )}
            </Stack>

            {/* ── Right column: live log ── */}
            <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Paper variant="outlined" sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5, flexShrink: 0 }} spacing={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                            Live Log
                        </Typography>
                        {runState.logs && runState.logs.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                {displayLogs.length} entries{sseLogs.length > 0 ? ' (live)' : ''}
                            </Typography>
                        )}
                    </Stack>
                    <Box ref={logsContainerRef} sx={{
                        flex: 1,
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
