import { Box, Stack, Typography, Button, FormControlLabel, Checkbox } from '@mui/material'
import type { ActuateChannel } from './ModuleActuatePanel'

interface Props {
    channels: ActuateChannel[]
    activeChannels: Set<number>
    selectAll: () => void
    deselectAll: () => void
    toggleChannel: (ch: number) => void
}

export default function ModuleActuateChannelList({
    channels, activeChannels, selectAll, deselectAll, toggleChannel
}: Props) {
    return (
        <>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', flex: 1 }}>
                    Output Channels
                </Typography>
                <Button size="small" variant="text" onClick={selectAll}
                    sx={{ fontSize: '0.62rem', py: 0, px: 0.5, minWidth: 0 }}>
                    All
                </Button>
                <Button size="small" variant="text" onClick={deselectAll}
                    sx={{ fontSize: '0.62rem', py: 0, px: 0.5, minWidth: 0 }}>
                    None
                </Button>
            </Stack>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 150, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {channels.map(ch => {
                    const sel = activeChannels.has(ch.index)
                    return (
                        <FormControlLabel
                            key={ch.index}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={sel}
                                    onChange={() => toggleChannel(ch.index)}
                                    sx={{ p: 0.25 }}
                                />
                            }
                            label={
                                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                    {ch.label}
                                    <span style={{ color: 'text.secondary', marginLeft: 4 }}>ch{ch.index}</span>
                                </Typography>
                            }
                            sx={{ display: 'flex', ml: 0, mr: 0, minWidth: 100 }}
                        />
                    )
                })}
            </Box>
        </>
    )
}
