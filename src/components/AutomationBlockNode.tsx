import { memo } from 'react'
import { Box, Chip, Paper, Stack, Typography, useTheme } from '@mui/material'
import {
    AccessTime,
    Air,
    CallSplit,
    ElectricMeter,
    ElectricBolt,
    Filter9Plus,
    Input,
    Notes,
    Output,
    SettingsInputComponent,
    Speed,
    Thermostat,
} from '@mui/icons-material'
import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import type { AutomationBlockType, AutomationNode } from './automationTypes'

const COLORS: Record<AutomationBlockType, string> = {
    input: '#0288d1',
    temperature: '#e53935',
    voltage: '#f9a825',
    pressure: '#00838f',
    timer: '#3949ab',
    delay: '#7b1fa2',
    counter: '#6a1b9a',
    and: '#5d4037',
    or: '#5d4037',
    not: '#5d4037',
    output: '#ef6c00',
    valve: '#d32f2f',
    cylinder: '#00897b',
    comment: '#616161',
}

const ICONS = {
    input: Input,
    temperature: Thermostat,
    voltage: ElectricMeter,
    pressure: Speed,
    timer: AccessTime,
    delay: AccessTime,
    counter: Filter9Plus,
    and: CallSplit,
    or: CallSplit,
    not: CallSplit,
    output: Output,
    valve: Air,
    cylinder: SettingsInputComponent,
    comment: Notes,
} satisfies Record<AutomationBlockType, typeof ElectricBolt>

function Port({ type, id, top, label }: {
    type: 'source' | 'target'
    id: string
    top: string
    label?: string
}) {
    const right = type === 'source'
    return (
        <>
            <Handle
                type={type}
                id={id}
                position={right ? Position.Right : Position.Left}
                style={{ top, width: 12, height: 12, background: '#fff', border: '2px solid #455a64', zIndex: 3 }}
            />
            {label && (
                <Typography sx={{
                    position: 'absolute',
                    top,
                    transform: 'translateY(-50%)',
                    [right ? 'right' : 'left']: 17,
                    maxWidth: 48,
                    px: .25,
                    fontSize: 9,
                    lineHeight: 1.15,
                    textAlign: right ? 'right' : 'left',
                    whiteSpace: 'nowrap',
                    opacity: 0.78,
                    bgcolor: 'background.paper',
                    pointerEvents: 'none',
                    zIndex: 2,
                }}>
                    {label}
                </Typography>
            )}
        </>
    )
}

