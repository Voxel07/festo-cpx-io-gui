import { Box, Button, Checkbox, FormControlLabel, Paper, Stack, Typography, Chip, CircularProgress } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

export interface AvailableTest {
    id: string
    label: string
}

interface TestSelectionProps {
    availableTests: AvailableTest[]
    selected: string[]
    isRunning: boolean
    isStarting: boolean
    busy: boolean
    runSource?: string
    onToggleTest: (id: string) => void
    onStart: () => void
}

export default function TestSelection({
    availableTests,
    selected,
    isRunning,
    isStarting,
    busy,
    runSource,
    onToggleTest,
    onStart,
}: TestSelectionProps) {
    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Select Tests
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {availableTests.map(t => (
                    <FormControlLabel
                        key={t.id}
                        control={
                            <Checkbox
                                size="small"
                                checked={selected.includes(t.id)}
                                onChange={() => onToggleTest(t.id)}
                                disabled={isRunning || isStarting}
                            />
                        }
                        label={<Typography variant="caption">{t.label}</Typography>}
                        sx={{ mr: 1 }}
                    />
                ))}
            </Stack>
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={isStarting || busy ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                    onClick={onStart}
                    disabled={isRunning || isStarting || busy || selected.length === 0}
                    size="small"
                >
                    {isStarting ? 'Starting…' : isRunning ? 'Running…' : busy ? 'Waiting…' : 'Start Test Run'}
                </Button>
                {runSource && runSource !== 'web' && (
                    <Chip label={`By: ${runSource}`} size="small" color="info" />
                )}
                {isStarting && (
                    <Typography variant="caption" color="text.secondary">
                        Connecting to device…
                    </Typography>
                )}
            </Stack>
        </Paper>
    )
}
