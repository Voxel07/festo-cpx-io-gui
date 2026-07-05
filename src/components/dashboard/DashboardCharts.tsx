import { Box, Typography } from '@mui/material'
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'

export function TrendAreaChart({ data, color = '#1976d2' }: {
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
                        formatter={(value: any) => [`${value}%`, 'Success Rate']}
                        labelStyle={{ color: 'var(--mui-palette-text-secondary)', marginBottom: 4 }}
                    />
                    <Area type="monotone" dataKey="rate" stroke={color} strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                </AreaChart>
            </ResponsiveContainer>
        </Box>
    )
}

export function RunsBarChart({ data, color = '#7b1fa2' }: {
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
                        formatter={(value: any) => [value, 'Total Runs']}
                        labelStyle={{ color: 'var(--mui-palette-text-secondary)', marginBottom: 4 }}
                    />
                    <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </Box>
    )
}
