import { useState, useEffect } from 'react'
import {
    Button, Typography, Box, Divider, Chip, CircularProgress,
    Stack, FormControlLabel, Checkbox, Alert, Switch,
} from '@mui/material'
import type { TopologyModule } from '../types'
import { channelsPerValve, valveSlotToChannels } from '../utils/valveChannels'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActuateChannel {
    /** Logical label, e.g. "Valve 1 (coil A)" or "X0 ch0" */
    label: string
    /** 0-based hardware channel index sent to the hardware */
    index: number
    /** Parent valve slot index, or -1 for non-valve channels */
    valveIndex: number
    /** Sub-channel within the valve slot (0 = coil A, 1 = coil B) */
    subChannel: number
}

interface Props {
    /** The module being actuated */
    module: TopologyModule | null
    /** IP address of the CPX-AP gateway */
    ip: string
    /** 0-based indices of mounted valve slots (VABX valve bodies only) */
    mountedValves?: number[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isM12 = (name?: string) => !!(name ?? '').includes('M12')
const isValveBody = (name?: string) => /VABX-A-(?:S-)?(BV|SBV|VE|VP)/.test(name ?? '')
const isValveInterface = (name?: string) => !!(name ?? '').startsWith('VABX-A') && /-E[LP][-_]/.test(name ?? '')

function buildChannels(
    mod: TopologyModule,
    mountedValves?: number[],
    includeUnmounted = false,
): ActuateChannel[] {
    const name = mod.Name

    // ── Valve body: each slot → N hardware channels ──
    if (isValveBody(name)) {
        const cpv = channelsPerValve(name)
        const mountedSet = new Set(mountedValves ?? [])
        // Determine number of valve slots from NumOfOutputs / cpv
        const totalValves = mod.NumOfOutputs > 0
            ? Math.floor(mod.NumOfOutputs / cpv)
            : 4 // fallback: assume 4 valves

        const slots = includeUnmounted
            ? Array.from({ length: totalValves }, (_, i) => i)
            : (mountedValves && mountedValves.length > 0
                ? mountedValves
                : Array.from({ length: totalValves }, (_, i) => i))

        const channels: ActuateChannel[] = []
        for (const slotIdx of slots) {
            const hwChannels = valveSlotToChannels(slotIdx, cpv)
            const isMounted = mountedSet.has(slotIdx)
            for (let sub = 0; sub < hwChannels.length; sub++) {
                const coil = cpv > 1 ? (sub === 0 ? 'A' : 'B') : ''
                channels.push({
                    label: `Valve ${slotIdx + 1}${coil ? ` (coil ${coil})` : ''}`,
                    index: hwChannels[sub],
                    valveIndex: slotIdx,
                    subChannel: sub,
                })
            }
        }
        return channels
    }

    // ── Regular output / inout module: enumerate by port ──
    const cpp = isM12(name) ? 2 : 1
    const channels: ActuateChannel[] = []

    for (let i = 0; i < mod.NumOfOutputs; i++) {
        const portIdx = Math.floor(i / cpp)
        const sub = cpp > 1 ? i % cpp : 0
        channels.push({
            label: cpp > 1 ? `X${portIdx} ch${sub}` : `X${portIdx}`,
            index: i,
            valveIndex: -1,
            subChannel: sub,
        })
    }
    const inoutStart = mod.NumOfOutputs
    for (let i = 0; i < mod.NumOfInOuts; i++) {
        const portIdx = Math.floor((inoutStart + i) / cpp)
        const sub = cpp > 1 ? (inoutStart + i) % cpp : 0
        channels.push({
            label: cpp > 1 ? `X${portIdx} ch${sub}` : `X${portIdx}`,
            index: inoutStart + i,
            valveIndex: -1,
            subChannel: sub,
        })
    }

    return channels
}

export default function ModuleActuatePanel({ module: mod, ip, mountedValves }: Props) {
    const [busy, setBusy] = useState(false)
    const [statusMsg, setStatusMsg] = useState<{ text: string; severity: 'success' | 'error' | 'info' } | null>(null)
    const [includeUnmounted, setIncludeUnmounted] = useState(false)

    // Single source of truth: which hardware channels are selected.
    const [selectedChannels, setSelectedChannels] = useState<Set<number> | null>(null)



    const channels = mod ? buildChannels(mod, mountedValves, includeUnmounted) : []
    const isValve = mod ? isValveBody(mod.Name) : false
    const cpv = mod ? channelsPerValve(mod.Name) : 2
    const allChannelIndices = channels.map(c => c.index)

    // Unique valve slots present in the current channel list
    const valveSlots = (() => {
        const slotsSet = new Set<number>()
        for (const c of channels) {
            if (c.valveIndex >= 0) slotsSet.add(c.valveIndex)
        }
        return Array.from(slotsSet).sort((a, b) => a - b)
    })()

    // ── Derived: active channel set ──
    const activeChannels: Set<number> = selectedChannels ?? new Set(allChannelIndices)
    const totalHwChannels = channels.length
    const countChannels = activeChannels.size
    const allChannelsSelected = countChannels === totalHwChannels && totalHwChannels > 0
    const noneChannelsSelected = countChannels === 0

    // For valve modules: derive per-slot state from activeChannels
    function slotChannelIndices(slotIdx: number): number[] {
        const indices: number[] = []
        for (const c of channels) {
            if (c.valveIndex === slotIdx) indices.push(c.index)
        }
        return indices
    }
    function isSlotFullySelected(slotIdx: number): boolean {
        const sc = slotChannelIndices(slotIdx)
        return sc.length > 0 && sc.every(i => activeChannels.has(i))
    }
    function isSlotPartiallySelected(slotIdx: number): boolean {
        const sc = slotChannelIndices(slotIdx)
        return sc.some(i => activeChannels.has(i)) && !sc.every(i => activeChannels.has(i))
    }

    // ── Select / deselect all ──
    function selectAll() {
        setSelectedChannels(new Set(allChannelIndices))
    }
    function deselectAll() {
        setSelectedChannels(new Set())
    }

    // Toggle a single channel
    function toggleChannel(ch: number) {
        setSelectedChannels(prev => {
            const base = prev ?? new Set(allChannelIndices)
            const next = new Set(base)
            if (next.has(ch)) {
                next.delete(ch)
            } else {
                next.add(ch)
            }
            return next
        })
    }

    // Toggle all channels for a valve slot
    function toggleValveSlot(slotIdx: number) {
        setSelectedChannels(prev => {
            const base = prev ?? new Set(allChannelIndices)
            const next = new Set(base)
            const sc = slotChannelIndices(slotIdx)
            const allIn = sc.every(i => base.has(i))
            for (const i of sc) {
                if (allIn) {
                    next.delete(i)
                } else {
                    next.add(i)
                }
            }
            return next
        })
    }

    async function setOutputs(value: boolean) {
        if (!mod || !ip) return

        const indices = value
            ? [...activeChannels]
            : (noneChannelsSelected ? allChannelIndices : [...activeChannels])

        if (indices.length === 0) {
            setStatusMsg({ text: 'No channels available.', severity: 'error' })
            return
        }

        const payload: Record<string, unknown> = {
            ip_address: ip,
            module_addr: mod.Adress,
            value,
            module_name: mod.Name,
            channels: indices,
        }

        setBusy(true)
        setStatusMsg(null)
        try {
            const r = await fetch('/io/set-all-outputs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const d = await r.json()
            if (!r.ok) {
                setStatusMsg({ text: `Error: ${d.detail ?? `HTTP ${r.status}`}`, severity: 'error' })
                setBusy(false)
                return
            }
            const count = (d.channels_written as unknown[] ?? []).length
            const allWord = allChannelsSelected ? 'All ' : ''
            setStatusMsg({
                text: value
                    ? `✓ ${allWord}${count} channel(s) set HIGH — auto-reset in ${d.auto_reset_s ?? '?'}s`
                    : `✓ ${allWord}${count} channel(s) set LOW`,
                severity: 'success',
            })
            setBusy(false)
        } catch (e) {
            setStatusMsg({ text: `Error: ${(e as Error).message}`, severity: 'error' })
            setBusy(false)
        }
    }

    if (!mod) {
        return (
            <Typography variant="body2" color="text.secondary">
                Select a module to actuate outputs.
            </Typography>
        )
    }

    const isIface = isValveInterface(mod.Name)

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Module info header */}
            <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {mod.Name}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
                    <Chip
                        label={`#${mod.Adress}`}
                        size="small" color="primary"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                    <Chip
                        label={isValve ? 'Valve Body' : isIface ? 'Valve Interface' : mod.NumOfInOuts > 0 ? 'I/O' : mod.NumOfOutputs > 0 ? 'Output' : 'Input'}
                        size="small" variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                    {mod.ProductKey && (
                        <Typography variant="caption" sx={{ color: '#999', fontSize: '0.6rem' }}>
                            {mod.ProductKey}
                        </Typography>
                    )}
                </Stack>
            </Box>

            <Divider />

            {/* ── Unmounted valve toggle ────────────────────── */}
            {isValve && (
                <FormControlLabel
                    control={
                        <Switch
                            size="small"
                            checked={includeUnmounted}
                            onChange={(_e, checked) => setIncludeUnmounted(checked)}
                        />
                    }
                    label={
                        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            Show unmounted valve slots
                        </Typography>
                    }
                    sx={{ mb: 0, ml: 0 }}
                />
            )}

            {/* ── Channel / Valve list ──────────────────────── */}
            {channels.length === 0 ? (
                <Alert severity="info" sx={{ fontSize: '0.75rem', py: 0 }}>
                    This module has no writable output channels.
                    {isValve && mountedValves && mountedValves.length === 0 && !includeUnmounted
                        && ' Enable "Show unmounted valve slots" or use the valve editor to mount valves first.'}
                </Alert>
            ) : (
                <>
                    {isValve ? (
                        <>
                            {/* ── Valve slot + per-channel selection ───── */}
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

                            <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                                {valveSlots.map(slotIdx => {
                                    const full = isSlotFullySelected(slotIdx)
                                    const partial = isSlotPartiallySelected(slotIdx)
                                    const isMounted = mountedValves ? mountedValves.includes(slotIdx) : true
                                    return (
                                        <Box key={slotIdx} sx={{
                                            mb: 1, pl: 1, py: 0.5,
                                            borderLeft: `3px solid ${full ? '#1976d2' : partial ? '#ff9800' : '#e0e0e0'}`,
                                            borderRadius: '0 4px 4px 0',
                                            background: full ? '#f5f8ff' : partial ? '#fff8e1' : 'transparent',
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
                                                        <span style={{ color: '#bbb', marginLeft: 6, fontWeight: 400 }}>
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
                                                                        <span style={{ color: '#bbb', marginLeft: 2 }}>[{ch.index}]</span>
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
                    ) : (
                        <>
                            {/* ── Non-valve channel selection ────────── */}
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

                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 150, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
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
                                                    <span style={{ color: '#bbb', marginLeft: 4 }}>ch{ch.index}</span>
                                                </Typography>
                                            }
                                            sx={{ display: 'flex', ml: 0, mr: 0, minWidth: 100 }}
                                        />
                                    )
                                })}
                            </Box>
                        </>
                    )}

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                        {allChannelsSelected
                            ? `All ${totalHwChannels} channel(s).`
                            : noneChannelsSelected
                                ? 'No channels selected.'
                                : `${countChannels} of ${totalHwChannels} channel(s) selected.`}
                    </Typography>
                </>
            )}

            {/* ── Action buttons ────────────────────────────────── */}
            <Stack direction="row" spacing={1}>
                <Button
                    variant="contained"
                    color="error"
                    onClick={() => setOutputs(true)}
                    disabled={busy || !ip || noneChannelsSelected}
                    sx={{ fontSize: '0.75rem', py: 0.6, flex: 1 }}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    {allChannelsSelected ? 'All ON' : `Turn ON (${countChannels})`}
                </Button>
                <Button
                    variant="contained"
                    color="inherit"
                    onClick={() => setOutputs(false)}
                    disabled={busy || !ip || totalHwChannels === 0}
                    sx={{ fontSize: '0.75rem', py: 0.6, flex: 1, bgcolor: '#546e7a', color: '#fff', '&:hover': { bgcolor: '#455a64' } }}
                >
                    {noneChannelsSelected ? 'All OFF' : allChannelsSelected ? 'All OFF' : `Turn OFF (${countChannels})`}
                </Button>
            </Stack>

            {statusMsg && (
                <Alert
                    severity={statusMsg.severity}
                    onClose={() => setStatusMsg(null)}
                    sx={{ py: 0, fontSize: '0.7rem' }}
                >
                    {statusMsg.text}
                </Alert>
            )}
        </Box>
    )
}
