/**
 * HistoryTab – browse past test runs.
 *
 * Shows runs from PocketBase when available, falls back to the server's
 * in-memory history when PocketBase is not running.  Clicking a row opens
 * a detail drawer with per-test checkpoints, log output, and raw results.
 */
import { useState, useEffect, useCallback } from 'react'
import {
    Box, Stack, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, CircularProgress, TablePagination
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import { TooltipButton, TooltipIconButton } from './TooltipButton'
import HistoryDetailDrawer from './HistoryDetailDrawer'

interface LogEntry {
    level: string
    message: string
    timestamp: string
}

interface RunRecord {
    id: string
    run_id: string
    source: string
    ip_address: string
    status: string
    tests: string | string[]   // JSON string from PB, or array from in-memory
    results: string | unknown[] // JSON string from PB, or array from in-memory
    started_at: string
    completed_at: string
    created: string
    checkpoints?: Array<{
        test: string
        status: string
        error?: string
        timestamp: string
    }>
    logs?: LogEntry[]
}

function parseTests(raw: string | string[] | null | undefined): string[] {
    if (raw == null) return []
    if (Array.isArray(raw)) return raw
    try { return JSON.parse(raw) ?? [] } catch { return [] }
}

function parseResults(raw: string | unknown[] | null | undefined): Array<{ test_id?: string; passed?: boolean; error?: string }> {
    if (raw == null) return []
    if (Array.isArray(raw)) return raw as Array<{ test_id?: string; passed?: boolean; error?: string }>
    try { return JSON.parse(raw as string) ?? [] } catch { return [] }
}

function formatTime(iso: string): string {
    if (!iso) return '-'
    try {
        return new Date(iso).toLocaleString()
    } catch {
        return iso
    }
}

function statusChipColor(s: string): "success" | "error" | "info" | "default" {
    return s === 'completed' ? 'success' : s === 'error' ? 'error' : s === 'running' ? 'info' : 'default'
}

export default function HistoryTab() {
    const [runs, setRuns] = useState<RunRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null)

    const [page, setPage] = useState(0)
    const [rowsPerPage, setRowsPerPage] = useState(10)

    async function fetchHistory() {
        setLoading(true)
        try {
            // Blocking fetch for the last 10 runs
            const r = await fetch('/test-run/history?limit=10')
            if (r.ok) {
                const initialRuns = await r.json()
                setRuns(initialRuns)
            }
            setLoading(false)

            // Background fetch for the rest if needed (up to 1000)
            fetch('/test-run/history?limit=1000')
                .then(res => res.ok ? res.json() : null)
                .then(allRuns => {
                    if (allRuns) setRuns(allRuns)
                })
                .catch(() => { })
        } catch {
            setLoading(false)
        }
    }

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage)
    }

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10))
        setPage(0)
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchHistory()
        }, 0)
        return () => clearTimeout(timer)
    }, [])

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

    return (
        <Stack spacing={2} sx={{ p: 2 }}>
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
                    Test Run History
                </Typography>
                {runs.length > 0 && (
                    <TooltipButton
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={async () => {
                            if (window.confirm("Are you sure you want to clear all test run history?")) {
                                try {
                                    const r = await fetch('/test-run', { method: 'DELETE' })
                                    if (r.ok) {
                                        fetchHistory()
                                        setSelectedRun(null)
                                    }
                                } catch (err) {
                                    alert(`Failed to delete: ${err}`)
                                }
                            }
                        }}
                        tooltip="Delete all test runs in the database"
                        icon={<DeleteIcon />}
                        sx={{ fontSize: '0.72rem', py: 0.3 }}
                    >
                        Delete All
                    </TooltipButton>
                )}
                <TooltipIconButton
                    onClick={fetchHistory}
                    disabled={loading}
                    tooltip="Refresh test run history"
                    icon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                />
            </Stack>

            {runs.length === 0 && !loading && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No test runs found. Runs appear here after you start one, or when PocketBase is running at localhost:8090.
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
                                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {runs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(run => {
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
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
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
                                        <TableCell align="right">
                                            <TooltipIconButton
                                                size="small"
                                                color="error"
                                                onClick={async (e) => {
                                                    e.stopPropagation()
                                                    if (window.confirm(`Delete test run ${run.run_id}?`)) {
                                                        try {
                                                            const r = await fetch(`/test-run/${run.run_id}`, { method: 'DELETE' })
                                                            if (r.ok) {
                                                                fetchHistory()
                                                                if (selectedRun?.run_id === run.run_id) {
                                                                    setSelectedRun(null)
                                                                }
                                                            }
                                                        } catch (err) {
                                                            alert(`Failed to delete: ${err}`)
                                                        }
                                                    }
                                                }}
                                                tooltip="Delete this test run"
                                                icon={<DeleteIcon fontSize="small" />}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={runs.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[10, 20, 50, 100]}
                        size="small"
                    />
                </TableContainer>
            )}

            <HistoryDetailDrawer
                selectedRun={selectedRun}
                onClose={() => setSelectedRun(null)}
                statusChipColor={statusChipColor}
                formatTime={formatTime}
                parseTests={parseTests}
            />
        </Stack>
    )
}
