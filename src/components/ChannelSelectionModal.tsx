import React, { useState } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Stack
} from '@mui/material'

export interface ChannelSelectionModalProps {
    open: boolean
    sourceIsM12: boolean
    targetIsM12: boolean
    sourceKind?: string
    targetKind?: string
    isPortMode?: boolean
    sourceLabel?: string
    targetLabel?: string
    onConfirm: (sourceSubchannel: number | 'both', targetSubchannel: number | 'both', direction?: 'forward' | 'reverse') => void
    onCancel: () => void
}

export default function ChannelSelectionModal({
    open,
    sourceIsM12,
    targetIsM12,
    sourceKind,
    targetKind,
    isPortMode,
    sourceLabel,
    targetLabel,
    onConfirm,
    onCancel
}: ChannelSelectionModalProps) {
    // If not M12, it's M8 or single channel, which must be 0.
    const [srcSub, setSrcSub] = useState<number | 'both'>(isPortMode ? 'both' : 0)
    const [tgtSub, setTgtSub] = useState<number | 'both'>(isPortMode ? 'both' : 0)
    const [direction, setDirection] = useState<'forward' | 'reverse'>('forward')

    const bothInOut = sourceKind === 'inout' && targetKind === 'inout'

    // Reset state when opened
    React.useEffect(() => {
        if (open) {
            setSrcSub(isPortMode ? 'both' : 0)
            setTgtSub(isPortMode ? 'both' : 0)
            setDirection('forward')
        }
    }, [open, isPortMode])

    const handleConfirm = () => {
        onConfirm(srcSub, tgtSub, bothInOut ? direction : undefined)
    }

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>
                Select Connection Channels
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {isPortMode
                        ? "Select the direction of the signal for this connection."
                        : "Specify which channel(s) are physically connected on the ports."}
                </Typography>
                
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {!isPortMode && (
                        <>
                            <FormControl size="small" fullWidth disabled={!sourceIsM12}>
                                <InputLabel>Source Channel {sourceLabel ? `(${sourceLabel})` : ''}</InputLabel>
                        <Select
                            value={sourceIsM12 ? srcSub : 0}
                            label={`Source Channel ${sourceLabel ? `(${sourceLabel})` : ''}`}
                            onChange={(e) => setSrcSub(e.target.value as number | 'both')}
                        >
                            <MenuItem value={0}>Channel 0</MenuItem>
                            {sourceIsM12 && <MenuItem value={1}>Channel 1</MenuItem>}
                            {sourceIsM12 && <MenuItem value="both">Both Channels</MenuItem>}
                        </Select>
                        {!sourceIsM12 && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                Source port only has 1 channel.
                            </Typography>
                        )}
                    </FormControl>

                    <FormControl size="small" fullWidth disabled={!targetIsM12}>
                        <InputLabel>Target Channel {targetLabel ? `(${targetLabel})` : ''}</InputLabel>
                        <Select
                            value={targetIsM12 ? tgtSub : 0}
                            label={`Target Channel ${targetLabel ? `(${targetLabel})` : ''}`}
                            onChange={(e) => setTgtSub(e.target.value as number | 'both')}
                        >
                            <MenuItem value={0}>Channel 0</MenuItem>
                            {targetIsM12 && <MenuItem value={1}>Channel 1</MenuItem>}
                            {targetIsM12 && <MenuItem value="both">Both Channels</MenuItem>}
                        </Select>
                        {!targetIsM12 && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                Target port only has 1 channel.
                            </Typography>
                        )}
                    </FormControl>
                        </>
                    )}

                    {bothInOut && (
                        <FormControl size="small" fullWidth>
                            <InputLabel>Signal Direction</InputLabel>
                            <Select
                                value={direction}
                                label="Signal Direction"
                                onChange={(e) => setDirection(e.target.value as 'forward' | 'reverse')}
                            >
                                <MenuItem value="forward">
                                    Source {sourceLabel ? `(${sourceLabel})` : ''} Output &rarr; Target {targetLabel ? `(${targetLabel})` : ''} Input
                                </MenuItem>
                                <MenuItem value="reverse">
                                    Source {sourceLabel ? `(${sourceLabel})` : ''} Input &larr; Target {targetLabel ? `(${targetLabel})` : ''} Output
                                </MenuItem>
                            </Select>
                        </FormControl>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} color="inherit">Cancel</Button>
                <Button onClick={handleConfirm} variant="contained" color="primary">
                    Connect
                </Button>
            </DialogActions>
        </Dialog>
    )
}
