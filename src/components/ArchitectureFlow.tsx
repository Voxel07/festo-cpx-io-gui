import { useMemo, useState } from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material'
import { Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow } from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import TestRunFlow from './TestRunFlow'

type Lane = 'Frontend' | 'Backend' | 'Library' | 'External'

interface ComponentNodeData extends Record<string, unknown> {
    title: string
    responsibility: string
    lane: Lane
}

const laneColors: Record<Lane, string> = {
    Frontend: '#1565c0',
    Backend: '#6a1b9a',
    Library: '#2e7d32',
    External: '#00838f',
}

function ComponentNode({ data }: NodeProps<Node<ComponentNodeData>>) {
    const accent = laneColors[data.lane]
    return (
        <Box sx={{ width: 240, minHeight: 88, p: 1.25, border: `1px solid ${accent}`, borderTop: `5px solid ${accent}`, borderRadius: 1, bgcolor: 'background.paper', color: 'text.primary', boxShadow: 2 }}>
            <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{data.title}</Typography>
            <Typography variant="caption" sx={{ color: accent, fontWeight: 700 }}>{data.lane}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.73rem' }}>{data.responsibility}</Typography>
            <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
        </Box>
    )
}

const nodeTypes = { component: ComponentNode }
const nodes: Node<ComponentNodeData>[] = [
    { id: 'react', type: 'component', position: { x: 0, y: 80 }, data: { lane: 'Frontend', title: 'React application', responsibility: 'Topology, wiring, test-run, history, raw I/O and architecture views.' } },
    { id: 'xyflow', type: 'component', position: { x: 0, y: 250 }, data: { lane: 'Frontend', title: 'XYFlow topology renderer', responsibility: 'Module SVG nodes, AP cables, I/O wires, layout and connection editing.' } },
    { id: 'fastapi', type: 'component', position: { x: 370, y: 80 }, data: { lane: 'Backend', title: 'FastAPI service', responsibility: 'HTTP/SSE API, configuration, hardware ownership and run orchestration.' } },
    { id: 'resolver', type: 'component', position: { x: 370, y: 250 }, data: { lane: 'Library', title: 'Resolver + test library', responsibility: 'Loads test metadata, matches bench capabilities and executes resolved instances.' } },
    { id: 'hal', type: 'component', position: { x: 740, y: 80 }, data: { lane: 'Library', title: 'Hardware abstraction layer', responsibility: 'Safe sessions, CPX-AP access, locking and guaranteed output reset.' } },
    { id: 'config', type: 'component', position: { x: 740, y: 250 }, data: { lane: 'External', title: 'Bench configuration', responsibility: 'Module types and instances, capabilities, channels, wiring and test definitions.' } },
    { id: 'hardware', type: 'component', position: { x: 1110, y: 80 }, data: { lane: 'External', title: 'CPX-AP modules', responsibility: 'Remote I/O, valve terminals, diagnoses and parameters under test.' } },
    { id: 'pocketbase', type: 'component', position: { x: 1110, y: 250 }, data: { lane: 'External', title: 'PocketBase', responsibility: 'Shared run history, checkpoints, results, logs and realtime events.' } },
]

const connections: Array<[string, string, string]> = [
    ['react', 'fastapi', 'HTTP + SSE'], ['react', 'pocketbase', 'realtime'], ['xyflow', 'react', 'view layer'],
    ['fastapi', 'resolver', 'resolve / run'], ['fastapi', 'hal', 'I/O operations'], ['resolver', 'config', 'load + match'],
    ['resolver', 'hal', 'test calls'], ['hal', 'hardware', 'industrial protocol'], ['fastapi', 'pocketbase', 'persist'],
]

function ComponentArchitecture() {
    const theme = useTheme()
    const edges = useMemo<Edge[]>(() => connections.map(([source, target, label]) => ({
        id: `${source}-${target}`, source, target, label,
        markerEnd: { type: MarkerType.ArrowClosed, color: theme.palette.text.secondary },
        style: { stroke: theme.palette.text.secondary, strokeWidth: 1.5 },
        labelStyle: { fill: theme.palette.text.secondary, fontSize: 10 },
        labelBgStyle: { fill: theme.palette.background.paper, fillOpacity: 0.92 },
    })), [theme])

    return (
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.35} maxZoom={1.7} colorMode={theme.palette.mode}>
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
            <Controls />
            <MiniMap nodeColor={node => laneColors[(node.data as ComponentNodeData).lane]} />
        </ReactFlow>
    )
}

export default function ArchitectureFlow() {
    const [view, setView] = useState<'components' | 'test-run' | 'graph'>('components')
    const descriptions = {
        components: 'Component-level system boundaries and dependencies.',
        'test-run': 'Detailed lifecycle of a UI- or CI-triggered test run.',
        graph: 'Interactive Graphify knowledge graph generated from the repository.',
    } satisfies Record<typeof view, string>
    return (
        <Box sx={{ width: '100%', height: '100%', minHeight: 620, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box>
                    <Typography variant="h6">Architecture</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {descriptions[view]}
                    </Typography>
                </Box>
                <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, next) => next && setView(next)} aria-label="architecture diagram">
                    <ToggleButton value="components">Components</ToggleButton>
                    <ToggleButton value="test-run">Test run flow</ToggleButton>
                    <ToggleButton value="graph">Knowledge graph</ToggleButton>
                </ToggleButtonGroup>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }} role="region" aria-label={`${descriptions[view]}`}>
                {view === 'components' && <ComponentArchitecture />}
                {view === 'test-run' && <TestRunFlow />}
                {view === 'graph' && (
                    <Box
                        component="iframe"
                        src="/architecture/graph"
                        title="Interactive Graphify repository knowledge graph"
                        loading="lazy"
                        sandbox="allow-scripts allow-same-origin allow-downloads"
                        referrerPolicy="no-referrer"
                        sx={{ display: 'block', width: '100%', height: '100%', border: 0, bgcolor: '#0f0f1a' }}
                    />
                )}
            </Box>
        </Box>
    )
}
