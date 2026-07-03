import { useState, useEffect } from 'react'
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Typography, Box, Stack, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { TooltipButton } from './TooltipButton'
import type { DiagnosisEntry } from '../types'

interface Props {
    open: boolean
    onClose: () => void
    ip: string
    diagnoses: DiagnosisEntry[]
    onRefresh: () => void
}

export default function DiagnosticsModal({ open, onClose, ip, diagnoses, onRefresh }: Props) {
    const [secondsLeft, setSecondsLeft] = useState(5)

    // Load on open — trigger initial fetch via parent
    useEffect(() => {
        if (open) {
            onRefresh()
        }
    }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

    // Countdown and auto-refresh timer (5 seconds)
    useEffect(() => {
        if (!ip || !open) return

        const timer = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    onRefresh()
                    return 5
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [ip, open, onRefresh])

    const handleManualRefresh = () => {
        onRefresh()
        setSecondsLeft(5)
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                <ReportProblemIcon sx={{
                    color: diagnoses.some(d => d.severity === 'error') ? '#d32f2f' :
                        diagnoses.some(d => d.severity === 'warning') ? '#ed6c02' :
                            diagnoses.some(d => d.severity === 'maintenance') ? '#0288d1' :
                                diagnoses.length > 0 ? '#4caf50' : 'action'
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
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        onClick={handleManualRefresh}
                        disabled={!ip}
                        tooltip="Manually refresh diagnostics now"
                        icon={<RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                        sx={{ py: 0.3, px: 1, fontSize: '0.68rem', height: 26 }}
                    >
                        Refresh ({secondsLeft}s)
                    </TooltipButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 3, bgcolor: 'background.default' }}>
                {diagnoses.length === 0 ? (
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
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead sx={{ bgcolor: 'action.hover' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '25%' }}>Module</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '5%' }}>Address</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '5%' }}>Channel</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '10%' }}>Severity</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '15%' }}>Diag Code</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '20%' }}>Description</TableCell>
                                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700, width: '20%' }}>Action Guideline</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {diagnoses.map((diag) => (
                                        <TableRow key={`${diag.address}-${diag.channel ?? 'none'}-${diag.diagnosis_id}`} sx={{ bgcolor: 'background.paper' }}>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                                    {diag.module_name}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                                    #{diag.address}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                                    {diag.channel != null ? diag.channel : '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: diag.severity === 'error' ? '#d32f2f' : diag.severity === 'warning' ? '#ed6c02' : diag.severity === 'maintenance' ? '#0288d1' : '#4caf50' }}>
                                                    {diag.severity ? diag.severity.toUpperCase() : 'UNKNOWN'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 600 }}>
                                                {diag.diagnosis_id}
                                            </TableCell>
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#d32f2f' }}>
                                                    {diag.name}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.68rem', color: (t) => t.palette.mode === 'dark' ? '#81c784' : '#1b5e20', fontStyle: 'italic', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : '#f1f8e9' }}>
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

            <DialogActions sx={{ px: 3, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Button onClick={onClose} size="small" variant="contained">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    )
}
