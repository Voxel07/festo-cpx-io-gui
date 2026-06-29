import { useEffect, useRef, useState, useCallback } from 'react'
import { Box, Typography, Divider, Alert } from '@mui/material'
import CableIcon from '@mui/icons-material/Cable'
import LinkIcon from '@mui/icons-material/Link'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { TooltipButton } from './TooltipButton'
import {
    useNodesState,
    useEdgesState,
    BaseEdge,
    EdgeLabelRenderer,
    Panel,
} from '@xyflow/react'
import type { Node, Edge, NodeTypes, EdgeTypes, EdgeChange, EdgeProps } from '@xyflow/react'
import TopologyCanvas from './TopologyCanvas'
import ModuleNode from './ModuleNode'
import BackplaneNode from './BackplaneNode'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus, TopologyModule, BenchConfig, WiringConnection, ModuleInstance } from '../types'

// ─────────────────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
    mod: ModuleNode as NodeTypes[string],
    backplane: BackplaneNode as NodeTypes[string],
}

// ── Custom cable edge: 6-segment orthogonal route with stubs ───────────────
// Path: exit source LEFT → go up → run horizontal → approach target from LEFT → enter target
function CableEdge({ sourceX, sourceY, targetX, targetY, label, style, markerEnd, data }: EdgeProps) {
    const isExitRight = (data as Record<string, unknown>)?.exitRight === true
    const STUB = 50   // horizontal stub before going vertical
    const aboveY = Math.min(sourceY, targetY) - 80
    const x1 = isExitRight ? sourceX + STUB : sourceX - STUB   // exit source going left/right
    const x2 = targetX - STUB   // approach target from the left
    const path = [
        `M ${sourceX},${sourceY}`,
        `L ${x1},${sourceY}`,     // go left/right from source
        `L ${x1},${aboveY}`,      // go up
        `L ${x2},${aboveY}`,      // run horizontal
        `L ${x2},${targetY}`,     // go down to target level
        `L ${targetX},${targetY}`,// connect to target
    ].join(' ')
    const labelX = (x1 + x2) / 2
    const labelY = aboveY - 8

    return (
        <>
            <BaseEdge path={path} style={style} markerEnd={markerEnd} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        className="nodrag nopan"
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
                            fontSize: 10, fontWeight: 700, color: '#1565c0',
                            background: '#e3f2fd', padding: '1px 6px',
                            borderRadius: 3, border: '1px solid #bbdefb',
                            pointerEvents: 'none',
                        }}
                    >
                        {String(label)}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
}

const EDGE_TYPES: EdgeTypes = {
    cable: CableEdge as EdgeTypes[string],
}

// ── Helper: convert BenchConfig wiring → ReactFlow IO edges ────────────────
function wiringToEdges(wiring: WiringConnection[], instances: ModuleInstance[]): Edge[] {
    // Build address → category map to derive correct handle kind (in/out/inout)
    const catByAddr: Record<number, string> = {}
    for (const inst of instances) {
        catByAddr[inst.address] = inst.category
    }
    const srcKind = (addr: number): string => {
        const cat = catByAddr[addr] ?? 'inout'
        if (cat === 'inout') return 'inout'
        return 'out'
    }
    const tgtKind = (addr: number): string => {
        const cat = catByAddr[addr] ?? 'inout'
        if (cat === 'inout') return 'inout'
        return 'in'
    }

    return wiring.map(c => {
        const srcAddrStr = c.source_instance_id.replace(/^mod-0*/, '') || '0'
        const tgtAddrStr = c.target_instance_id.replace(/^mod-0*/, '') || '0'
        const srcAddr = parseInt(srcAddrStr) || 0
        const tgtAddr = parseInt(tgtAddrStr) || 0
        return {
            id: c.id,
            source: String(srcAddr),
            sourceHandle: `src-${srcKind(srcAddr)}-${c.source_channel}`,
            target: String(tgtAddr),
            targetHandle: `tgt-${tgtKind(tgtAddr)}-${c.target_channel}`,
            animated: true,
            zIndex: 1000,
            style: { stroke: '#e65100', strokeWidth: 2.5 },
            label: c.label ?? `#${srcAddr}:${c.source_channel} → #${tgtAddr}:${c.target_channel}`,
            data: { kind: 'io', portSrc: c.source_channel, portTgt: c.target_channel },
        }
    })
}

