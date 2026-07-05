import { Box, Typography, Tooltip } from '@mui/material'
import type { DiagnosisEntry } from '../types'

interface Props {
    diagnoses: DiagnosisEntry[]
}

export function ModuleNodeDiagnosis({ diagnoses }: Props) {
    if (diagnoses.length === 0) return null

    const hasError = diagnoses.some(d => d.severity === 'error')
    const hasWarning = diagnoses.some(d => d.severity === 'warning')
    const hasMaintenance = diagnoses.some(d => d.severity === 'maintenance')
    const sevColor = hasError ? '#d32f2f' : hasWarning ? '#ed6c02' : hasMaintenance ? '#0288d1' : '#4caf50'
    const sevLabel = hasError ? '!' : hasWarning ? '!' : hasMaintenance ? 'M' : 'i'

    const tooltipContent = (
        <Box sx={{ maxWidth: 260 }}>
            {diagnoses.map((d, i) => (
                <Box key={i} sx={{ mb: i < diagnoses.length - 1 ? 0.75 : 0, pb: i < diagnoses.length - 1 ? 0.5 : 0, borderBottom: i < diagnoses.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', display: 'block', color: d.severity === 'error' ? '#ff8a80' : d.severity === 'warning' ? '#ffd54f' : '#81d4fa' }}>
                        {d.name}
                    </Typography>
                    {d.description && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'grey.400', display: 'block' }}>
                            {d.description}
                        </Typography>
                    )}
                    {d.guideline && (
                        <Typography variant="caption" sx={{ fontSize: '0.58rem', fontStyle: 'italic', color: '#81c784', display: 'block' }}>
                            {d.guideline}
                        </Typography>
                    )}
                </Box>
            ))}
        </Box>
    )

    return (
        <Tooltip title={tooltipContent} placement="top" arrow
            slotProps={{ tooltip: { sx: { bgcolor: 'grey.900', color: '#fff', p: 1, maxWidth: 280, fontSize: '0.7rem' } } }}>
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 22,
                height: 22,
                borderRadius: '50%',
                bgcolor: sevColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 900,
                zIndex: 15,
                boxShadow: `0 0 8px 2px ${sevColor}80`,
                border: '2px solid #fff',
                cursor: 'help',
                pointerEvents: 'auto',
            }}>
                {sevLabel}
            </Box>
        </Tooltip>
    )
}
