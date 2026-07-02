import { memo, Fragment, useState, useEffect, useMemo } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { Box, Typography, Tooltip, IconButton } from '@mui/material'
import type { ChipOwnProps } from '@mui/material'
import Stack from '@mui/material/Stack'
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
    /** EPLI module: show AP-in handle on top */
    showApIn?: boolean
    /** EPLI module: show AP-out handle on bottom */
    showApOut?: boolean
    /** Override handle position for AP-in (percentage within SVG image box); defaults to EPLI positions */
    apInPos?: { top: string; left: string }
    /** Override handle position for AP-out (percentage within SVG image box); defaults to EPLI positions */
    apOutPos?: { top: string; left: string }
    /** Show valve editor button (VABX body modules in ConnectionsFlow) */
    showValveEditor?: boolean
    /** Show mounted valves visually without editor UI (read-only topology view) */
    showValves?: boolean
    /** Valve slot group IDs that are hidden (empty, not mounted) */
    hiddenValves?: string[]
    /** IO connections for this module, populated by ConnectionsFlow */
    connections?: ConnectionEntry[]
    /** Suppress all IO port handles (valve bodies have no external M12 connectors) */
    suppressIoHandles?: boolean
    /** Called when the user changes which valves are mounted or total slots; indices are 0-based */
    onValveChange?: (addr: number, mountedValves: number[], valveSlots?: number) => void
    /** True when this module is currently being tested (pulse highlight) */
    active?: boolean
    /** Show VABX module inputs based on parameter 20201 */
    hasVabxInputs?: boolean
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

