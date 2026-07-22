import { Box, Paper, Stack, Typography, IconButton, Tooltip, LinearProgress, Chip } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import type { Checkpoint } from './TestRunTab'

const TERMINAL_STATUSES = new Set<Checkpoint['status']>(['passed', 'failed', 'skipped'])

interface TestProgressProps {
    status: 'idle' | 'starting' | 'running' | 'completed' | 'error'
    progress: number
    progressDetail?: { completed: number; total: number; current_test: string | null; current_module: string | null }
    tests: string[]
    checkpoints: Checkpoint[]
    results?: Array<{ test_id?: string; passed?: boolean; error?: string; duration_ms?: number;[k: string]: unknown }>
    logs?: Array<{ level: string; message: string; timestamp: string }>
    onRefresh: () => void
}

export default function TestProgress({
    status,
    progress: _progress,
    progressDetail,
    tests,
    checkpoints,
    results = [],
    logs = [],
    onRefresh,
}: TestProgressProps) {
    const cpMap = new Map(checkpoints.map(c => [c.test, c]))
    // PocketBase and legacy API history can provide JSON strings or objects
    // at runtime even though the live API type is an array. Never let a
    // malformed final payload crash the whole test-run page.
    const safeResults = Array.isArray(results) ? results : []

    // Count unique tests that have reached a terminal status — not inflated
    // by per-module instances like progressDetail.total.
    let completedCount = 0
    for (const t of tests) {
        const cp = cpMap.get(t)
        if (cp && TERMINAL_STATUSES.has(cp.status)) completedCount++
    }

    // Test-level progress (not instance-inflated).
    const testProgress = tests.length > 0
        ? (completedCount / tests.length) * 100
        : 0
    const active = status === 'running' || status === 'starting'
    const statusLabel = status === 'starting'
        ? 'Starting…'
        : status === 'running'
            ? 'Running…'
            : status === 'error'
                ? 'Stopped with error'
                : 'Completed'

    return (
        <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflowY: 'auto', flexShrink: 1 }}>
            <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }} spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {statusLabel}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Refresh">
                    <IconButton size="small" onClick={onRefresh}>
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <LinearProgress
                variant={active ? 'indeterminate' : 'determinate'}
                value={testProgress}
                sx={{ mb: 2, height: 6, borderRadius: 3 }}
                color={status === 'completed' ? 'success' : status === 'error' ? 'error' : 'primary'}
            />

            {progressDetail && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    {completedCount} / {tests.length} test{tests.length !== 1 ? 's' : ''}
                    {progressDetail.current_test && (
                        <> · Current: <strong>{progressDetail.current_test}</strong></>
                    )}
                </Typography>
            )}

            <Stack spacing={0.5}>
                {tests.map(testId => {
                    const cp = cpMap.get(testId)
                    const cStatus = cp?.status ?? 'pending'
                    const color =
                        cStatus === 'passed' ? 'success' :
                            cStatus === 'failed' ? 'error' :
                                cStatus === 'skipped' ? 'warning' :
                                    cStatus === 'running' ? 'info' : 'default'

                    const matchResult = safeResults.find(r => r.test_id === testId)
                    const testDur = matchResult?.duration_ms

                    return (
                        <Box key={testId}>
                            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                                <Chip
                                    label={testId}
                                    size="small"
                                    color={color}
                                    variant={cStatus === 'pending' ? 'outlined' : 'filled'}
                                    sx={{ minWidth: 180, justifyContent: 'flex-start' }}
                                />
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} color={cStatus === 'skipped' ? 'warning.main' : 'text.secondary'}>
                                    {cStatus === 'passed' ? <CheckCircleIcon sx={{ fontSize: 14 }} color="success" /> :
                                        cStatus === 'failed' ? <CancelIcon sx={{ fontSize: 14 }} color="error" /> :
                                            cStatus === 'skipped' ? <WarningAmberIcon sx={{ fontSize: 14 }} color="warning" /> :
                                                cStatus === 'running' ? <HourglassBottomIcon sx={{ fontSize: 14 }} color="info" /> :
                                                    <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} color="disabled" />}
                                    {cStatus}
                                </Typography>
                                {testDur !== undefined && testDur !== null && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                        {testDur}ms
                                    </Typography>
                                )}
                            </Stack>

                            {/* Display expected outcomes if this is the open-load-diag test */}
                            {testId === 'open-load-diag' && logs.length > 0 && (
                                <OpenLoadDiagProgress logs={logs} />
                            )}
                        </Box>
                    )
                })}
            </Stack>
        </Paper>
    )
}