function AutomationBlockNodeComponent({ data, type, selected }: NodeProps<AutomationNode>) {
    const theme = useTheme()
    const blockType = type as AutomationBlockType
    const Icon = ICONS[blockType]
    const iecLogicSymbol = blockType === 'and' ? '&' : blockType === 'or' ? '≥1' : null
    const runtime = data.runtime ?? {}
    const active = Boolean(runtime.signal || runtime.state || (blockType === 'delay' && runtime.pending))
    const subtitle = (() => {
        if (blockType === 'input') return `M${data.module_addr ?? '?'} · I${data.channel ?? '?'}`
        if (blockType === 'temperature' || blockType === 'voltage' || blockType === 'pressure') {
            const unit = blockType === 'temperature' ? '°C' : blockType === 'voltage' ? 'V' : 'bar'
            const limit = Number(data.limit ?? (blockType === 'temperature' ? 25 : blockType === 'voltage' ? 5 : 6))
            return typeof runtime.value === 'number'
                ? `${runtime.value.toFixed(2)} ${unit} · limit ${limit} ${unit}`
                : `M${data.module_addr ?? '?'} · AI${data.channel ?? '?'} · ≥ ${limit} ${unit}`
        }
        if (blockType === 'timer') {
            const configured = data.repeat
                ? `after ${data.initial_delay_ms ?? 1000} ms · every ${data.interval_ms ?? 1000} ms`
                : `once after ${data.initial_delay_ms ?? 1000} ms`
            return typeof runtime.remaining_ms === 'number' ? `${Math.ceil(runtime.remaining_ms)} ms remaining` : configured
        }
        if (blockType === 'counter') return `${runtime.count ?? 0} / ${data.events_per_toggle ?? 3} events`
        if (blockType === 'output') return `M${data.module_addr ?? '?'} · Q${data.channel ?? '?'} · ${data.action ?? 'toggle'}`
        if (blockType === 'valve') return `M${data.module_addr ?? '?'} · coil ${data.channel ?? '?'} · ${data.action ?? 'toggle'}`
        if (blockType === 'delay') return `${data.delay_ms ?? 1000} ms`
        if (blockType === 'cylinder') return `${data.travel_time_s ?? 1}s stroke`
        if (blockType === 'comment') return String(data.text ?? 'Double-click to edit')
        return blockType.toUpperCase()
    })()
    const position = Number(runtime.position ?? 0)

    return (
        <Paper
            elevation={selected ? 8 : 2}
            sx={{
                width: blockType === 'comment' ? 240 : 220,
                minHeight: blockType === 'cylinder' ? 122 : 96,
                border: 2,
                borderColor: selected ? 'primary.main' : active ? COLORS[blockType] : 'divider',
                overflow: 'visible',
                bgcolor: active ? `${COLORS[blockType]}18` : 'background.paper',
                transition: 'border-color .15s, background-color .15s',
            }}
        >
            {!['input', 'temperature', 'voltage', 'timer', 'comment', 'and', 'or'].includes(blockType) && <Port type="target" id={blockType === 'cylinder' ? 'extend' : 'trigger'} top="50%" label={blockType === 'cylinder' ? 'extend' : undefined} />}
            {['and', 'or'].includes(blockType) && <><Port type="target" id="input-a" top="40%" /><Port type="target" id="input-b" top="72%" /></>}
            {blockType === 'cylinder' && <Port type="target" id="retract" top="75%" label="retract" />}
            {blockType === 'input' && <><Port type="source" id="state" top="57%" label="state" /><Port type="source" id="signal" top="82%" label="event" /></>}
            {['temperature', 'voltage'].includes(blockType) && <Port type="source" id="signal" top="57%" label="≥ limit" />}
            {blockType === 'pressure' && <Port type="source" id="signal" top="57%" label="qualified" />}
            {['timer', 'delay', 'counter', 'not'].includes(blockType) && <Port type="source" id="signal" top="50%" />}
            {['and', 'or'].includes(blockType) && <Port type="source" id="signal" top="56%" />}
            {blockType === 'valve' && <><Port type="source" id="extend" top="57%" label="extend" /><Port type="source" id="retract" top="82%" label="retract" /></>}
            {blockType === 'cylinder' && <><Port type="source" id="extended-event" top="34%" label="end +" /><Port type="source" id="retracted-event" top="68%" label="end −" /></>}

            <Box sx={{ height: 8, bgcolor: COLORS[blockType], borderRadius: '5px 5px 0 0' }} />
            <Stack direction="row" spacing={1} sx={{
                p: 1.25,
                pr: ['input', 'temperature', 'voltage', 'pressure', 'valve', 'cylinder'].includes(blockType) ? 7 : 1.25,
                minHeight: blockType === 'cylinder' ? 62 : 84,
                alignItems: 'center',
            }}>
                {iecLogicSymbol ? (
                    <Box sx={{ minWidth: 34, height: 34, border: 2, borderColor: COLORS[blockType], display: 'grid', placeItems: 'center' }}>
                        <Typography component="span" sx={{ color: COLORS[blockType], fontWeight: 800, fontSize: 17, lineHeight: 1 }}>{iecLogicSymbol}</Typography>
                    </Box>
                ) : <Icon fontSize="small" sx={{ color: COLORS[blockType] }} />}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" noWrap>{data.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{subtitle}</Typography>
                </Box>
                {active && <Chip label="LIVE" color="success" size="small" sx={{ height: 18, fontSize: 9 }} />}
            </Stack>
            {blockType === 'cylinder' && (
                <Box sx={{ mx: 1.2, mb: 1.2, height: 22, border: 1, borderColor: 'divider', borderRadius: 1, position: 'relative', bgcolor: theme.palette.action.hover }}>
                    <Box sx={{ position: 'absolute', left: 2, top: 2, bottom: 2, width: 28, bgcolor: COLORS.cylinder, borderRadius: .5, transform: `translateX(${position * 128}px)`, transition: 'transform 80ms linear' }} />
                    <Box sx={{ position: 'absolute', left: 30, top: 9, height: 3, width: 130, bgcolor: 'text.secondary' }} />
                </Box>
            )}
        </Paper>
    )
}

export const AutomationBlockNode = memo(AutomationBlockNodeComponent)

export const automationNodeTypes: NodeTypes = Object.freeze({
    input: AutomationBlockNode,
    temperature: AutomationBlockNode,
    voltage: AutomationBlockNode,
    pressure: AutomationBlockNode,
    timer: AutomationBlockNode,
    delay: AutomationBlockNode,
    counter: AutomationBlockNode,
    and: AutomationBlockNode,
    or: AutomationBlockNode,
    not: AutomationBlockNode,
    output: AutomationBlockNode,
    valve: AutomationBlockNode,
    cylinder: AutomationBlockNode,
    comment: AutomationBlockNode,
})
