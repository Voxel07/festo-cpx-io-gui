import { Box, Paper, Stack, Typography, IconButton, Tooltip, LinearProgress, Chip } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { Checkpoint } from './TestRunTab'

const TERMINAL_STATUSES = new Set<Checkpoint['status']>(['passed', 'failed', 'skipped'])

interface TestProgressProps {
    status: 'idle' | 'starting' | 'running' | 'completed' | 'error'
    progress: number
    progressDetail?: { completed: number; total: number; current_test: string | null; current_module: string | null }
    tests: string[]
    checkpoints: Checkpoint[]
    results?: Array<{ test_id?: string; passed?: boolean; error?: string; duration_ms?: number;[k: string]: unknown }>
    onRefresh: () => void
}

export default function TestProgress({
    status,
    progress: _progress,
    progressDetail,
    tests,
    checkpoints,
    results = [],
    onRefresh,
}: TestProgressProps) {
    const cpMap = new Map(checkpoints.map(c => [c.test, c]))

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

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }} spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {status === 'running' ? 'Running…' : 'Completed'}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Refresh">
                    <IconButton size="small" onClick={onRefresh}>
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <LinearProgress
                variant={status === 'running' ? 'indeterminate' : 'determinate'}
                value={testProgress}
                sx={{ mb: 2, height: 6, borderRadius: 3 }}
                color={status === 'completed' ? 'success' : 'primary'}
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

                    const matchResult = results.find(r => r.test_id === testId)
                    const testDur = matchResult?.duration_ms

                    return (
                        <Stack key={testId} direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                            <Chip
                                label={testId}
                                size="small"
                                color={color}
                                variant={cStatus === 'pending' ? 'outlined' : 'filled'}
                                sx={{ minWidth: 180, justifyContent: 'flex-start' }}
                            />
                            <Typography variant="caption" color={cStatus === 'skipped' ? 'warning.main' : 'text.secondary'}>
                                {cStatus === 'passed' ? '✓' : cStatus === 'failed' ? '✗' :
                                    cStatus === 'skipped' ? '⚠' :
                                        cStatus === 'running' ? '⏳' : '○'}{' '}
                                {cStatus}
                            </Typography>
                            {testDur !== undefined && testDur !== null && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                    {testDur}ms
                                </Typography>
                            )}
                        </Stack>
                    )
                })}
            </Stack>
        </Paper>
    )
}
