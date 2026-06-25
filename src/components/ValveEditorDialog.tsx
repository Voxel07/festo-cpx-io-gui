import { useState, useEffect } from 'react'
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, FormControlLabel, Checkbox, Box, Typography, Divider,
} from '@mui/material'
import { useModifiedSvg } from '../hooks/useModifiedSvg'
import { useValveGroups } from '../hooks/useValveGroups'

interface Props {
    open: boolean
    svgUrl: string
    hiddenValves: string[]
    onToggle: (id: string, hide: boolean) => void
    onClose: () => void
}

export default function ValveEditorDialog({ open, svgUrl, hiddenValves, onToggle, onClose }: Props) {
    const valveGroups = useValveGroups(open ? svgUrl : '')
    const displayUrl = useModifiedSvg(svgUrl, hiddenValves)
    const hiddenSet = new Set(hiddenValves)

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700, pb: 1 }}>
                ⚙ Configure Mounted Valves
            </DialogTitle>

            <DialogContent dividers>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                    {/* Live SVG preview */}
                    <Box sx={{ flexShrink: 0, textAlign: 'center' }}>
                        <img
                            src={displayUrl}
                            alt="Valve body preview"
                            style={{ width: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }}
                        />
                        <Typography variant="caption" sx={{ color: '#888', fontSize: '0.55rem' }}>
                            Live preview
                        </Typography>
                    </Box>

                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Uncheck valve slots that have <strong>no valve physically mounted</strong>.
                        </Typography>
                        <Divider sx={{ mb: 1 }} />
                        {valveGroups.length === 0 && (
                            <Typography variant="caption" sx={{ color: '#aaa' }}>
                                No configurable valve slots found in this SVG.
                            </Typography>
                        )}
                        {valveGroups.map((id, i) => (
                            <FormControlLabel
                                key={id}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={!hiddenSet.has(id)}
                                        onChange={e => onToggle(id, !e.target.checked)}
                                        sx={{ p: 0.25 }}
                                    />
                                }
                                label={
                                    <Typography variant="caption">
                                        Valve {i + 1}
                                        <span style={{ color: '#aaa', marginLeft: 4 }}>({id})</span>
                                    </Typography>
                                }
                                sx={{ display: 'flex', ml: 0.25, mb: 0.25 }}
                            />
                        ))}
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions>
                <Button size="small" onClick={() => valveGroups.forEach(id => onToggle(id, false))}>
                    All Mounted
                </Button>
                <Button size="small" color="warning" onClick={() => valveGroups.forEach(id => onToggle(id, true))}>
                    All Empty
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="contained" onClick={onClose}>
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    )
}
