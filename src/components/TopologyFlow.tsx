import { useEffect, useState, useContext } from 'react'
import { Box, Typography, Divider } from '@mui/material'
import CableIcon from '@mui/icons-material/Cable'
import LinkIcon from '@mui/icons-material/Link'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { TooltipButton } from './TooltipButton'
import {
    useNodesState,
    useEdgesState,
    Panel,
} from '@xyflow/react'
import type { Node, Edge, NodeTypes, EdgeTypes, EdgeChange } from '@xyflow/react'
import TopologyCanvas from './TopologyCanvas'
import ModuleNode from './ModuleNode'
import BackplaneNode from './BackplaneNode'
import { CableEdge } from './CableEdge'
import { WireEdge } from './WireEdge'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus, TopologyModule, BenchConfig, WiringConnection, ModuleInstance } from '../types'
import { AlertsContext } from '../utils/AlertsManager'

// ─────────────────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
    mod: ModuleNode as NodeTypes[string],
    backplane: BackplaneNode as NodeTypes[string],
}



const EDGE_TYPES: EdgeTypes = {
    cable: CableEdge as EdgeTypes[string],
    wire: WireEdge as EdgeTypes[string],
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

    const edges: Edge[] = []
    
    wiring.forEach(c => {
        const srcAddrStr = c.source_instance_id.replace(/^mod-0*/, '') || '0'
        const tgtAddrStr = c.target_instance_id.replace(/^mod-0*/, '') || '0'
        const srcAddr = parseInt(srcAddrStr) || 0
        const tgtAddr = parseInt(tgtAddrStr) || 0
        const sh = `src-${srcKind(srcAddr)}-${c.source_channel}`
        const th = `tgt-${tgtKind(tgtAddr)}-${c.target_channel}`

        const outKind = srcKind(srcAddr)
        let wireColor = outKind === 'out' ? '#2e7d32' : outKind === 'in' ? '#1565c0' : '#e65100'

        // Multi-color logic for redundant edges
        const existingEdges = edges.filter(e => e.source === String(srcAddr) && e.target === String(tgtAddr))
        const colorPalette = [
            wireColor,
            '#d81b60', // Pink/Red
            '#00897b', // Teal
            '#f57c00', // Orange
            '#8e24aa', // Purple
            '#1e88e5', // Blue
            '#c0ca33', // Lime
            '#546e7a', // Blue Grey
        ]
        if (existingEdges.length > 0) {
            wireColor = colorPalette[existingEdges.length % colorPalette.length]
        }

        edges.push({
            id: c.id,
            source: String(srcAddr),
            sourceHandle: sh,
            target: String(tgtAddr),
            targetHandle: th,
            type: 'wire',
            animated: true,
            zIndex: 1000,
            style: { stroke: wireColor, strokeWidth: 2.5 },
            data: { kind: 'io', portSrc: c.source_channel, portTgt: c.target_channel },
        })
    })

    return edges
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
    rawConfig?: BenchConfig | null
}



export default function TopologyFlow({
    topology, diffStatus, removedModules = [], fullscreen, onToggleFullscreen,
    activeModuleAddr = null, selectedModuleAddr = null, onSelectModuleAddr,
    rawConfig
}: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
    const [showApCables, setShowApCables] = useState(true)
    const [showIoCables, setShowIoCables] = useState(true)
    const [ioEdges, setIoEdges] = useState<Edge[]>([])
    useContext(AlertsContext)

    // ── Derive ioEdges from rawConfig (no need to fetch again) ────────────
    useEffect(() => {
        if (!rawConfig) {
            setIoEdges([])
            return
        }
        const wiring = rawConfig.wiring ?? []
        const edges = wiringToEdges(wiring, rawConfig.module_instances ?? [])
        setIoEdges(edges)
    }, [rawConfig])

    // When ioEdges load (possibly after topology is already set), merge them in
    useEffect(() => {
        setEdges(prev => {
            const nonIo = prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io')
            return [...nonIo, ...ioEdges]
        })
    }, [ioEdges, setEdges])

    // ── Rebuild layout when topology / diff / modules change ────────────
    useEffect(() => {
        if (!topology?.Topology?.length) {
            setNodes([])
            setEdges([])
            return
        }
        // Append removed modules (from stored file but absent in live) so they
        // appear in the canvas with a red border, placed after the live modules.
        const allMods = [...topology.Topology]
        for (const rm of removedModules) {
            if (!allMods.find(m => m.Adress === rm.Adress)) allMods.push(rm)
        }
        const mergedStatus: DiffStatus = { ...(diffStatus ?? {}) }
        for (const rm of removedModules) mergedStatus[rm.Adress] = 'removed'
        const { nodes: newNodes, edges: chainEdges } = buildLayout(allMods, mergedStatus, false)

        setNodes(prevNodes => {
            const prevNodeMap = new Map(prevNodes.map(n => [n.id, n]))
            return (newNodes as Node[]).map(n => {
                const data = n.data as Record<string, unknown>
                const mod = data.mod as TopologyModule | undefined
                // Valve bodies always get showValves so the ModuleNode effect can
                // derive the correct hidden set — even when MountedValves is empty
                // (all unmounted) or full (all mounted).
                const isValveBody = mod?.Type?.toLowerCase() === 'valve' || (mod?.MountedValves?.length ?? 0) > 0
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
        })
        setEdges([...chainEdges, ...ioEdges])
    }, [topology, diffStatus, removedModules, activeModuleAddr, selectedModuleAddr, ioEdges, setNodes, setEdges])

    const onEdgesChange = (changes: EdgeChange[]) => {
        _onEdgesChange(changes.filter(c => c.type !== 'remove'))
    }

    // ── Visible edges based on toggles ──────────────────────────────────
    const visibleEdges = edges.filter(e => {
        const kind = (e.data as Record<string, unknown>)?.kind
        if (kind === 'cable') return showApCables
        if (kind === 'io') return showIoCables
        return true
    })

    const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
        if (onSelectModuleAddr && node.type === 'mod') {
            const mod = (node.data as any).mod as TopologyModule
            if (mod) {
                onSelectModuleAddr(mod.Adress)
            }
        }
    }

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
