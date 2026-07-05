/**
 * Dashboard – analytics overview for CPX-AP test automation.
 *
 * Shows aggregate metrics, success-rate trends, per-source breakdowns,
 * module statistics, and recent run activity.  Data is fetched from
 * the /dashboard API endpoint which aggregates PocketBase + in-memory history.
 */
import { useState, useEffect, useCallback } from 'react'
import {
    Box, Typography, Grid, CircularProgress, Alert, Paper,
    LinearProgress, IconButton, Tooltip, Stack
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import StorageIcon from '@mui/icons-material/Storage'
import TerminalIcon from '@mui/icons-material/Terminal'
import MonitorIcon from '@mui/icons-material/Monitor'
import TimerIcon from '@mui/icons-material/Timer'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

import type { DashboardData } from './dashboard/types'
import { KpiCard } from './dashboard/KpiCard'
import { TrendAreaChart, RunsBarChart } from './dashboard/DashboardCharts'
import { DailyBreakdownTable } from './dashboard/DailyBreakdownTable'
import { TestStatisticsGrid } from './dashboard/TestStatisticsGrid'
import { RecentRunsTable } from './dashboard/RecentRunsTable'

/* ── Helpers ──────────────────────────────────────────────────────── */

function fmtDuration(sec: number): string {
    if (sec < 60) return `${sec}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${h}h ${m}m`
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
                        <DailyBreakdownTable data={data} />
                    </Grid>

                    <Grid size={{ xs: 12, lg: 6 }}>
                        <TestStatisticsGrid data={data} />
                    </Grid>
                </Grid>
            )}

            {/* ── Recent Runs Table ── */}
            <RecentRunsTable data={data} />
        </Box>
    )
}
