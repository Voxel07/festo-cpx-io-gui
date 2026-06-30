import { useState, useEffect, useCallback } from 'react'
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Typography, Box, CircularProgress, Alert, Stack, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { TooltipButton } from './TooltipButton'

interface DiagnosisEntry {
    address: number
    module_name: string
    diagnosis_id: string
    name: string
    description: string
    guideline: string
}

interface Props {
    open: boolean
    onClose: () => void
    ip: string
}

export default function DiagnosticsModal({ open, onClose, ip }: Props) {
    const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [secondsLeft, setSecondsLeft] = useState(5)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Fetch active diagnoses from API
    const fetchDiagnoses = useCallback(async () => {
        if (!ip) return
        setLoading(true)
        setErrorMsg(null)
        try {
            const r = await fetch(`/io/diagnoses?ip_address=${encodeURIComponent(ip)}`)
            const d = await r.json()
            if (!r.ok) {
                setErrorMsg(d.detail ?? 'Failed to load system diagnostics.')
                setDiagnoses([])
            } else {
                setDiagnoses(d)
            }
            setLoading(false)
        } catch (e) {
            setErrorMsg((e as Error).message)
            setDiagnoses([])
            setLoading(false)
        }
    }, [ip])

    // Load diagnostics on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchDiagnoses()
        }, 0)
        return () => clearTimeout(timer)
    }, [fetchDiagnoses])

    // Countdown and auto-refresh timer (5 seconds)
    useEffect(() => {
        if (!ip) return

        const timer = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    fetchDiagnoses()
                    return 5
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [ip, fetchDiagnoses])

    const handleManualRefresh = () => {
        fetchDiagnoses()
        setSecondsLeft(5)
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, borderBottom: '1px solid #e0e0e0' }}>
                <ReportProblemIcon sx={{
                    color: diagnoses.some(d => d.name.toLowerCase().includes('error') || d.description.toLowerCase().includes('error')) ? '#d32f2f' :
                        diagnoses.some(d => d.name.toLowerCase().includes('warning') || d.description.toLowerCase().includes('warning')) ? '#ed6c02' :
                            diagnoses.length > 0 ? '#0288d1' : 'action'
                }} />
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        System Diagnostics
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Gateway IP: {ip}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#666', fontStyle: 'italic', mr: 1, minWidth: 100, textAlign: 'right' }}>
                        Refreshes in {secondsLeft}s
                    </Typography>
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        onClick={handleManualRefresh}
                        disabled={loading || !ip}
                        tooltip="Manually refresh diagnostics now"
                        icon={loading ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                        sx={{ py: 0.3, px: 1, fontSize: '0.68rem', height: 26 }}
                    >
                        Refresh
                    </TooltipButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
                {errorMsg && (
                    <Alert severity="error" sx={{ mb: 2, fontSize: '0.75rem' }}>
                        {errorMsg}
                    </Alert>
                )}

                {loading && diagnoses.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 1 }}>
                        <CircularProgress size={28} />
                        <Typography variant="caption" color="text.secondary">
                            Querying system diagnostics...
                        </Typography>
                    </Box>
                ) : diagnoses.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                        <CheckCircleIcon sx={{ fontSize: 50, color: '#4caf50' }} />
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                                System Healthy
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                No active diagnostics or faults were reported in the system.
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        <Alert severity="warning" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.72rem', fontWeight: 600 } }}>
                            {diagnoses.length} active diagnostic warning(s) detected in the system!
                        </Alert>

                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead sx={{ background: '#f5f5f5' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '25%' }}>Module</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '15%' }}>Diag Code</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '35%' }}>Description</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '25%' }}>Action Guideline</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {diagnoses.map((diag) => (
                                        <TableRow key={`${diag.address}-${diag.diagnosis_id}`} sx={{ background: '#fff' }}>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                                    {diag.module_name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.62rem', color: '#666' }}>
                                                    Address: #{diag.address}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 600 }}>
                                                {diag.diagnosis_id}
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#d32f2f' }}>
                                                    {diag.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.68rem', color: '#555', mt: 0.25 }}>
                                                    {diag.description}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.68rem', color: '#1b5e20', fontStyle: 'italic', bgcolor: '#f1f8e9' }}>
                                                {diag.guideline}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Stack>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid #e0e0e0' }}>
                <Button onClick={onClose} size="small" variant="contained">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}
