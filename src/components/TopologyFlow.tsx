import { useCallback, useEffect, useContext, useMemo } from 'react'
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
import { isVabaX5ValveTerminal } from './moduleNodeHelpers'

// ─────────────────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
    mod: ModuleNode as NodeTypes[string],
    backplane: BackplaneNode as NodeTypes[string],
}

const NO_REMOVED_MODULES: TopologyModule[] = []



const EDGE_TYPES: EdgeTypes = {
    cable: CableEdge as EdgeTypes[string],
    wire: WireEdge as EdgeTypes[string],
}

// ── Helper: convert BenchConfig wiring → ReactFlow IO edges ────────────────
function wiringToEdges(wiring: WiringConnection[], instances: ModuleInstance[]): Edge[] {
    // Build address → category map to derive correct handle kind (in/out/inout)
    const instanceById = new Map(instances.map(instance => [instance.instance_id, instance]))
    const categoryById = new Map(instances.map(instance => [instance.instance_id, instance.category]))
    for (const inst of instances) {
        instanceById.set(inst.instance_id, inst)
    }
    const srcKind = (instanceId: string): string => {
        const cat = categoryById.get(instanceId) ?? 'inout'
        if (cat === 'inout') return 'inout'
        return 'out'
    }
    const tgtKind = (instanceId: string): string => {
        const cat = categoryById.get(instanceId) ?? 'inout'
        if (cat === 'inout') return 'inout'
        return 'in'
    }

    const edges: Edge[] = []
    const pairCounts = new Map<string, number>()

    wiring.forEach(c => {
        if (!instanceById.has(c.source_instance_id) || !instanceById.has(c.target_instance_id)) return
        const sh = c.source_handle || `src-${srcKind(c.source_instance_id)}-${c.source_channel}`
        const th = c.target_handle || `tgt-${tgtKind(c.target_instance_id)}-${c.target_channel}`

        const outKind = srcKind(c.source_instance_id)
        let wireColor = outKind === 'out' ? '#2e7d32' : outKind === 'in' ? '#1565c0' : '#e65100'

        // Multi-color logic for redundant edges
        const pairKey = `${c.source_instance_id}->${c.target_instance_id}`
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
            source: c.source_instance_id,
            sourceHandle: sh,
            target: c.target_instance_id,
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
    topology, diffStatus, removedModules = NO_REMOVED_MODULES,
    activeModuleAddr = null, selectedModuleAddr = null, onSelectModuleAddr,
    rawConfig, showApCables, showIoCables, diagnoses,
    wrapThreshold, cableGap, isMockMode, onModuleValveChange, onRemoveModule, onMoveModule
}: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
    useContext(AlertsContext)

    // Derive wiring edges directly from canonical configuration.
    const ioEdges = useMemo(() => {
        if (!rawConfig) return []
        const wiring = rawConfig.wiring ?? []
        return wiringToEdges(wiring, rawConfig.module_instances ?? [])
    }, [rawConfig])

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
        const built = buildLayout(allMods, mergedStatus, !!isMockMode, wrapThreshold, cableGap)
        const instanceByAddress = new Map(
            (rawConfig?.module_instances ?? []).map(instance => [instance.address, instance.instance_id]),
        )
        const stableNodeId = (id: string) => {
            const address = Number(id)
            return Number.isFinite(address) ? (instanceByAddress.get(address) ?? id) : id
        }
        const newNodes = built.nodes.map(node => (
            node.type === 'mod' ? { ...node, id: stableNodeId(node.id) } : node
        ))
        const chainEdges = built.edges.map(edge => ({
            ...edge,
            id: `chain:${stableNodeId(edge.source)}:${edge.sourceHandle ?? ''}->${stableNodeId(edge.target)}:${edge.targetHandle ?? ''}`,
            source: stableNodeId(edge.source),
            target: stableNodeId(edge.target),
        }))

        setNodes(prevNodes => {
            const prevNodeMap = new Map(prevNodes.map(n => [n.id, n]))
            return (newNodes as Node[]).map(n => {
                const data = n.data as Record<string, unknown>
                const mod = data.mod as TopologyModule | undefined
                // Valve bodies always get showValves so the ModuleNode effect can
                // derive the correct hidden set — even when MountedValves is empty
                // (all unmounted) or full (all mounted).
                const isValveBody = mod?.Type?.toLowerCase() === 'valve'
                    || isVabaX5ValveTerminal(mod?.Name ?? '')
                    || (mod?.MountedValves?.length ?? 0) > 0
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
                        active: false,
                        diagnoses: addr != null ? (diagByAddr[addr] ?? []) : [],
                    },
                }
            })
        })
        setEdges([...chainEdges, ...ioEdges])
    }, [topology, diffStatus, removedModules, rawConfig, ioEdges, diagnoses, wrapThreshold, cableGap, setNodes, setEdges, isMockMode, onMoveModule, onRemoveModule, onModuleValveChange])

    // Selection only changes two node objects; it must not rebuild the complete layout.
    useEffect(() => {
        setNodes(previous => {
            let changed = false
            const next = previous.map(node => {
                if (node.type !== 'mod') return node
                const mod = (node.data as Record<string, unknown>).mod as TopologyModule | undefined
                const active = mod != null && (
                    mod.Adress === activeModuleAddr || mod.Adress === selectedModuleAddr
                )
                if (Boolean((node.data as Record<string, unknown>).active) === active) return node
                changed = true
                return { ...node, data: { ...node.data, active } }
            })
            return changed ? next : previous
        })
    }, [activeModuleAddr, selectedModuleAddr, setNodes])

    const onEdgesChange = (changes: EdgeChange[]) => {
        _onEdgesChange(changes.filter(c => c.type !== 'remove'))
    }

    // ── Visible edges based on toggles ──────────────────────────────────
    const visibleEdges = useMemo(() => edges.filter(e => {
        const kind = (e.data as Record<string, unknown>)?.kind
        if (kind === 'cable') return showApCables
        if (kind === 'io') return showIoCables
        return true
    }), [edges, showApCables, showIoCables])

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