interface Props {
    topology: Topology | null
    diffStatus: DiffStatus | null
    removedModules?: TopologyModule[]
    fullscreen: boolean
    onToggleFullscreen: () => void
    /** Module address currently being tested (for highlighting) */
    activeModuleAddr?: number | null
    /** Module address currently selected in Raw Mode (for highlighting) */
    selectedModuleAddr?: number | null
    onSelectModuleAddr?: (addr: number | null) => void
}

export default function TopologyFlow({
    topology, diffStatus, removedModules = [], fullscreen, onToggleFullscreen,
    activeModuleAddr = null, selectedModuleAddr = null, onSelectModuleAddr
}: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
    const [showApCables, setShowApCables] = useState(true)
    const [showIoCables, setShowIoCables] = useState(true)
    const [configWarning, setConfigWarning] = useState<string | null>(null)
    const [ioEdges, setIoEdges] = useState<Edge[]>([])
    const ioEdgesRef = useRef<Edge[]>([])

    // ── Auto-load bench_config.json on mount ────────────────────────────
    useEffect(() => {
        let cancelled = false
        fetch('/config?file_path=bench_config.json')
            .then(async r => {
                if (!r.ok || cancelled) return
                const config: BenchConfig = await r.json()
                const wiring = config.wiring ?? []
                const edges = wiringToEdges(wiring, config.module_instances ?? [])
                if (!cancelled) {
                    setIoEdges(edges)
                    if (wiring.length === 0) setConfigWarning('bench_config.json loaded but contains no wiring.')
                }
            })
            .catch(() => {
                if (!cancelled) setConfigWarning('bench_config.json not found. Save a configuration in the Connections tab to see I/O wiring here.')
            })
        return () => { cancelled = true }
    }, [])

    useEffect(() => { ioEdgesRef.current = ioEdges }, [ioEdges])

    // When ioEdges load (possibly after topology is already set), merge them in
    useEffect(() => {
        setEdges(prev => {
            const nonIo = prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io')
            return [...nonIo, ...ioEdges]
        })
    }, [ioEdges, setEdges])

    useEffect(() => {
        if (!topology?.Topology?.length) { setNodes([]); setEdges([]); return }
        // Append removed modules (from stored file but absent in live) so they
        // appear in the canvas with a red border, placed after the live modules.
        const allMods = [...topology.Topology]
        for (const rm of removedModules) {
            if (!allMods.find(m => m.Adress === rm.Adress)) allMods.push(rm)
        }
        const mergedStatus: DiffStatus = { ...(diffStatus ?? {}) }
        for (const rm of removedModules) mergedStatus[rm.Adress] = 'removed'
        const { nodes: newNodes, edges: chainEdges } = buildLayout(allMods, mergedStatus, false)
        // Preserve hiddenValves from previous render so valve visibility
        // doesn't reset when topology is rebuilt (e.g. during valve editing).
        const prevNodeMap = new Map(nodes.map(n => [n.id, n]))
        // Enrich nodes: highlight active module + show valves on valve bodies
        const enriched = (newNodes as Node[]).map(n => {
            const data = n.data as Record<string, unknown>
            const mod = data.mod as TopologyModule | undefined
            // Valve bodies always get showValves so the ModuleNode effect can
            // derive the correct hidden set — even when MountedValves is empty
            // (all unmounted) or full (all mounted).
            const isValveBody = mod?.Type === 'Valve' || (mod?.MountedValves?.length ?? 0) > 0
            const active = (activeModuleAddr != null && n.id === String(activeModuleAddr) && n.type === 'mod')
                || (selectedModuleAddr != null && n.id === String(selectedModuleAddr) && n.type === 'mod')
            const prev = prevNodeMap.get(n.id)
            const prevHidden = prev ? (prev.data as Record<string, unknown>).hiddenValves : undefined
            return {
                ...n,
                data: {
                    ...data,
                    ...(isValveBody ? { showValves: true } : {}),
                    // Preserve hiddenValves across rebuilds only for valve bodies
                    ...(prevHidden != null && isValveBody ? { hiddenValves: prevHidden } : {}),
                    active,
                },
            }
        })
        setNodes(enriched)
        setEdges([...chainEdges, ...ioEdgesRef.current])
    }, [topology, diffStatus, removedModules, activeModuleAddr, selectedModuleAddr, setNodes, setEdges])

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        _onEdgesChange(changes.filter(c => c.type !== 'remove'))
    }, [_onEdgesChange])

    // ── Visible edges based on toggles ──────────────────────────────────
    const visibleEdges = edges.filter(e => {
        const kind = (e.data as Record<string, unknown>)?.kind
        if (kind === 'cable') return showApCables
        if (kind === 'io') return showIoCables
        return true
    })

    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        if (onSelectModuleAddr && node.type === 'mod') {
            const mod = (node.data as any).mod as TopologyModule
            if (mod) {
                onSelectModuleAddr(mod.Adress)
            }
        }
    }, [onSelectModuleAddr])

    if (!topology) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                    Connect to a CPX-AP device to visualise the topology
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* ── Config warning banner ── */}
            {configWarning && (
                <Alert
                    severity="warning"
                    onClose={() => setConfigWarning(null)}
                    sx={{
                        position: 'absolute', top: 8, left: '50%',
                        transform: 'translateX(-50%)', zIndex: 20,
                        fontSize: '0.75rem', py: 0, maxWidth: '90%',
                    }}
                >
                    {configWarning}
                </Alert>
            )}

            <TopologyCanvas
                nodes={nodes}
                edges={visibleEdges}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                editMode={false}
                fitView
                onNodeClick={handleNodeClick}
                elementsSelectable={!!onSelectModuleAddr}
            >
                <Panel position="top-right">
                    <Box sx={{
                        background: 'rgba(255,255,255,0.96)', border: '1px solid #e0e0e0',
                        borderRadius: 1.5, p: 1, boxShadow: 2,
                        display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 200,
                    }}>
                        {/* AP Cable toggle */}
                        <TooltipButton
                            size="small"
                            variant={showApCables ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setShowApCables(s => !s)}
                            tooltip={showApCables ? 'Hide AP transmission cables' : 'Show AP transmission cables'}
                            icon={<CableIcon />}
                            sx={{ fontSize: '0.65rem', py: 0.25 }}
                        >
                            {showApCables ? 'AP Cables ON' : 'AP Cables OFF'}
                        </TooltipButton>

                        {/* IO Cable toggle */}
                        <TooltipButton
                            size="small"
                            variant={showIoCables ? 'contained' : 'outlined'}
                            color="warning"
                            onClick={() => setShowIoCables(s => !s)}
                            tooltip={showIoCables ? 'Hide IO connection wires' : 'Show IO connection wires'}
                            icon={<LinkIcon />}
                            sx={{ fontSize: '0.65rem', py: 0.25 }}
                        >
                            {showIoCables ? 'IO Wires ON' : 'IO Wires OFF'}
                        </TooltipButton>

                        {/* Fullscreen toggle */}
                        <TooltipButton
                            size="small"
                            variant="outlined"
                            onClick={onToggleFullscreen}
                            tooltip={fullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
                            icon={fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                            sx={{ minWidth: 32, px: 0.5 }}
                        >
                            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        </TooltipButton>
                        <Divider />
                        <Typography sx={{ fontSize: '0.54rem', color: '#888', lineHeight: 1.7 }}>
                            <span style={{ color: '#1976d2' }}>■</span> unchanged&nbsp;
                            <span style={{ color: '#ed6c02' }}>■</span> changed<br />
                            <span style={{ color: '#2e7d32' }}>■</span> added&nbsp;&nbsp;
                            <span style={{ color: '#d32f2f' }}>■</span> removed
                        </Typography>
                    </Box>
                </Panel>
            </TopologyCanvas>
        </Box>
    )
}
