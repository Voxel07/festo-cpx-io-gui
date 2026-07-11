import { useEffect, useState, useContext } from 'react'
import { Box, Typography } from '@mui/material'
import {
    useNodesState,
    useEdgesState,
} from '@xyflow/react'
import type { Node, Edge, NodeTypes, EdgeTypes, EdgeChange } from '@xyflow/react'
import TopologyCanvas from './TopologyCanvas'
import ModuleNode from './ModuleNode'
import BackplaneNode from './BackplaneNode'
import { CableEdge } from './CableEdge'
import { WireEdge } from './WireEdge'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus, TopologyModule, BenchConfig, WiringConnection, ModuleInstance, DiagnosisEntry } from '../types'
import { AlertsContext } from '../utils/AlertsContext'

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
    const pairCounts = new Map<string, number>()

    const addressOf = (instanceId: string): number => {
        const instance = instances.find(item => item.instance_id === instanceId)
        if (instance) return instance.address
        const match = instanceId.match(/(?:mod-)?0*(\d+)$/)
        return match ? Number(match[1]) : 0
    }

    wiring.forEach(c => {
        const srcAddr = addressOf(c.source_instance_id)
        const tgtAddr = addressOf(c.target_instance_id)
        const sh = c.source_handle || `src-${srcKind(srcAddr)}-${c.source_channel}`
        const th = c.target_handle || `tgt-${tgtKind(tgtAddr)}-${c.target_channel}`

        const outKind = srcKind(srcAddr)
        let wireColor = outKind === 'out' ? '#2e7d32' : outKind === 'in' ? '#1565c0' : '#e65100'

        // Multi-color logic for redundant edges
        const pairKey = `${srcAddr}->${tgtAddr}`
        const existingCount = pairCounts.get(pairKey) ?? 0
        pairCounts.set(pairKey, existingCount + 1)
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
        if (existingCount > 0) {
            wireColor = colorPalette[existingCount % colorPalette.length]
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
            style: { stroke: wireColor, strokeWidth: 1.25 },
            data: { kind: 'io', portSrc: c.source_channel, portTgt: c.target_channel },
        })
    })

    return edges
}

interface Props {
    topology: Topology | null
    diffStatus: DiffStatus | null
    removedModules?: TopologyModule[]
    /** Module address currently being tested (for highlighting) */
    activeModuleAddr?: number | null
    /** Module address currently selected in Raw Mode (for highlighting) */
    selectedModuleAddr?: number | null
    onSelectModuleAddr?: (addr: number | null) => void
    rawConfig?: BenchConfig | null
    showApCables: boolean
    showIoCables: boolean
    diagnoses: DiagnosisEntry[]
    wrapThreshold: number
    cableGap: number
    isMockMode?: boolean
    onModuleValveChange?: (addr: number, mountedValves: number[], valveSlots?: number) => void
    onRemoveModule?: (addr: number) => void
    onMoveModule?: (oldAddr: number, newAddr: number) => void
}



export default function TopologyFlow({
    topology, diffStatus, removedModules = [],
    activeModuleAddr = null, selectedModuleAddr = null, onSelectModuleAddr,
    rawConfig, showApCables, showIoCables, diagnoses,
    wrapThreshold, cableGap, isMockMode, onModuleValveChange, onRemoveModule, onMoveModule
}: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
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
        // Build address → diagnoses map for quick lookup
        const diagByAddr: Record<number, DiagnosisEntry[]> = {}
        for (const d of diagnoses) {
            if (!diagByAddr[d.address]) diagByAddr[d.address] = []
            diagByAddr[d.address].push(d)
        }
        // Append removed modules (from stored file but absent in live) so they
        // appear in the canvas with a red border, placed after the live modules.
        const allMods = [...topology.Topology]
        for (const rm of removedModules) {
            if (!allMods.find(m => m.Adress === rm.Adress)) allMods.push(rm)
        }
        let mergedStatus: DiffStatus | null = null
        if (diffStatus || removedModules.length > 0) {
            mergedStatus = { ...(diffStatus ?? {}) }
            for (const rm of removedModules) {
                if (!mergedStatus[rm.Adress]) {
                    mergedStatus[rm.Adress] = 'removed'
                }
            }
        }
        const { nodes: newNodes, edges: chainEdges } = buildLayout(allMods, mergedStatus, !!isMockMode, wrapThreshold, cableGap)

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
                const addr = mod?.Adress
                return {
                    ...n,
                    data: {
                        ...data,
                        ...(isValveBody ? { showValves: true } : {}),
                        ...(isValveBody && onModuleValveChange ? { showValveEditor: true } : {}),
                        // Preserve hiddenValves across rebuilds only for valve bodies
                        ...(prevHidden != null && isValveBody ? { hiddenValves: prevHidden } : {}),
                        onValveChange: (isValveBody && onModuleValveChange) ? onModuleValveChange : undefined,
                        onRemoveModule: (isMockMode && onRemoveModule) ? () => onRemoveModule(addr!) : undefined,
                        onMoveModule: (isMockMode && onMoveModule) ? onMoveModule : undefined,
                        active,
                        diagnoses: addr != null ? (diagByAddr[addr] ?? []) : [],
                    },
                }
            })
        })
        setEdges([...chainEdges, ...ioEdges])
    }, [topology, diffStatus, removedModules, activeModuleAddr, selectedModuleAddr, ioEdges, diagnoses, wrapThreshold, cableGap, setNodes, setEdges, isMockMode, onMoveModule, onRemoveModule, onModuleValveChange])

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
                nodesDraggable={true}
                fitView
                fitViewOnLayoutChange
                onNodeClick={handleNodeClick}
                elementsSelectable={!!onSelectModuleAddr}
            />
        </Box>
    )
}
