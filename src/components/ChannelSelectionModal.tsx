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
    onConfirm: (sourceSubchannel: number | 'both', targetSubchannel: number | 'both') => void
    onCancel: () => void
}

export default function ChannelSelectionModal({
    open,
    sourceIsM12,
    targetIsM12,
    onConfirm,
    onCancel
}: ChannelSelectionModalProps) {
    // If not M12, it's M8 or single channel, which must be 0.
    const [srcSub, setSrcSub] = useState<number | 'both'>(0)
    const [tgtSub, setTgtSub] = useState<number | 'both'>(0)

    // Reset state when opened
    React.useEffect(() => {
        if (open) {
            setSrcSub(0)
            setTgtSub(0)
        }
    }, [open])

    const handleConfirm = () => {
        onConfirm(srcSub, tgtSub)
    }

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>
                Select Connection Channels
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Specify which channel(s) are physically connected on the ports.
                </Typography>
                
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <FormControl size="small" fullWidth disabled={!sourceIsM12}>
                        <InputLabel>Source Channel</InputLabel>
                        <Select
                            value={sourceIsM12 ? srcSub : 0}
                            label="Source Channel"
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
                        <InputLabel>Target Channel</InputLabel>
                        <Select
                            value={targetIsM12 ? tgtSub : 0}
                            label="Target Channel"
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
