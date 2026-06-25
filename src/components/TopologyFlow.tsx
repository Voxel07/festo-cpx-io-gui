import { useEffect, useRef, useState, useCallback } from 'react'
import { Box, Button, Tooltip, Typography, Divider } from '@mui/material'
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
} from '@xyflow/react'
import type { Node, Edge, NodeTypes, EdgeChange } from '@xyflow/react'
import ModuleNode, { STATUS_STYLE } from './ModuleNode'
import type { ModuleNodeData } from './ModuleNode'
import BackplaneNode from './BackplaneNode'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus } from '../types'

// ─────────────────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
    mod: ModuleNode as NodeTypes[string],
    backplane: BackplaneNode as NodeTypes[string],
}

interface Props {
    topology: Topology | null
    diffStatus: DiffStatus | null
    fullscreen: boolean
    onToggleFullscreen: () => void
    /** IO wiring edges from ConnectionsFlow to display here */
    ioEdges?: Edge[]
}

export default function TopologyFlow({ topology, diffStatus, fullscreen, onToggleFullscreen, ioEdges = [] }: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])  // BackplaneNode | ModuleNode
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
    const [showCables, setShowCables] = useState(true)
    const ioEdgesRef = useRef<Edge[]>(ioEdges)

    useEffect(() => { ioEdgesRef.current = ioEdges }, [ioEdges])

    useEffect(() => {
        if (!topology?.Topology?.length) { setNodes([]); setEdges([]); return }
        const { nodes: newNodes, edges: chainEdges } = buildLayout(topology.Topology, diffStatus, false)
        setNodes(newNodes as Node[])
        setEdges([...chainEdges, ...ioEdgesRef.current])
    }, [topology, diffStatus, setNodes, setEdges])

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        _onEdgesChange(changes.filter(c => c.type !== 'remove'))
    }, [_onEdgesChange])

    const visibleEdges = showCables
        ? edges
        : edges.filter(e => (e.data as Record<string, unknown>)?.kind !== 'cable')

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
        <ReactFlow
            nodes={nodes}
            edges={visibleEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView fitViewOptions={{ padding: 0.25 }}
            minZoom={0.1} maxZoom={4}
            nodesDraggable nodesConnectable={false} elementsSelectable={false}
        >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap
                nodeColor={n => {
                    const d = n.data as Record<string, unknown>
                    return STATUS_STYLE[d?.status as keyof typeof STATUS_STYLE]?.border ?? '#90caf9'
                }}
                zoomable pannable
            />
            <Panel position="top-right">
                <Box sx={{
                    background: 'rgba(255,255,255,0.96)', border: '1px solid #e0e0e0',
                    borderRadius: 1.5, p: 1, boxShadow: 2,
                    display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 180,
                }}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button size="small" variant={showCables ? 'contained' : 'outlined'} color="primary"
                            onClick={() => setShowCables(s => !s)}
                            sx={{ flex: 1, fontSize: '0.65rem', py: 0.25 }}>
                            {showCables ? '🔌 Cables ON' : '🔌 Cables OFF'}
                        </Button>
                        <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                            <Button size="small" variant="outlined" onClick={onToggleFullscreen}
                                sx={{ minWidth: 32, px: 0.5, fontSize: '1rem' }}>
                                {fullscreen ? '⊠' : '⛶'}
                            </Button>
                        </Tooltip>
                    </Box>
                    <Divider />
                    <Typography sx={{ fontSize: '0.54rem', color: '#888', lineHeight: 1.7 }}>
                        <span style={{ color: '#1976d2' }}>■</span> unchanged&nbsp;
                        <span style={{ color: '#ed6c02' }}>■</span> changed<br />
                        <span style={{ color: '#2e7d32' }}>■</span> added&nbsp;&nbsp;
                        <span style={{ color: '#d32f2f' }}>■</span> removed
                    </Typography>
                </Box>
            </Panel>
        </ReactFlow>
    )
}