function OpenLoadDiagProgress({ logs }: { logs: Array<{ message: string }> }) {
    const modules = new Map<string, { addr: string, name: string, numChannels: number, expected: Set<number>, actual: number | 'none' | null }>();

    for (const l of logs) {
        if (l.message.startsWith('OPEN_LOAD_INIT|')) {
            const [, addr, name, numStr] = l.message.split('|')
            if (!modules.has(addr)) {
                modules.set(addr, { addr, name, numChannels: parseInt(numStr, 10), expected: new Set(), actual: null });
            }
        } else if (l.message.startsWith('OPEN_LOAD_EXPECTED|')) {
            const [, addr, chStr] = l.message.split('|')
            modules.get(addr)?.expected.add(parseInt(chStr, 10))
        } else if (l.message.startsWith('OPEN_LOAD_ACTUAL|')) {
            const [, addr, chStr] = l.message.split('|')
            const mod = modules.get(addr)
            if (mod) {
                mod.actual = chStr === 'none' ? 'none' : parseInt(chStr, 10)
            }
        }
    }

    if (modules.size === 0) return null;

    return (
        <Box sx={{ pl: 4, pt: 0.5, pb: 0.5 }}>
            {Array.from(modules.values()).map(mod => {
                const expectedList = Array.from(mod.expected).sort((a, b) => a - b);
                const unexpectedList = [];
                for (let i = 0; i < mod.numChannels; i++) {
                    if (!mod.expected.has(i)) unexpectedList.push(i);
                }

                return (
                    <Box key={mod.addr} sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>module {mod.addr} ({mod.name})</Typography>

                        {expectedList.length > 0 && (
                            <Box sx={{ ml: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>Expected diag</Typography>
                                {expectedList.map(ch => {
                                    let statusText = "waiting...";
                                    let color = "text.secondary";
                                    let icon = <HourglassBottomIcon sx={{ fontSize: 12, mr: 0.5 }} color="disabled" />;
                                    if (mod.actual !== null) {
                                        if (mod.actual === ch) {
                                            statusText = "got diag";
                                            color = "success.main";
                                            icon = <CheckCircleIcon sx={{ fontSize: 12, mr: 0.5 }} color="success" />;
                                        } else {
                                            statusText = "did not get";
                                            color = "error.main";
                                            icon = <CancelIcon sx={{ fontSize: 12, mr: 0.5 }} color="error" />;
                                        }
                                    }
                                    return (
                                        <Typography key={ch} variant="caption" color={color} sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                                            <span style={{ marginRight: 4 }}>- Channel {ch} →</span>
                                            {icon} {statusText}
                                        </Typography>
                                    )
                                })}
                            </Box>
                        )}

                        {unexpectedList.length > 0 && (
                            <Box sx={{ ml: 1, mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>No diag expected</Typography>
                                {unexpectedList.map(ch => {
                                    let statusText = "waiting...";
                                    let color = "text.secondary";
                                    let icon = <HourglassBottomIcon sx={{ fontSize: 12, mr: 0.5 }} color="disabled" />;
                                    if (mod.actual !== null) {
                                        if (mod.actual === ch) {
                                            statusText = "got diag";
                                            color = "error.main";
                                            icon = <CancelIcon sx={{ fontSize: 12, mr: 0.5 }} color="error" />;
                                        } else {
                                            statusText = "ok";
                                            color = "success.main";
                                            icon = <CheckCircleIcon sx={{ fontSize: 12, mr: 0.5 }} color="success" />;
                                        }
                                    }
                                    return (
                                        <Typography key={ch} variant="caption" color={color} sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                                            <span style={{ marginRight: 4 }}>- Channel {ch} →</span>
                                            {icon} {statusText}
                                        </Typography>
                                    )
                                })}
                            </Box>
                        )}
                    </Box>
                )
            })}
        </Box>
    )
}
