import { Card, CardContent, Typography, Stack, CircularProgress, Box } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'

interface KpiCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon?: React.ReactNode
    color?: string
    trend?: 'up' | 'down' | 'neutral'
    loading?: boolean
}

export function KpiCard({ title, value, subtitle, icon, color, trend, loading }: KpiCardProps) {
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
