import { useState, useEffect } from 'react'
import { AppBar, Toolbar, Typography, TextField, Stack, Badge } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CloudIcon from '@mui/icons-material/Cloud'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import StorageIcon from '@mui/icons-material/Storage'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { TooltipButton } from './TooltipButton'

const appBarFieldSx = {
    '& label': { color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' },
    '& label.Mui-focused': { color: '#fff' },
    '& .MuiInput-underline:after': { borderBottomColor: '#fff' },
    '& .MuiOutlinedInput-root': {
        color: '#fff', fontSize: '0.75rem', height: 32,
        '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
        '&.Mui-focused fieldset': { borderColor: '#fff' },
        '& input': { padding: '4px 8px' }
    }
}

interface AppHeaderProps {
    ip: string
    onIpChange: (v: string) => void
    timeout: number
    onTimeoutChange: (v: number) => void
    showTopology: boolean
    onToggleTopology: () => void
    pbChecking: boolean
    pbStatus: 'unknown' | 'ok' | 'error'
    onCheckPocketBase: () => void
    onOpenDiagnostics: () => void
    configPath: string
    onConfigPathChange: (path: string) => void
}

export default function AppHeader({
    ip,
    onIpChange,
    timeout,
    onTimeoutChange,
    showTopology,
    onToggleTopology,
    pbChecking,
    pbStatus,
    onCheckPocketBase,
    onOpenDiagnostics,
    configPath,
    onConfigPathChange,
}: AppHeaderProps) {
    const [diagCount, setDiagCount] = useState(0)
    const [diagSeverity, setDiagSeverity] = useState<'error' | 'warning' | 'info' | 'none'>('none')

    useEffect(() => {
        if (!ip) {
            setDiagCount(0)
            setDiagSeverity('none')
            return
        }
        const fetchDiags = async () => {
            try {
                const r = await fetch(`/io/diagnoses?ip_address=${encodeURIComponent(ip)}`)
                if (r.ok) {
                    const d = await r.json()
                    setDiagCount(d.length)
                    if (d.length === 0) {
                        setDiagSeverity('none')
                    } else if (d.some((x: any) => x.severity === 'error' || (!x.severity && (x.name.toLowerCase().includes('error') || x.description.toLowerCase().includes('error'))))) {
                        setDiagSeverity('error')
                    } else if (d.some((x: any) => x.severity === 'warning' || (!x.severity && (x.name.toLowerCase().includes('warning') || x.description.toLowerCase().includes('warning'))))) {
                        setDiagSeverity('warning')
                    } else {
                        setDiagSeverity('info')
                    }
                }
            } catch {
                // ignore
            }
        }
        fetchDiags()
        const timer = setInterval(fetchDiags, 5000)
        return () => clearInterval(timer)
    }, [ip])

    const iconColor = diagSeverity === 'error' ? '#d32f2f' :
                      diagSeverity === 'warning' ? '#ed6c02' :
                      diagSeverity === 'info' ? '#0288d1' : 'inherit'

    return (
        <AppBar position="static" sx={{ background: '#003366', flexShrink: 0, pt: 1, pb: 1 }}>
            <Toolbar variant="dense" sx={{ gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mr: 2, whiteSpace: 'nowrap' }}>
                    CPX-AP Topology Manager
                </Typography>
                <TextField
                    label="IP Address" value={ip}
                    onChange={e => onIpChange(e.target.value)}
                    size="small" variant="outlined" sx={appBarFieldSx}
                />
                <TextField
                    label="Timeout (s)" value={timeout}
                    onChange={e => onTimeoutChange(parseFloat(e.target.value) || 0)}
                    size="small" type="number" variant="outlined"
                    sx={{ ...appBarFieldSx, width: 100 }}
                />
                <TextField
                    label="Config File" value={configPath}
                    onChange={e => onConfigPathChange(e.target.value)}
                    size="small" variant="outlined"
                    placeholder="data/bench_config.json"
                    sx={{ ...appBarFieldSx, width: 160 }}
                />
                <Stack direction="row" spacing={1} sx={{ ml: 'auto', alignItems: 'center' }}>
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        onClick={onToggleTopology}
                        tooltip={showTopology ? 'Hide topology map' : 'Show topology map'}
                        icon={showTopology ? <VisibilityOffIcon sx={{ fontSize: '1rem' }} /> : <VisibilityIcon sx={{ fontSize: '1rem' }} />}
                        sx={{ fontSize: '0.65rem', height: 26, px: 1, whiteSpace: 'nowrap', color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '& .MuiButton-startIcon': { mr: 0.5 } }}
                    >
                        Map
                    </TooltipButton>
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        onClick={onCheckPocketBase}
                        disabled={pbChecking}
                        tooltip={pbStatus === 'ok' ? 'PocketBase: connected' : pbStatus === 'error' ? 'PocketBase: unreachable' : 'Check PocketBase connection'}
                        icon={pbStatus === 'ok' ? <CloudIcon sx={{ fontSize: '1rem' }} /> : pbStatus === 'error' ? <CloudOffIcon sx={{ fontSize: '1rem' }} /> : <StorageIcon sx={{ fontSize: '1rem' }} />}
                        sx={{
                            fontSize: '0.65rem', height: 26, px: 1, whiteSpace: 'nowrap',
                            borderColor: pbStatus === 'ok' ? '#4caf50' : pbStatus === 'error' ? '#f44336' : 'rgba(255,255,255,0.5)',
                            color: pbStatus === 'ok' ? '#4caf50' : pbStatus === 'error' ? '#f44336' : '#fff',
                            '&:hover': { borderColor: '#fff', color: '#fff' },
                            '& .MuiButton-startIcon': { mr: 0.5 }
                        }}
                    >
                        {pbChecking ? 'Checking...' : 'PocketBase'}
                    </TooltipButton>
                    <Badge badgeContent={diagCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.55rem', height: 16, minWidth: 16, top: 4, right: 4 } }}>
                        <TooltipButton
                            size="small"
                            variant="outlined"
                            onClick={onOpenDiagnostics}
                            tooltip="Show live system diagnostics raised"
                            icon={<ReportProblemIcon sx={{ fontSize: '1rem', color: iconColor }} />}
                            sx={{
                                fontSize: '0.65rem', height: 26, px: 1, whiteSpace: 'nowrap',
                                borderColor: 'rgba(255,255,255,0.5)',
                                color: '#fff',
                                '&:hover': { borderColor: '#fff', color: '#fff' },
                                '& .MuiButton-startIcon': { mr: 0.5 }
                            }}
                        >
                            Diagnostics
                        </TooltipButton>
                    </Badge>
                </Stack>
            </Toolbar>
        </AppBar>
    )
}
