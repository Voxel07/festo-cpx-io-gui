import {
    Paper, Typography, TableContainer, Table, TableHead,
    TableRow, TableCell, TableBody, Chip, Stack
} from '@mui/material'
import TerminalIcon from '@mui/icons-material/Terminal'
import MonitorIcon from '@mui/icons-material/Monitor'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { DashboardData } from './types'

function fmtDate(iso: string): string {
    if (!iso) return '—'
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
    } catch {
        return iso.slice(0, 16)
    }
}

export function RecentRunsTable({ data }: { data: DashboardData | null }) {
    return (
        <Paper elevation={1} sx={{ p: 2, mb: 2, width: '100%', overflow: 'hidden' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Test Runs
            </Typography>
            <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Run ID</TableCell>
                            <TableCell>Source</TableCell>
                            <TableCell>IP</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Tests</TableCell>
                            <TableCell align="right">Pass / Fail</TableCell>
                            <TableCell>Started</TableCell>
                            <TableCell>Branch / Pipeline</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data?.recent_runs?.length ? data.recent_runs.map(run => (
                            <TableRow key={run.run_id} hover>
                                <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                                        {run.run_id}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        icon={run.source === 'ci' ? <TerminalIcon sx={{ fontSize: 14 }} /> : <MonitorIcon sx={{ fontSize: 14 }} />}
                                        label={run.source === 'ci' ? 'CI' : 'Web'}
                                        color={run.source === 'ci' ? 'secondary' : 'primary'}
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>{run.ip_address}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={run.status}
                                        color={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : run.status === 'running' ? 'info' : 'default'}
                                        icon={run.status === 'completed' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : undefined}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="caption">{run.test_count}</Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                        <Chip size="small" label={run.passed} color="success" variant="outlined" />
                                        {run.failed > 0 && (
                                            <Chip size="small" label={run.failed} color="error" variant="outlined" />
                                        )}
                                    </Stack>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption">{fmtDate(run.started_at)}</Typography>
                                </TableCell>
                                <TableCell>
                                    {run.branch && (
                                        <Chip size="small" label={run.branch} variant="outlined" sx={{ mr: 0.5 }} />
                                    )}
                                    {run.pipeline_id && (
                                        <Chip size="small" label={`#${run.pipeline_id}`} variant="outlined" color="secondary" />
                                    )}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Typography variant="caption" color="text.secondary">No runs recorded yet</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    )
}
