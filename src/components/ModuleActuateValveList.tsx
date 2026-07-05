import { Box, Stack, Typography, Button, FormControlLabel, Checkbox } from '@mui/material'
import type { ActuateChannel } from './ModuleActuatePanel'

interface Props {
    valveSlots: number[]
    channels: ActuateChannel[]
    activeChannels: Set<number>
    cpv: number
    mountedValves?: number[]
    selectAll: () => void
    deselectAll: () => void
    toggleValveSlot: (slotIdx: number) => void
    toggleChannel: (ch: number) => void
    isSlotFullySelected: (slotIdx: number) => boolean
    isSlotPartiallySelected: (slotIdx: number) => boolean
}

export default function ModuleActuateValveList({
    valveSlots, channels, activeChannels, cpv, mountedValves,
    selectAll, deselectAll, toggleValveSlot, toggleChannel,
    isSlotFullySelected, isSlotPartiallySelected
}: Props) {
    return (
        <>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', flex: 1 }}>
                    Valve Slots ({valveSlots.length} slots, {cpv}c/valve)
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

            <Box sx={{ maxHeight: 280, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {valveSlots.map(slotIdx => {
                    const full = isSlotFullySelected(slotIdx)
                    const partial = isSlotPartiallySelected(slotIdx)
                    const isMounted = mountedValves ? mountedValves.includes(slotIdx) : true
                    return (
                        <Box key={slotIdx} sx={{
                            mb: 1, pl: 1, py: 0.5,
                            borderLeft: 3,
                            borderColor: full ? 'primary.main' : partial ? 'warning.main' : 'divider',
                            borderRadius: '0 4px 4px 0',
                            bgcolor: full ? 'action.selected' : partial ? 'action.hover' : 'transparent',
                        }}>
                            {/* Valve slot header */}
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={full}
                                        indeterminate={partial}
                                        onChange={() => toggleValveSlot(slotIdx)}
                                        sx={{ p: 0.25 }}
                                    />
                                }
                                label={
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                                        Valve {slotIdx + 1}
                                        {!isMounted && (
                                            <span style={{ color: '#e65100', marginLeft: 3, fontWeight: 400 }}>(unmounted)</span>
                                        )}
                                        <span style={{ color: 'text.secondary', marginLeft: 6, fontWeight: 400 }}>
                                            ch{slotIdx * cpv}–{slotIdx * cpv + cpv - 1}
                                        </span>
                                    </Typography>
                                }
                                sx={{ display: 'flex', ml: 0, mr: 0 }}
                            />
                            {/* Per-coil sub-checkboxes — always enabled, independent */}
                            <Box sx={{ ml: 4, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                {channels.reduce<React.ReactNode[]>((acc, ch) => {
                                    if (ch.valveIndex === slotIdx) {
                                        acc.push(
                                            <FormControlLabel
                                                key={ch.index}
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={activeChannels.has(ch.index)}
                                                        onChange={() => toggleChannel(ch.index)}
                                                        sx={{ p: 0.25 }}
                                                    />
                                                }
                                                label={
                                                    <Typography variant="caption" sx={{ fontSize: '0.62rem' }}>
                                                        {ch.label}
                                                        <span style={{ color: 'text.secondary', marginLeft: 2 }}>[{ch.index}]</span>
                                                    </Typography>
                                                }
                                                sx={{ display: 'flex', ml: 0, mr: 0 }}
                                            />
                                        )
                                    }
                                    return acc
                                }, [])}
                            </Box>
                        </Box>
                    )
                })}
            </Box>
        </>
    )
}
