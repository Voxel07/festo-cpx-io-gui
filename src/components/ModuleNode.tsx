import { memo, Fragment, useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { Box, Typography, Chip, Tooltip, IconButton } from '@mui/material'
import type { ChipOwnProps } from '@mui/material'
import { useSvgMap, resolveIcon } from '../hooks/useSvgMap'
import { useSvgPorts } from '../hooks/useSvgPorts'
import type { PortKind } from '../hooks/useSvgPorts'
import { useValveGroups } from '../hooks/useValveGroups'
import { useModifiedSvg } from '../hooks/useModifiedSvg'
import type { TopologyModule, DiffStatusKind, ConnectionEntry } from '../types'
import ValveEditorDialog from './ValveEditorDialog'

// ─── Status styles ────────────────────────────────────────────────────────────

export const STATUS_STYLE: Record<DiffStatusKind, { border: string; bg: string; chip: ChipOwnProps['color'] }> = {
    unchanged: { border: '#1976d2', bg: '#e3f2fd', chip: 'primary' },
    changed: { border: '#ed6c02', bg: '#fff3e0', chip: 'warning' },
    added: { border: '#2e7d32', bg: '#e8f5e9', chip: 'success' },
    removed: { border: '#d32f2f', bg: '#ffebee', chip: 'error' },
}

// ─── Port kind colours ────────────────────────────────────────────────────────

const PORT_COLOR: Record<PortKind, string> = {
    in: '#1565c0',   // blue  – digital/analog input
    out: '#2e7d32',   // green – digital/analog output
    inout: '#ff9800',   // amber – bidirectional / unknown
}

// ─── Node data type ───────────────────────────────────────────────────────────

export type ModuleNodeData = {
    mod: TopologyModule
    status: DiffStatusKind
    editMode: boolean
    /** AP-A backplane or VABX valve body – rendered without card border/shadow */
    isBackplane: boolean
    showLeftHandle: boolean
    showRightHandle: boolean
    /** Show valve editor button (VABX body modules in ConnectionsFlow) */
    showValveEditor?: boolean
    /** Valve slot group IDs that are hidden (empty, not mounted) */
    hiddenValves?: string[]
    /** IO connections for this module, populated by ConnectionsFlow */
    connections?: ConnectionEntry[]
    /** Suppress all IO port handles (valve bodies have no external M12 connectors) */
    suppressIoHandles?: boolean
    /** Called when the user changes which valves are mounted; indices are 0-based */
    onValveChange?: (addr: number, mountedValves: number[]) => void
}

export type ModuleNodeType = Node<ModuleNodeData, 'mod'>

// ─── SVG dimensions ───────────────────────────────────────────────────────────

const DISP_W = 60
const DISP_H = Math.round(DISP_W * (107 / 50))   // proportional to viewBox 50×107

const PORT_D = 11
const PORT_HIT_D = 20

function pct(i: number, total: number) {
    return `${((i + 1) / (total + 1)) * 100}%`
}

// ─── Component ────────────────────────────────────────────────────────────────

function ModuleNode({ id: nodeId, data }: NodeProps<ModuleNodeType>) {
    const {
        mod, status, editMode, isBackplane,
        showLeftHandle, showRightHandle,
        showValveEditor = false,
        suppressIoHandles = false,
        hiddenValves = [],
        connections = [],
        onValveChange,
    } = data

    const svgMaps = useSvgMap()
    const svgUrl = resolveIcon(mod.Name, svgMaps, mod.Modulecode)
    const ports = useSvgPorts(svgUrl, {
        numIn:    mod.NumOfInputs,
        numOut:   mod.NumOfOutputs,
        numInOut: mod.NumOfInOuts,
    })
    const valveGroups = useValveGroups(showValveEditor ? svgUrl : '')
    const displayUrl = useModifiedSvg(svgUrl, hiddenValves)

    const [valveEditorOpen, setValveEditorOpen] = useState(false)
    const { setNodes } = useReactFlow()

    const st = STATUS_STYLE[status] ?? STATUS_STYLE.unchanged
    const hasPorts = ports.length > 0
    const numOut = mod.NumOfOutputs
    const numIn = mod.NumOfInputs
    const numInOut = mod.NumOfInOuts
    const topCount = numOut + numInOut
    const botCount = numIn + numInOut

    function onToggleValve(valveId: string, hide: boolean) {
        setNodes(prev => prev.map(n => {
            if (n.id !== nodeId) return n
            const cur = (n.data as ModuleNodeData).hiddenValves ?? []
            const next = hide
                ? [...cur.filter(v => v !== valveId), valveId]
                : cur.filter(v => v !== valveId)
            // Compute 0-based mounted indices and propagate to topology
            const mounted = valveGroups
                .map((gid, idx) => ({ gid, idx }))
                .filter(({ gid }) => !next.includes(gid))
                .map(({ idx }) => idx)
            onValveChange?.(mod.Adress, mounted)
            return { ...n, data: { ...n.data, hiddenValves: next } }
        }))
    }

    return (
        <Box sx={{
            border: isBackplane ? 'none' : `2px solid ${st.border}`,
            background: isBackplane ? 'transparent' : st.bg,
            boxShadow: isBackplane ? 'none' : '0 2px 6px rgba(0,0,0,0.14)',
            borderRadius: 1.5,
            p: isBackplane ? '2px 0' : '4px 4px 6px',
            width: DISP_W + (isBackplane ? 0 : 8),
            textAlign: 'center',
            position: 'relative',
        }}>

            {/* ── Left / Right cable handles ── */}
            {showLeftHandle && (
                <Handle id="left" type="target" position={Position.Left}
                    style={{ background: '#546e7a', width: 10, height: 10, border: '2px solid #fff' }} />
            )}
            {showRightHandle && (
                <Handle id="right" type="source" position={Position.Right}
                    style={{ background: '#546e7a', width: 10, height: 10, border: '2px solid #fff' }} />
            )}

            {/* ── Generic fallback IO handles (edit mode, not suppressed) ── */}
            {editMode && !suppressIoHandles && !hasPorts && Array.from({ length: topCount }, (_, i) => (
                <Handle key={`fo-${i}`} id={`src-out-out${i}`} type="source" position={Position.Top}
                    style={{
                        left: pct(i, topCount), background: PORT_COLOR.out,
                        width: 9, height: 9, border: '2px solid #fff', borderRadius: '50%', top: -5
                    }} />
            ))}
            {editMode && !suppressIoHandles && !hasPorts && Array.from({ length: botCount }, (_, i) => (
                <Handle key={`fi-${i}`} id={`tgt-in-in${i}`} type="target" position={Position.Bottom}
                    style={{
                        left: pct(i, botCount), background: PORT_COLOR.in,
                        width: 9, height: 9, border: '2px solid #fff', borderRadius: '50%', bottom: -5
                    }} />
            ))}

            {/* ── SVG image container ── */}
            <Box sx={{ position: 'relative', width: DISP_W, height: DISP_H, margin: '0 auto' }}>
                <Tooltip title={mod.Name} placement="top" arrow>
                    <img
                        src={displayUrl}
                        alt={mod.Name}
                        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
                        onError={e => { (e.target as HTMLImageElement).src = '/svg/CPX-AP-A_Generic.svg' }}
                    />
                </Tooltip>

                {/* ── Status bar (backplane modules only) ── */}
                {isBackplane && (
                    <Box sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                        background: st.border, borderRadius: '0 0 2px 2px',
                    }} />
                )}

                {/* ── SVG-port handles (edit mode, not suppressed) ── */}
                {editMode && !suppressIoHandles && hasPorts && ports.map(port => {
                    const portColor = PORT_COLOR[port.kind]
                    return (
                        <Fragment key={port.id}>
                            {/* Coloured source handle – kind encoded in ID for validation */}
                            <Handle
                                id={`src-${port.kind}-${port.id}`}
                                type="source"
                                position={port.side}
                                style={{
                                    position: 'absolute',
                                    left: `${port.cx * 100}%`,
                                    top: `${port.cy * 100}%`,
                                    transform: 'translate(-50%,-50%)',
                                    width: PORT_D, height: PORT_D,
                                    background: portColor,
                                    border: '2.5px solid #fff',
                                    borderRadius: '50%',
                                    boxShadow: `0 0 0 2px ${portColor}`,
                                    zIndex: 10,
                                    cursor: 'crosshair',
                                }}
                            />
                            {/* Transparent target hit-area – kind also encoded */}
                            <Handle
                                id={`tgt-${port.kind}-${port.id}`}
                                type="target"
                                position={port.side}
                                style={{
                                    position: 'absolute',
                                    left: `${port.cx * 100}%`,
                                    top: `${port.cy * 100}%`,
                                    transform: 'translate(-50%,-50%)',
                                    width: PORT_HIT_D, height: PORT_HIT_D,
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '50%',
                                    opacity: 0,
                                }}
                            />
                        </Fragment>
                    )
                })}
            </Box>

            {/* ── Module name ── */}
            <Typography sx={{
                fontSize: '0.5rem', fontWeight: 700, wordBreak: 'break-all',
                mt: 0.25, lineHeight: 1.15, color: isBackplane ? '#444' : 'inherit',
            }}>
                {mod.Name}
            </Typography>

            {/* ── Type chip (non-backplane only) ── */}
            {!isBackplane && (
                <Chip label={mod.Type} size="small" color={st.chip} variant="outlined"
                    sx={{ fontSize: '0.46rem', height: 13, mt: 0.25, '& .MuiChip-label': { px: '3px' } }}
                />
            )}

            {/* ── Channel counts ── */}
            <Typography sx={{ fontSize: '0.44rem', color: '#666', mt: 0.15, lineHeight: 1 }}>
                {numIn > 0 && <span style={{ color: PORT_COLOR.in }}>↓{numIn} </span>}
                {numOut > 0 && <span style={{ color: PORT_COLOR.out }}>↑{numOut} </span>}
                {numInOut > 0 && <span style={{ color: PORT_COLOR.inout }}>⇅{numInOut}</span>}
            </Typography>

            {/* ── Connection list (edit mode, whenever wires are drawn) ── */}
            {connections.length > 0 && (
                <Box sx={{
                    mt: 0.5, pt: 0.25, borderTop: '1px solid rgba(0,0,0,0.1)',
                    textAlign: 'left',
                }}>
                    {connections.map((c, idx) => (
                        <Typography key={idx} sx={{
                            fontSize: '0.42rem', lineHeight: 1.4,
                            color: c.dir === 'src' ? PORT_COLOR.out : PORT_COLOR.in,
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                            {c.dir === 'src' ? '↑' : '↓'} {c.portId}
                            {c.dir === 'src' ? '→' : '←'} #{c.peerAddr}:{c.peerPort}
                        </Typography>
                    ))}
                </Box>
            )}

            {/* ── Valve editor button (VABX body modules in edit mode) ── */}
            {showValveEditor && (
                <>
                    <Tooltip title="Configure mounted valves" placement="top">
                        <IconButton size="small"
                            onClick={() => setValveEditorOpen(true)}
                            sx={{
                                position: 'absolute', top: 2, right: 2,
                                width: 16, height: 16, fontSize: '0.6rem',
                                color: '#546e7a',
                                background: 'rgba(255,255,255,0.85)',
                                '&:hover': { background: '#e3f2fd', color: '#1565c0' },
                            }}>
                            ⚙
                        </IconButton>
                    </Tooltip>
                    {valveEditorOpen && (
                        <ValveEditorDialog
                            open={valveEditorOpen}
                            svgUrl={svgUrl}
                            hiddenValves={hiddenValves}
                            onToggle={onToggleValve}
                            onClose={() => setValveEditorOpen(false)}
                        />
                    )}
                    {/* suppress unused-warning for valveGroups (loaded for the dialog) */}
                    {valveGroups.length >= 0 && null}
                </>
            )}
        </Box>
    )
}

export default memo(ModuleNode)
