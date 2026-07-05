import { Box, CircularProgress, Typography } from '@mui/material'

export function LoadingChunk({ label = 'Loading…' }: { label?: string }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'text.secondary' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">{label}</Typography>
        </Box>
    )
}
