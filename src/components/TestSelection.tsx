import { Button, Checkbox, FormControlLabel, Paper, Stack, Typography, Chip, CircularProgress, Box } from '@mui/material'
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
    canAbort: boolean
    isAborting: boolean
    runSource?: string
    onToggleTest: (id: string) => void
    onStart: () => void
    onAbort: () => void
}

export default function TestSelection({
    availableTests,
    selected,
    isRunning,
    isStarting,
    busy,
    canAbort,
    isAborting,
    runSource,
    onToggleTest,
    onStart,
    onAbort,
}: TestSelectionProps) {
    const selectedTests = new Set(selected)
    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Select Tests
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 1, rowGap: 0.5, mb: 2 }}>
                {availableTests.map(t => (
                    <FormControlLabel
                        key={t.id}
                        control={
                            <Checkbox
                                size="small"
                                checked={selectedTests.has(t.id)}
                                onChange={() => onToggleTest(t.id)}
                                disabled={canAbort}
                            />
                        }
                        label={<Typography variant="caption">{t.label}</Typography>}
                        sx={{ m: 0 }}
                    />
                ))}
            </Box>
            <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }} spacing={1}>
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
                {canAbort && (
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={onAbort}
                        disabled={isAborting}
                        startIcon={isAborting ? <CircularProgress size={16} color="inherit" /> : undefined}
                        size="small"
                    >
                        {isAborting ? 'Aborting…' : 'Abort test run'}
                    </Button>
                )}
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