function getGenericOutStyle(index: number, total: number, editMode: boolean): React.CSSProperties {
    return {
        left: pct(index, total),
        background: editMode ? PORT_COLOR.out : 'transparent',
        width: PORT_D,
        height: PORT_D,
        border: editMode ? '2px solid #fff' : 'none',
        borderRadius: '50%',
        top: -5,
        opacity: editMode ? 1 : 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

function getGenericInStyle(index: number, total: number, editMode: boolean): React.CSSProperties {
    return {
        left: pct(index, total),
        background: editMode ? PORT_COLOR.in : 'transparent',
        width: PORT_D,
        height: PORT_D,
        border: editMode ? '2px solid #fff' : 'none',
        borderRadius: '50%',
        bottom: -5,
        opacity: editMode ? 1 : 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

function getApInStyle(left?: string, top?: string): React.CSSProperties {
    return {
        position: 'absolute',
        left: left ?? '50%',
        top: top ?? '37.85%',
        transform: 'translate(-50%,-50%)',
        width: 10,
        height: 10,
        background: '#1565c0',
        border: '2.5px solid #fff',
        borderRadius: '50%',
        boxShadow: '0 0 0 2px #1565c0',
        zIndex: 10,
    }
}

function getApOutStyle(left?: string, top?: string): React.CSSProperties {
    return {
        position: 'absolute',
        left: left ?? '50%',
        top: top ?? '52.8%',
        transform: 'translate(-50%,-50%)',
        width: 10,
        height: 10,
        background: '#2e7d32',
        border: '2.5px solid #fff',
        borderRadius: '50%',
        boxShadow: '0 0 0 2px #2e7d32',
        zIndex: 10,
        cursor: 'crosshair',
    }
}

function getPortSrcStyle(cx: number, cy: number, portColor: string, editMode: boolean): React.CSSProperties {
    return {
        position: 'absolute',
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: 'translate(-50%,-50%)',
        width: PORT_D,
        height: PORT_D,
        background: editMode ? portColor : 'transparent',
        border: editMode ? '2.5px solid #fff' : 'none',
        borderRadius: '50%',
        boxShadow: editMode ? `0 0 0 2px ${portColor}` : 'none',
        zIndex: 10,
        cursor: editMode ? 'crosshair' : 'default',
        opacity: editMode ? 1 : 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

function getPortTgtStyle(cx: number, cy: number, editMode: boolean): React.CSSProperties {
    return {
        position: 'absolute',
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: 'translate(-50%,-50%)',
        width: PORT_HIT_D,
        height: PORT_HIT_D,
        background: 'transparent',
        border: 'none',
        borderRadius: '50%',
        opacity: 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

function supportsMountedValves(name: string, type: string): boolean {
    const upName = name.toUpperCase()
    if (/^VABX-A-(?:S-)?EL-E(?:12|34)-AP[IPA]\b/.test(upName)) return false
    return type === 'Valve' || upName.startsWith('VMPAL') || upName.startsWith('VAEM') || upName.startsWith('VTUX') || /VABX-A-(?:S-)?(BV|SBV|VE|VP)/.test(upName)
}

function defaultValveSlots(name: string, explicitSlots?: number): number | undefined {
    if (explicitSlots !== undefined) return explicitSlots
    const upName = name.toUpperCase()
    if (upName.startsWith('VTUX')) return 4
    if (upName.startsWith('VMPAL')) return 16
    return undefined
}

// ─── Component ────────────────────────────────────────────────────────────────

function ModuleNode({ id: nodeId, data }: NodeProps<ModuleNodeType>) {
    const {
        mod, status, editMode, isBackplane,
        showLeftHandle, showRightHandle,
        showApIn = false, showApOut = false,
        apInPos,
        apOutPos,
        showValveEditor = false,
        showValves = false,
        suppressIoHandles = false,
        hiddenValves = [],
        connections = [],
        onValveChange,
        active = false,
        hasVabxInputs = false,
    } = data

    const svgMaps = useSvgMap()
    const svgUrl = resolveIcon(mod.Name, svgMaps, mod.Modulecode)
    // Port positions come from SVG; port counts/kinds come from bench_config (mod.NumOf*)
    const ports = useSvgPorts(svgUrl, {
        numIn: mod.NumOfInputs,
        numOut: mod.NumOfOutputs,
        numInOut: mod.NumOfInOuts,
    })
    const isVmpal = mod.Name.toUpperCase().startsWith('VMPAL')
    const isVtux = mod.Name.toUpperCase().startsWith('VTUX')
    const canConfigureValves = supportsMountedValves(mod.Name, mod.Type)
    const numValves = defaultValveSlots(mod.Name, mod.ValveSlots)

    let dispW = DISP_W
    if (isVmpal && numValves !== undefined) {
        const svgW = 33 + numValves * 10
        dispW = Math.round(svgW * (DISP_H / 109))
    }

    const wantsValves = canConfigureValves && (showValveEditor || showValves)
    const valveGroups = useValveGroups(wantsValves ? svgUrl : '', numValves)

    const [valveEditorOpen, setValveEditorOpen] = useState(false)
    const updateNodeInternals = useUpdateNodeInternals()

    // Notify React Flow when SVG port handles mount/dismount so edges can resolve
    useEffect(() => {
        updateNodeInternals(nodeId)
    }, [ports, nodeId, updateNodeInternals])

    const effectiveHiddenValves = useMemo(() => {
        if (!wantsValves || valveGroups.length === 0) return []
        if (mod.MountedValves === undefined) return hiddenValves
        const mountedSet = new Set(mod.MountedValves)
        return valveGroups.filter((_, i) => !mountedSet.has(i))
    }, [hiddenValves, mod.MountedValves, valveGroups, wantsValves])
    const displayUrl = useModifiedSvg(svgUrl, effectiveHiddenValves, numValves)

    const st = STATUS_STYLE[status] ?? STATUS_STYLE.unchanged
    const hasPorts = ports.length > 0
    const numOut = mod.NumOfOutputs
    const numIn = mod.NumOfInputs
    const numInOut = mod.NumOfInOuts
    const topCount = numOut + numInOut
    const botCount = numIn + numInOut

    function setMountedValves(mounted: number[]) {
        if (onValveChange) onValveChange(mod.Adress, mounted, numValves)
    }

    function onToggleValve(valveId: string, hide: boolean) {
        const nextHidden = hide
            ? [...effectiveHiddenValves.filter(v => v !== valveId), valveId]
            : effectiveHiddenValves.filter(v => v !== valveId)
        const nextHiddenSet = new Set(nextHidden)
        const mounted = valveGroups.reduce<number[]>((acc, gid, idx) => {
            if (!nextHiddenSet.has(gid)) acc.push(idx)
            return acc
        }, [])
        setMountedValves(mounted)
    }

    function onValveSlotsChange(slots: number) {
        if (onValveChange) {
            const boundedSlots = Math.max(1, Math.min(slots, isVtux ? 4 : slots))
            const mounted = mod.MountedValves ?? Array.from({ length: boundedSlots }, (_, idx) => idx)
            // filter out mounted indices >= slots
            const validMounted = mounted.filter(idx => idx < boundedSlots)
            onValveChange(mod.Adress, validMounted, boundedSlots)
        }
    }

    return (
        <Box sx={{
            border: isBackplane ? 'none' : `2px solid ${st.border}`,
            background: isBackplane ? 'transparent' : st.bg,
            boxShadow: isBackplane ? 'none' : active
                ? '0 0 12px 4px rgba(255,152,0,0.6), 0 2px 6px rgba(0,0,0,0.14)'
                : '0 2px 6px rgba(0,0,0,0.14)',
            borderRadius: 1.5,
            p: isBackplane ? '2px 0' : '4px 4px 6px',
            width: dispW + (isBackplane ? 0 : 8),
            textAlign: 'center',
            position: 'relative',
            animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
            '@keyframes pulse': {
                '0%, 100%': { boxShadow: '0 0 8px 2px rgba(255,152,0,0.4), 0 2px 6px rgba(0,0,0,0.14)' },
                '50%': { boxShadow: '0 0 16px 6px rgba(255,152,0,0.7), 0 2px 6px rgba(0,0,0,0.14)' },
            },
        }}>

            {/* ── Left / Right cable handles (standard AP-I) ── */}
            {showLeftHandle && (
                <Handle id="left" type="target" position={Position.Left}
                    style={{ background: '#546e7a', width: 10, height: 10, border: '2px solid #fff' }} />
            )}
            {showRightHandle && (
                <Handle id="right" type="source" position={Position.Right}
                    style={{ background: '#546e7a', width: 10, height: 10, border: '2px solid #fff' }} />
            )}

            {/* ── VABX Extra Inputs ── */}
            {hasVabxInputs && Array.from({ length: 8 }).map((_, i) => {
                const row = Math.floor(i / 4)
                const col = i % 4
                return (
                    <Handle
                        key={`vabx-in-${i}`}
                        id={`tgt-in-vabxin${i}`}
                        type="target"
                        position={Position.Top}
                        style={{
                            left: `${20 + col * 20}%`,
                            top: `${-6 - row * 12}px`,
                            background: editMode ? PORT_COLOR.in : 'transparent',
                            width: 9, height: 9,
                            border: editMode ? '2px solid #fff' : 'none',
                            borderRadius: '50%',
                            opacity: editMode ? 1 : 0,
                            pointerEvents: editMode ? undefined : 'none'
                        }}
                    />
                )
            })}

            {/* ── Generic fallback IO handles (always rendered, invisible when not editing) ── */}
            {!suppressIoHandles && !hasPorts && Array.from({ length: topCount }, (_, i) => (
                <Handle key={`fo-${i}`} id={`src-out-out${i}`} type="source" position={Position.Top}
                    style={getGenericOutStyle(i, topCount, editMode)} />
            ))}
            {!suppressIoHandles && !hasPorts && Array.from({ length: botCount }, (_, i) => (
                <Handle key={`fi-${i}`} id={`tgt-in-in${i}`} type="target" position={Position.Bottom}
                    style={getGenericInStyle(i, botCount, editMode)} />
            ))}

            {/* ── Address badge (above image) ── */}
            <Stack
                direction="row"
                spacing={0.5}
                sx={{ justifyContent: 'center', alignItems: 'center', marginBottom: 0.25 }}

            >
                <Typography sx={{
                    fontSize: '0.48rem', fontWeight: 700, color: '#1565c0',
                    lineHeight: 1, letterSpacing: '0.02em',
                }}>
                    #{mod.Adress}
                </Typography>

                {(numIn > 0 || numOut > 0 || numInOut > 0) && (
                    <Typography sx={{ fontSize: '0.44rem', color: '#666', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {numIn > 0 && <span style={{ color: PORT_COLOR.in }}>↓{numIn}</span>}
                        {numOut > 0 && <span style={{ color: PORT_COLOR.out }}>↑{numOut}</span>}
                        {numInOut > 0 && <span style={{ color: PORT_COLOR.inout }}>⇅{numInOut}</span>}
                    </Typography>
                )}
            </Stack>



            {/* ── SVG image container ── */}
            <Box sx={{ position: 'relative', width: dispW, height: DISP_H, margin: '0 auto' }}>
                <Tooltip title={mod.Name} placement="top" arrow>
                    <img
                        src={displayUrl}
                        alt={mod.Name}
                        loading="lazy"
                        decoding="async"
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

                {/* ── EPLI / VABX-AP AP-bus handles at physical XF10/XF20 port positions ──
                     EPLI SVG 31×107: XF10 at cy=40.5 (37.85%), XF20 at cy=56.5 (52.8%)
                     VABX-EL-API SVG 46×109: XF10 at cy=23.5 (21.6%), XF20 at cy=44.5 (40.8%) */}
                {showApIn && (
                    <Handle id="ap-in" type="target" position={Position.Left}
                        style={getApInStyle(apInPos?.left, apInPos?.top)}
                    />
                )}
                {showApOut && (
                    <Handle id="ap-out" type="source" position={Position.Right}
                        style={getApOutStyle(apOutPos?.left, apOutPos?.top)}
                    />
                )}

                {/* ── SVG-port handles (always rendered so edges can resolve handle IDs;
                     invisible when not in edit mode per React Flow best-practice) ── */}
                {!suppressIoHandles && hasPorts && ports.map(port => {
                    const portColor = PORT_COLOR[port.kind]
                    return (
                        <Fragment key={port.id}>
                            {/* Coloured source handle – kind encoded in ID for validation */}
                            <Handle
                                id={`src-${port.kind}-${port.id}`}
                                type="source"
                                position={port.side}
                                style={getPortSrcStyle(port.cx, port.cy, portColor, editMode)}
                            />
                            {/* Transparent target hit-area – kind also encoded */}
                            <Handle
                                id={`tgt-${port.kind}-${port.id}`}
                                type="target"
                                position={port.side}
                                style={getPortTgtStyle(port.cx, port.cy, editMode)}
                            />
                        </Fragment>
                    )
                })}
            </Box>

            {/* ── Module name + I/O counts on same line ── */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                <Typography sx={{
                    fontSize: '0.5rem', fontWeight: 700, wordBreak: 'break-all',
                    lineHeight: 1.15, color: isBackplane ? '#444' : 'inherit',
                }}>
                    {mod.Name}
                </Typography>
            </Box>

            {/* ── Type chip (non-backplane only) ── */}
            {/* {!isBackplane && (
                <Chip label={mod.Type} size="small" color={st.chip} variant="outlined"
                    sx={{ fontSize: '0.46rem', height: 13, mt: 0.25, '& .MuiChip-label': { px: '3px' } }}
                />
            )} */}

            {/* ── Connection list (edit mode, whenever wires are drawn) ── */}
            {connections.length > 0 && (
                <Box sx={{
                    mt: 0.5, pt: 0.25, borderTop: '1px solid rgba(0,0,0,0.1)',
                    textAlign: 'left',
                }}>
                    {connections.map((c) => (
                        <Typography key={`${c.dir}-${c.portId}-${c.peerAddr}-${c.peerPort}`} sx={{
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
            {showValveEditor && canConfigureValves && (
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
                            hiddenValves={effectiveHiddenValves}
                            numValves={numValves}
                            maxValves={isVtux ? 4 : undefined}
                            onToggle={onToggleValve}
                            onSetMountedValves={setMountedValves}
                            onNumValvesChange={onValveSlotsChange}
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
