/**
 * HistoryTab – browse past test runs stored in PocketBase.
 *
 * Shows a list of runs with pass/fail summary, and clicking a row opens
 * a detail drawer with per-test results and checkpoint logs.
 */
import { useState, useEffect, useCallback } from 'react'
import {
    Box, Stack, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, IconButton,
    Drawer, Divider, LinearProgress, CircularProgress,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'

interface RunRecord {
    id: string
    run_id: string
    source: string
    ip_address: string
    status: string
    tests: string   // JSON string
    results: string // JSON string
    started_at: string
    completed_at: string
    created: string
    checkpoints?: Array<{
        test: string
        status: string
        error: string
        timestamp: string
    }>
}

export default function HistoryTab() {
    const [runs, setRuns] = useState<RunRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null)

    const fetchHistory = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch('/test-run/history?limit=100')
            if (r.ok) setRuns(await r.json())
        } catch {
            // PocketBase may not be running
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    async function openDetail(run: RunRecord) {
        try {
            const r = await fetch(`/test-run/${run.run_id}`)
            if (r.ok) {
                setSelectedRun(await r.json())
            } else {
                setSelectedRun(run)
            }
        } catch {
            setSelectedRun(run)
        }
    }

    function parseTests(raw: string): string[] {
        try { return JSON.parse(raw) } catch { return [] }
    }

    function parseResults(raw: string): Array<{ test_id?: string; passed?: boolean; error?: string }> {
        try { return JSON.parse(raw) } catch { return [] }
    }

    function formatTime(iso: string): string {
        if (!iso) return '-'
        try {
            return new Date(iso).toLocaleString()
        } catch {
            return iso
        }
    }

    function statusChipColor(s: string) {
        return s === 'completed' ? 'success' : s === 'error' ? 'error' : s === 'running' ? 'info' : 'default'
    }

    return (
        <Stack spacing={2} sx={{ p: 2 }}>
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                    Test Run History
                </Typography>
                <IconButton onClick={fetchHistory} disabled={loading}>
                    {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
            </Stack>

            {runs.length === 0 && !loading && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No test runs found. Make sure PocketBase is running at localhost:8090.
                </Typography>
            )}

            {runs.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Run ID</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Tests</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Started</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Completed</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {runs.map(run => {
                                const tests = parseTests(run.tests)
                                const results = parseResults(run.results)
                                const passed = results.filter(r => r.passed).length
                                return (
                                    <TableRow
                                        key={run.id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => openDetail(run)}
                                    >
                                        <TableCell>
                                            <Typography variant="caption" fontFamily="monospace">
                                                {run.run_id}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={run.source || 'unknown'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={run.status}
                                                size="small"
                                                color={statusChipColor(run.status)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption">
                                                {passed}/{tests.length} passed
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption">
                                                {formatTime(run.started_at)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption">
                                                {formatTime(run.completed_at)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* ── Detail Drawer ── */}
            <Drawer
                anchor="right"
                open={!!selectedRun}
                onClose={() => setSelectedRun(null)}
                PaperProps={{ sx: { width: 480, p: 2 } }}
            >
                {selectedRun && (
                    <Stack spacing={2}>
                        <Stack direction="row" sx={{ alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
                                {selectedRun.run_id}
                            </Typography>
                            <IconButton onClick={() => setSelectedRun(null)} size="small">
                                <CloseIcon />
                            </IconButton>
                        </Stack>

                        <Stack direction="row" spacing={2}>
                            <Chip label={`Source: ${selectedRun.source}`} size="small" variant="outlined" />
                            <Chip
                                label={selectedRun.status}
                                size="small"
                                color={statusChipColor(selectedRun.status)}
                            />
                        </Stack>

                        <Typography variant="caption" color="text.secondary">
                            IP: {selectedRun.ip_address} ·
                            Started: {formatTime(selectedRun.started_at)} ·
                            Completed: {formatTime(selectedRun.completed_at)}
                        </Typography>

                        <Divider />

                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Tests ({parseTests(selectedRun.tests).length})
                        </Typography>
                        {parseTests(selectedRun.tests).map(testId => {
                            const cp = (selectedRun.checkpoints ?? []).find(c => c.test === testId)
                            const color =
                                cp?.status === 'passed' ? 'success' :
                                cp?.status === 'failed' ? 'error' :
                                cp?.status === 'running' ? 'info' : 'default'
                            return (
                                <Stack key={testId} direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                                    <Chip label={testId} size="small" color={color} />
                                    {cp?.error && (
                                        <Typography variant="caption" color="error">
                                            {cp.error}
                                        </Typography>
                                    )}
                                </Stack>
                            )
                        })}

                        <Divider />

                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Raw Results
                        </Typography>
                        <Box sx={{
                            background: '#f5f5f5', borderRadius: 1, p: 1.5,
                            maxHeight: 300, overflow: 'auto', fontSize: '0.7rem',
                            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                        }}>
                            {(() => {
                                try { return JSON.stringify(JSON.parse(selectedRun.results), null, 2) }
                                catch { return selectedRun.results }
                            })()}
                        </Box>
                    </Stack>
                )}
            </Drawer>
        </Stack>
    )
}
