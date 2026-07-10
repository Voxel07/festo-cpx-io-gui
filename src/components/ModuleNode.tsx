import { memo, useState, useEffect, useMemo } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Box, Typography, Tooltip, IconButton, useTheme, Chip } from '@mui/material'
import Stack from '@mui/material/Stack'
import { useSvgMap, resolveIcon } from '../hooks/useSvgMap'
import { useSvgPorts } from '../hooks/useSvgPorts'

import { useValveGroups } from '../hooks/useValveGroups'
import { useModifiedSvgText } from '../hooks/useModifiedSvg'
import { useLiveIoState } from '../hooks/useIoStatePolling'
import type { DiffStatusKind } from '../types'
import ValveEditorDialog from './ValveEditorDialog'
import TopologyNodeWrapper from './TopologyNodeWrapper'
import type { ModuleNodeType } from './moduleNodeTypes'
import { ModuleNodeDiagnosis } from './ModuleNodeDiagnosis'
import { ModuleNodePorts } from './ModuleNodePorts'

// STATUS_STYLE moved into component to use theme



import {
    PORT_COLOR, PORT_HIT_D,
    getGenericInStyle, getGenericOutStyle, getApInStyle, getApOutStyle,
    supportsMountedValves, defaultValveSlots, getModuleDispSize
} from './moduleNodeHelpers'

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
        compareActive = false,
        diagnoses = [],
    } = data

    const [isEditingAddr, setIsEditingAddr] = useState(false)
    const [addrInput, setAddrInput] = useState(mod.Adress.toString())

    useEffect(() => {
        setAddrInput(mod.Adress.toString())
    }, [mod.Adress])

    const theme = useTheme()
    const svgMaps = useSvgMap()
    const svgUrl = resolveIcon(mod.Name, svgMaps, mod.Modulecode)

    const is16Dio = /(?:16DIO|16NDIO|16NIDO)/.test(mod.Name.toUpperCase())
    const numIn = is16Dio ? 0 : mod.NumOfInputs
    const numOut = is16Dio ? 0 : mod.NumOfOutputs
    const numInOut = is16Dio ? Math.max(mod.NumOfInputs, mod.NumOfOutputs, 16) : mod.NumOfInOuts

    // Port positions come from SVG; port counts/kinds come from bench_config (mod.NumOf*)
    const ports = useSvgPorts(svgUrl, {
        numIn,
        numOut,
        numInOut,
    })
    const isVtux = mod.Name.toUpperCase().startsWith('VTUX')
    const canConfigureValves = supportsMountedValves(mod.Name, mod.Type)
    const numValves = defaultValveSlots(mod.Name, mod.ValveSlots)


    const wantsValves = canConfigureValves && (showValveEditor || showValves)
    const valveGroups = useValveGroups(wantsValves ? svgUrl : '', numValves)

    const { w: dispW, h: dispH } = getModuleDispSize(mod)

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
    const svgText = useModifiedSvgText(svgUrl, effectiveHiddenValves, numValves)

    const hasPorts = ports.length > 0

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

    const STATUS_BORDER: Record<DiffStatusKind, string> = {
        unchanged: theme.palette.primary.main,
        changed: theme.palette.warning.main,
        added: theme.palette.success.main,
        removed: theme.palette.error.main,
    }
    const statusBarColor = STATUS_BORDER[status] ?? theme.palette.primary.main

    const liveState = useLiveIoState()
    const modState = liveState[mod.Adress]

    // Build dynamic CSS rules for port and LED coloring.
    // The IoStateContext will eventually provide real-time state for these LEDs.
    const dynamicStyles = useMemo(() => {
        const styles: Record<string, any> = {
            '& svg': { width: '100%', height: '100%', display: 'block' }
        }

        // 1. Color ports based on their kind (in, out, inout)
        for (const p of ports) {
            styles[`& #${p.id}`] = {
                fill: `${PORT_COLOR[p.kind]} !important`,
                stroke: `${PORT_COLOR[p.kind]} !important`,
            }
        }

        // 2. Default LEDs (SD / MD)
        let diagColor = '#00ff22' // default green
        if (diagnoses && diagnoses.length > 0) {
            const hasError = diagnoses.some(d => d.severity === 'error')
            const hasWarning = diagnoses.some(d => d.severity === 'warning')
            
            if (hasError) {
                diagColor = '#e53935' // red
            } else if (hasWarning) {
                diagColor = '#fdba00ff' // yellow
            } else {
                diagColor = '#0288d1' // blue for maintenance/info
            }
        }
        styles[`& #LED_SD`] = { fill: `${diagColor} !important` }
        styles[`& #LED_MD`] = { fill: `${diagColor} !important` }

        // 2. LED animations
        if (modState) {
            // Power load status LED
            styles[`& #LED_PL`] = { fill: '#00ff22 !important' } // green if we have state

            // Input LEDs
            modState.inputs.forEach((val, i) => {
                if (val) {
                    styles[`& #LED_I${i}`] = { fill: '#00ff22 !important' } // bright green
                    styles[`& #LED_${i}`] = { fill: '#00ff22 !important' }
                }
            })
            // Output LEDs
            modState.outputs.forEach((val, i) => {
                if (val) {
                    styles[`& #LED_O${i}`] = { fill: '#fdba00ff !important' } // amber/orange
                    styles[`& #LED_${i}`] = { fill: '#fdba00ff !important' }
                }
            })
            // InOut LEDs — 16DIO/NDIO modules use LED_0..LED_15 (numbered, not I/O prefixed)
            modState.inouts.forEach((val, i) => {
                if (val) {
                    styles[`& #LED_${i}`] = { fill: '#ff9800 !important' } // amber for inout
                }
            })
        }

        return styles
    }, [ports, modState, diagnoses])

    return (
        <TopologyNodeWrapper
            status={status}
            compareActive={compareActive}
            active={active}
            noBorder={isBackplane}
            width={dispW + (isBackplane ? 0 : 8)}
            padding={isBackplane ? '2px 0' : '4px 4px 6px'}
        >
            {/* ── Status Chip (if not unchanged) ── */}
            {status !== 'unchanged' && !isBackplane && (
                <Chip
                    label={status.toUpperCase()}
                    color={
                        status === 'changed' ? 'warning' :
                            status === 'added' ? 'success' :
                                status === 'removed' ? 'error' : 'default'
                    }
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: -10,
                        right: -10,
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        zIndex: 20,
                    }}
                />
            )}

            {/* ── Left / Right cable handles (standard AP-I) ── */}
            {showLeftHandle && (
                <Handle id="left" type="target" position={Position.Left}
                    style={
                        ports.find(p => p.kind === 'ap-in')
                            ? {
                                position: 'absolute',
                                left: `${ports.find(p => p.kind === 'ap-in')!.cx * 100}%`,
                                top: `${ports.find(p => p.kind === 'ap-in')!.cy * 100}%`,
                                transform: 'translate(-50%,-50%)',
                                width: PORT_HIT_D, height: PORT_HIT_D, opacity: 0,
                                border: 'none', background: 'transparent'
                            }
                            : { background: '#546e7a', width: 10, height: 10, border: '2px solid #fff' }
                    } />
            )}
            {showRightHandle && (
                <Handle id="right" type="source" position={Position.Right}
                    style={
                        ports.find(p => p.kind === 'ap-out')
                            ? {
                                position: 'absolute',
                                left: `${ports.find(p => p.kind === 'ap-out')!.cx * 100}%`,
                                top: `${ports.find(p => p.kind === 'ap-out')!.cy * 100}%`,
                                transform: 'translate(-50%,-50%)',
                                width: PORT_HIT_D, height: PORT_HIT_D, opacity: 0,
                                border: 'none', background: 'transparent'
                            }
                            : { background: '#546e7a', width: 10, height: 10, border: '2px solid #fff' }
                    } />
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
                {data.onRemoveModule && (
                    <Tooltip title="Remove module" placement="top">
                        <IconButton size="small"
                            onClick={() => data.onRemoveModule?.(mod.Adress)}
                            sx={{
                                p: 0, width: 14, height: 14, minWidth: 14, fontSize: '0.5rem',
                                color: '#e53935',
                                '&:hover': { background: '#ffebee', color: '#c62828' },
                            }}>
                            ✖
                        </IconButton>
                    </Tooltip>
                )}
                {data.onMoveModule && mod.Adress > 0 && (
                    <IconButton size="small" sx={{ p: 0, width: 10, height: 10, minWidth: 10 }} onClick={() => data.onMoveModule!(mod.Adress, mod.Adress - 1)}>
                        <Typography sx={{ fontSize: '0.48rem', lineHeight: 1 }}>{"<"}</Typography>
                    </IconButton>
                )}

                {isEditingAddr ? (
                    <input
                        autoFocus
                        value={addrInput}
                        onChange={e => setAddrInput(e.target.value)}
                        onBlur={() => {
                            setIsEditingAddr(false)
                            const newVal = parseInt(addrInput)
                            if (!isNaN(newVal) && newVal !== mod.Adress) {
                                data.onMoveModule?.(mod.Adress, newVal)
                            } else {
                                setAddrInput(mod.Adress.toString())
                            }
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') {
                                setIsEditingAddr(false)
                                setAddrInput(mod.Adress.toString())
                            }
                        }}
                        style={{ width: 24, fontSize: '0.48rem', textAlign: 'center', outline: 'none', border: '1px solid #1565c0', borderRadius: 2 }}
                    />
                ) : (
                    <Typography
                        onClick={() => data.onMoveModule ? setIsEditingAddr(true) : null}
                        sx={{
                            fontSize: '0.48rem', fontWeight: 700, color: theme.palette.mode === 'dark' ? theme.palette.primary.light : '#1565c0',
                            lineHeight: 1, letterSpacing: '0.02em',
                            cursor: data.onMoveModule ? 'pointer' : 'default',
                            '&:hover': data.onMoveModule ? { textDecoration: 'underline' } : {}
                        }}>
                        #{mod.Adress}
                    </Typography>
                )}

                {data.onMoveModule && (
                    <IconButton size="small" sx={{ p: 0, width: 10, height: 10, minWidth: 10 }} onClick={() => data.onMoveModule!(mod.Adress, mod.Adress + 1)}>
                        <Typography sx={{ fontSize: '0.48rem', lineHeight: 1 }}>{">"}</Typography>
                    </IconButton>
                )}

                {(numIn > 0 || numOut > 0 || numInOut > 0) && (
                    <Typography sx={{ fontSize: '0.44rem', color: theme.palette.text.secondary, lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {numIn > 0 && <span style={{ color: PORT_COLOR.in }}>↓{numIn}</span>}
                        {numOut > 0 && <span style={{ color: PORT_COLOR.out }}>↑{numOut}</span>}
                        {numInOut > 0 && <span style={{ color: PORT_COLOR.inout }}>⇅{numInOut}</span>}
                    </Typography>
                )}
            </Stack>



            {/* ── SVG image container ── */}
            <Box sx={{ position: 'relative', width: dispW, height: dispH, margin: '0 auto' }}>
                <Tooltip title={mod.Name} placement="top" arrow>
                    <Box
                        sx={dynamicStyles}
                        dangerouslySetInnerHTML={{ __html: svgText || '<svg viewBox="0 0 100 100"></svg>' }}
                    />
                </Tooltip>

                {/* ── Diagnosis severity indicator ── */}
                <ModuleNodeDiagnosis diagnoses={diagnoses} />

                {/* ── Status bar (backplane modules only) ── */}
                {isBackplane && compareActive && (
                    <Box sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                        background: statusBarColor, borderRadius: '0 0 2px 2px',
                    }} />
                )}

                {/* ── EPLI / VABX-AP AP-bus handles at physical XF10/XF20 port positions ──
                     EPLI SVG 31×107: XF10 at cy=40.5 (37.85%), XF20 at cy=56.5 (52.8%)
                     VABX-EL-API SVG 46×109: XF10 at cy=23.5 (21.6%), XF20 at cy=44.5 (40.8%) */}
                {showApIn && (() => {
                    const apInPort = ports.find(p => p.kind === 'ap-in')
                    const left = apInPort ? `${apInPort.cx * 100}%` : apInPos?.left
                    const top = apInPort ? `${apInPort.cy * 100}%` : apInPos?.top
                    return (
                        <Handle id="ap-in" type="target" position={Position.Left}
                            style={getApInStyle(left, top)}
                        />
                    )
                })()}
                {showApOut && (() => {
                    const apOutPort = ports.find(p => p.kind === 'ap-out')
                    const left = apOutPort ? `${apOutPort.cx * 100}%` : apOutPos?.left
                    const top = apOutPort ? `${apOutPort.cy * 100}%` : apOutPos?.top
                    return (
                        <Handle id="ap-out" type="source" position={Position.Right}
                            style={getApOutStyle(left, top)}
                        />
                    )
                })()}

                {/* ── SVG-port handles (always rendered so edges can resolve handle IDs;
                     invisible when not in edit mode per React Flow best-practice) ── */}
                {!suppressIoHandles && hasPorts && (
                    <ModuleNodePorts ports={ports} connections={connections} editMode={editMode} moduleName={mod.Name} />
                )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                <Typography sx={{
                    fontSize: '0.5rem', fontWeight: 700, wordBreak: 'break-all',
                    lineHeight: 1.15, color: 'inherit',
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
                        <Typography key={c.id ? `${c.id}-${c.dir}` : `${c.dir}-${c.portId}-${c.peerAddr}-${c.peerPort}`} sx={{
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


        </TopologyNodeWrapper>
    )
}

export default memo(ModuleNode)
