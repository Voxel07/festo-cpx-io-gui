/**
 * Dashboard – analytics overview for CPX-AP test automation.
 *
 * Shows aggregate metrics, success-rate trends, per-source breakdowns,
 * module statistics, and recent run activity.  Data is fetched from
 * the /dashboard API endpoint which aggregates PocketBase + in-memory history.
 */
import { useState, useEffect, useCallback } from 'react'
import {
    Box, Card, CardContent, Typography, Grid, Chip, Stack,
    CircularProgress, Alert, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, LinearProgress,
    IconButton, Tooltip,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StorageIcon from '@mui/icons-material/Storage'
import TerminalIcon from '@mui/icons-material/Terminal'
import MonitorIcon from '@mui/icons-material/Monitor'
import TimerIcon from '@mui/icons-material/Timer'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { DataGrid } from '@mui/x-data-grid'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'

/* ── Types ────────────────────────────────────────────────────────── */

interface DailyPoint {
    date: string
    total: number
    passed: number
    failed: number
    rate: number
}

interface TopModule {
    test_id: string
    count: number
    failures: number
}

interface RecentRun {
    run_id: string
    source: string
    ip_address: string
    status: string
    test_count: number
    passed: number
    failed: number
    started_at: string
    completed_at: string
    branch: string
    pipeline_id: string
}

interface DashboardData {
    summary: {
        total_runs: number
        completed_runs: number
        failed_runs: number
        running: number
        success_rate: number
        ci_runs: number
        web_runs: number
        ci_success_rate: number
        web_success_rate: number
        total_tests_run: number
        total_tests_passed: number
        overall_pass_rate: number
        avg_duration_seconds: number
        max_duration_seconds: number
        min_duration_seconds: number
    }
    daily_trend: DailyPoint[]
    top_modules: TopModule[]
    most_failing: TopModule[]
    recent_runs: RecentRun[]
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function fmtDuration(sec: number): string {
    if (sec < 60) return `${sec}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
}

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

/* ── Charts (Recharts) ── */

function TrendAreaChart({ data, color = '#1976d2' }: {
    data: { date: string; rate: number }[]
    color?: string
}) {
    if (!data.length) return <Typography variant="caption" color="text.secondary">No trend data</Typography>

    return (
        <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 16, right: 20, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                    <XAxis dataKey="date" tickFormatter={t => t.slice(5)} tick={{ fontSize: 12 }} strokeOpacity={0.2} />
                    <YAxis domain={['dataMin - 5', 100]} tick={{ fontSize: 12 }} strokeOpacity={0.2} tickFormatter={t => `${t}%`} />
                    <RechartsTooltip
                        contentStyle={{ borderRadius: 8, backgroundColor: 'var(--mui-palette-background-paper)', border: '1px solid var(--mui-palette-divider)', color: 'var(--mui-palette-text-primary)' }}
                        itemStyle={{ color: 'var(--mui-palette-text-primary)' }}
                        formatter={(val: any) => [`${val}%`, 'Success Rate']}
                        labelStyle={{ color: 'var(--mui-palette-text-secondary)', marginBottom: 4 }}
                    />
                    <Area type="monotone" dataKey="rate" stroke={color} strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                </AreaChart>
            </ResponsiveContainer>
        </Box>
    )
}

function RunsBarChart({ data, color = '#7b1fa2' }: {
    data: { date: string; total: number }[]
    color?: string
}) {
    if (!data.length) return <Typography variant="caption" color="text.secondary">No historical data yet</Typography>

    return (
        <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 16, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                    <XAxis dataKey="date" tickFormatter={t => t.slice(5)} tick={{ fontSize: 12 }} strokeOpacity={0.2} />
                    <YAxis tick={{ fontSize: 12 }} strokeOpacity={0.2} allowDecimals={false} />
                    <RechartsTooltip
                        contentStyle={{ borderRadius: 8, backgroundColor: 'var(--mui-palette-background-paper)', border: '1px solid var(--mui-palette-divider)', color: 'var(--mui-palette-text-primary)' }}
                        itemStyle={{ color: 'var(--mui-palette-text-primary)' }}
                        formatter={(val: any) => [val, 'Total Runs']}
                        labelStyle={{ color: 'var(--mui-palette-text-secondary)', marginBottom: 4 }}
                    />
                    <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </Box>
    )
}

/* ── KPI Card ─────────────────────────────────────────────────────── */

function KpiCard({ title, value, subtitle, icon, color, trend, loading }: {
    title: string
    value: string | number
    subtitle?: string
    icon?: React.JSX.Element
    color?: string
    trend?: 'up' | 'down' | 'neutral'
    loading?: boolean
}) {
    const trendEl = trend === 'up' ? <TrendingUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
        : trend === 'down' ? <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
            : null

    return (
        <Card sx={{ height: '100%', minWidth: 160 }} elevation={1}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" sx={{ mb: 0.5, alignItems: 'center', gap: 1 }}>
                    {icon && <Box sx={{ color: color ?? 'primary.main', opacity: 0.7 }}>{icon}</Box>}
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 500 }}>
                        {title}
                    </Typography>
                </Stack>
                {loading ? (
                    <CircularProgress size={24} sx={{ mt: 1 }} />
                ) : (
                    <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }} color={color ?? 'text.primary'}>
                            {value}
                        </Typography>
                        {trendEl}
                    </Stack>
                )}
                {subtitle && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                        {subtitle}
                    </Typography>
                )}
            </CardContent>
        </Card>
    )
}

/* ── Main Dashboard ────────────────────────────────────────────────── */

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const r = await fetch('/dashboard')
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const d: DashboardData = await r.json()
            setData(d)
            setLastRefresh(new Date())
        } catch (e: any) {
            setError(e.message || 'Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 30000) // auto-refresh every 30s
        return () => clearInterval(interval)
    }, [fetchData])

    if (error) {
        return (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                <Alert severity="error" action={
                    <IconButton size="small" onClick={fetchData}><RefreshIcon /></IconButton>
                }>
                    {error}
                </Alert>
            </Box>
        )
    }

    const s = data?.summary

    return (
        <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, width: '100%', maxWidth: '100%', height: '100%', overflow: 'auto', bgcolor: 'background.default' }}>
            {/* ── Header ── */}
            <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        CPX-AP Test Automation Analytics
                        {lastRefresh && <> · Last updated {lastRefresh.toLocaleTimeString()}</>}
                    </Typography>
                </Box>
                <Tooltip title="Refresh dashboard">
                    <IconButton onClick={fetchData} disabled={loading}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Stack>

            {/* ── KPI Row ── */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid size={{ xs: 6, sm: 4, md: 4, lg: 2 }}>
                    <KpiCard
                        title="Total Runs"
                        value={s?.total_runs ?? '—'}
                        subtitle={`${s?.completed_runs ?? 0} completed`}
                        icon={<StorageIcon />}
                        color="#1976d2"
                        loading={loading}
                    />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 4, lg: 2 }}>
                    <KpiCard
                        title="Success Rate"
                        value={`${s?.success_rate ?? 0}%`}
                        subtitle={`${s?.total_tests_passed ?? 0}/${s?.total_tests_run ?? 0} tests passed`}
                        icon={<CheckCircleIcon />}
                        color={s && s.success_rate >= 90 ? '#2e7d32' : s && s.success_rate >= 70 ? '#ed6c02' : '#d32f2f'}
                        trend={s && s.success_rate >= 90 ? 'up' : s && s.success_rate >= 70 ? 'neutral' : 'down'}
                        loading={loading}
                    />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 4, lg: 2 }}>
                    <KpiCard
                        title="CI Runs"
                        value={s?.ci_runs ?? '—'}
                        subtitle={`${s?.ci_success_rate ?? 0}% success`}
                        icon={<TerminalIcon />}
                        color="#7b1fa2"
                        loading={loading}
                    />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 4, lg: 2 }}>
                    <KpiCard
                        title="UI Runs"
                        value={s?.web_runs ?? '—'}
                        subtitle={`${s?.web_success_rate ?? 0}% success`}
                        icon={<MonitorIcon />}
                        color="#0288d1"
                        loading={loading}
                    />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 4, lg: 2 }}>
                    <KpiCard
                        title="Avg Duration"
                        value={s ? fmtDuration(s.avg_duration_seconds) : '—'}
                        subtitle={`Min ${s ? fmtDuration(s.min_duration_seconds) : '—'} · Max ${s ? fmtDuration(s.max_duration_seconds) : '—'}`}
                        icon={<TimerIcon />}
                        color="#ed6c02"
                        loading={loading}
                    />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 4, lg: 2 }}>
                    <KpiCard
                        title="Active"
                        value={s?.running ?? '—'}
                        subtitle={s && s.running > 0 ? 'Test in progress' : 'Idle'}
                        icon={<PlayArrowIcon />}
                        color={s && s.running > 0 ? '#2e7d32' : '#9e9e9e'}
                        trend={s && s.running > 0 ? 'up' : 'neutral'}
                        loading={loading}
                    />
                </Grid>
            </Grid>

            {/* ── Charts: Success Rate Trend & Number of Runs ── */}
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Success Rate Over Time
                        </Typography>
                        {data?.daily_trend && data.daily_trend.length > 0 ? (
                            <TrendAreaChart
                                data={data.daily_trend.map(d => ({ date: d.date, rate: d.rate }))}
                                color="#1976d2"
                            />
                        ) : (
                            <Box sx={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="body2" color="text.secondary">No historical data yet</Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={1} sx={{ p: 2, height: '100%' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Number of Runs Over Time
                        </Typography>
                        {data?.daily_trend && data.daily_trend.length > 0 ? (
                            <RunsBarChart
                                data={data.daily_trend.map(d => ({ date: d.date, total: d.total }))}
                                color="#7b1fa2"
                            />
                        ) : (
                            <Box sx={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="body2" color="text.secondary">No historical data yet</Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* ── Source Distribution + Pass Rate Gauge ── */}
            <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Run Source Distribution
                        </Typography>
                        <Stack spacing={1.5} sx={{ mt: 1 }}>
                            <Box>
                                <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
                                    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                                        <TerminalIcon sx={{ fontSize: 16, color: '#7b1fa2' }} />
                                        <Typography variant="caption">CI/CD Pipelines</Typography>
                                    </Stack>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        {s?.ci_runs ?? 0} runs ({s?.ci_success_rate ?? 0}%)
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    variant="determinate"
                                    value={s ? (s.ci_runs / Math.max(s.total_runs, 1)) * 100 : 0}
                                    sx={{ height: 10, borderRadius: 5, bgcolor: '#f3e5f5', '& .MuiLinearProgress-bar': { bgcolor: '#7b1fa2' } }}
                                />
                            </Box>
                            <Box>
                                <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'space-between' }}>
                                    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                                        <MonitorIcon sx={{ fontSize: 16, color: '#0288d1' }} />
                                        <Typography variant="caption">UI / Web</Typography>
                                    </Stack>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        {s?.web_runs ?? 0} runs ({s?.web_success_rate ?? 0}%)
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    variant="determinate"
                                    value={s ? (s.web_runs / Math.max(s.total_runs, 1)) * 100 : 0}
                                    sx={{ height: 10, borderRadius: 5, bgcolor: '#e1f5fe', '& .MuiLinearProgress-bar': { bgcolor: '#0288d1' } }}
                                />
                            </Box>
                        </Stack>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Overall Pass Rate
                        </Typography>
                        <Stack direction="row" sx={{ mt: 1, justifyContent: 'center', alignItems: 'center', gap: 3 }}>
                            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                <CircularProgress
                                    variant="determinate"
                                    value={s?.overall_pass_rate ?? 0}
                                    size={90}
                                    thickness={5}
                                    sx={{ color: (s?.overall_pass_rate ?? 0) >= 90 ? '#2e7d32' : (s?.overall_pass_rate ?? 0) >= 70 ? '#ed6c02' : '#d32f2f' }}
                                />
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{s?.overall_pass_rate ?? 0}%</Typography>
                                </Box>
                            </Box>
                            <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>Tests Passed</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700 }} color="text.primary">
                                    {s?.total_tests_passed ?? 0}<Typography component="span" variant="body2" color="text.secondary"> / {s?.total_tests_run ?? 0}</Typography>
                                </Typography>
                            </Box>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>

            {/* ── Daily Breakdown + Most Run/Failing ── */}
            {data?.daily_trend && data.daily_trend.length > 0 && (
                <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                    <Grid size={{ xs: 12, lg: 6 }}>
                        <Paper elevation={1} sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                                Daily Breakdown
                            </Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Date</TableCell>
                                            <TableCell align="right">Total</TableCell>
                                            <TableCell align="right">Passed</TableCell>
                                            <TableCell align="right">Failed</TableCell>
                                            <TableCell align="right">Rate</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(data?.daily_trend ?? []).slice(-30).reverse().map(d => (
                                            <TableRow key={d.date} hover>
                                                <TableCell><Typography variant="caption">{d.date}</Typography></TableCell>
                                                <TableCell align="right"><Typography variant="caption">{d.total}</Typography></TableCell>
                                                <TableCell align="right">
                                                    <Chip size="small" label={d.passed} color="success" variant="outlined" sx={{ height: 20, '& .MuiChip-label': { fontSize: 11 } }} />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip size="small" label={d.failed} color={d.failed > 0 ? 'error' : 'default'} variant="outlined" sx={{ height: 20, '& .MuiChip-label': { fontSize: 11 } }} />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="caption"
                                                        sx={{ fontWeight: 600 }}
                                                        color={d.rate >= 90 ? 'success.main' : d.rate >= 70 ? 'warning.main' : 'error.main'}>
                                                        {d.rate}%
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 6 }}>
                        <Paper elevation={1} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                                Test Statistics
                            </Typography>
                            <Box sx={{ flex: 1, minHeight: 300, width: '100%' }}>
                                <DataGrid
                                    rows={Array.from(new Map(
                                        [...(data?.top_modules ?? []), ...(data?.most_failing ?? [])]
                                            .map(m => [m.test_id, { id: m.test_id, ...m }])
                                    ).values())}
                                    columns={[
                                        { field: 'test_id', headerName: 'Test ID', flex: 1, minWidth: 200 },
                                        { field: 'count', headerName: 'Runs', type: 'number', width: 90 },
                                        {
                                            field: 'failures',
                                            headerName: 'Failures',
                                            type: 'number',
                                            width: 90,
                                            renderCell: (params) => (
                                                params.value > 0 ? (
                                                    <Chip size="small" label={params.value} color="error" variant="outlined" sx={{ height: 20, minWidth: 24, '& .MuiChip-label': { px: 0.75, fontSize: 10 } }} />
                                                ) : <Typography variant="caption" color="text.secondary">0</Typography>
                                            )
                                        }
                                    ]}
                                    density="compact"
                                    disableRowSelectionOnClick
                                    initialState={{
                                        pagination: { paginationModel: { pageSize: 10 } },
                                        sorting: { sortModel: [{ field: 'count', sort: 'desc' }] }
                                    }}
                                    pageSizeOptions={[5, 10, 25]}
                                />
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* ── Recent Runs Table ── */}
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
        </Box>
    )
}
