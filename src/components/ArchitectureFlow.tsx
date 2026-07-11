import { useMemo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
} from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'

interface ArchitectureNodeData extends Record<string, unknown> {
    title: string
    subtitle: string
    details: string
    lane: 'UI' | 'API' | 'Planning' | 'Execution' | 'Persistence'
}

const laneColors: Record<ArchitectureNodeData['lane'], string> = {
    UI: '#1565c0',
    API: '#6a1b9a',
    Planning: '#ef6c00',
    Execution: '#2e7d32',
    Persistence: '#00838f',
}

function ArchitectureNode({ data }: NodeProps<Node<ArchitectureNodeData>>) {
    const theme = useTheme()
    const accent = laneColors[data.lane]
    return (
        <Box sx={{ width: 230, minHeight: 92, px: 1.25, py: 1, border: `1px solid ${accent}`, borderTop: `5px solid ${accent}`, borderRadius: 1, bgcolor: 'background.paper', color: 'text.primary', boxShadow: theme.shadows[2] }}>
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.15 }}>{data.title}</Typography>
            <Typography variant="caption" sx={{ color: accent, fontWeight: 700 }}>{data.subtitle}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.72rem', lineHeight: 1.25 }}>{data.details}</Typography>
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        </Box>
    )
}

const nodeTypes = { architecture: ArchitectureNode }

const nodes: Node<ArchitectureNodeData>[] = [
    { id: 'test-run-tab', type: 'architecture', position: { x: 0, y: 0 }, data: { lane: 'UI', title: 'TestRunTab', subtitle: 'Start + monitor', details: 'Select test IDs, start/abort runs, display progress, results and logs.' } },
    { id: 'topology-flow', type: 'architecture', position: { x: 0, y: 180 }, data: { lane: 'UI', title: 'TopologyFlow', subtitle: 'Read-only topology', details: 'Builds module nodes, AP cables, I/O wires, LEDs and diagnoses.' } },
    { id: 'connections-flow', type: 'architecture', position: { x: 0, y: 360 }, data: { lane: 'UI', title: 'ConnectionsFlow', subtitle: 'Wiring editor', details: 'Loads/saves wiring, exposes handles, changes I/O direction and tests wires.' } },
    { id: 'svg-assets', type: 'architecture', position: { x: 0, y: 540 }, data: { lane: 'UI', title: 'SVG asset pipeline', subtitle: 'Map → parse → decorate', details: 'Resolves SVGs, derives port geometry, hides valves and applies live LED CSS.' } },
    { id: 'fastapi', type: 'architecture', position: { x: 330, y: 0 }, data: { lane: 'API', title: 'FastAPI', subtitle: 'HTTP boundary', details: 'Owns hardware connection, config, test-run, history and PocketBase proxy APIs.' } },
    { id: 'run-api', type: 'architecture', position: { x: 330, y: 180 }, data: { lane: 'API', title: 'Test-run API', subtitle: 'Async orchestration', details: 'Validates requests, creates unique run IDs, locks hardware and exposes status/SSE.' } },
    { id: 'io-api', type: 'architecture', position: { x: 330, y: 360 }, data: { lane: 'API', title: 'I/O API', subtitle: 'Live state', details: 'Reads all module I/O and handles manual output/input operations.' } },
    { id: 'dry-run', type: 'architecture', position: { x: 330, y: 540 }, data: { lane: 'API', title: 'Dry-run endpoint', subtitle: 'Explainable plan', details: 'Returns concrete test/module/wiring instances without touching hardware.' } },
    { id: 'selection-filters', type: 'architecture', position: { x: 330, y: 720 }, data: { lane: 'API', title: 'Selection filters', subtitle: 'UI + CI constraints', details: 'Applies selected test IDs, test-id patterns, safety class, capability filters and CI eligibility before execution.' } },
    { id: 'bench-config', type: 'architecture', position: { x: 660, y: 0 }, data: { lane: 'Planning', title: 'BenchConfig', subtitle: 'Typed source of truth', details: 'Declares module instances, type capabilities, channel capabilities, wiring and test definitions.' } },
    { id: 'test-files', type: 'architecture', position: { x: 660, y: 180 }, data: { lane: 'Planning', title: 'tests/test_*.py', subtitle: 'Executable test modules', details: 'Each module exposes run(hw, config_path) and TEST_DEFINITIONS metadata; hardware actions stay in the test implementation.' } },
    { id: 'test-definition', type: 'architecture', position: { x: 660, y: 360 }, data: { lane: 'Planning', title: 'TestDefinition', subtitle: 'Compatibility contract', details: 'Defines required capabilities, category/pattern rules, wiring type, safety class and allowed_in_ci.' } },
    { id: 'resolver', type: 'architecture', position: { x: 660, y: 540 }, data: { lane: 'Planning', title: 'TestResolver', subtitle: 'Compatibility matching', details: 'Loads definitions, then checks filters, exclusions/overrides, module capabilities, channel capabilities and wiring.' } },
    { id: 'resolved-plan', type: 'architecture', position: { x: 660, y: 720 }, data: { lane: 'Planning', title: 'ResolvedTestPlan', subtitle: 'Selected instances', details: 'Produces one executable TestInstance per compatible module/channel/wire, including reasons for unmatched selections.' } },
    { id: 'test-suite', type: 'architecture', position: { x: 660, y: 900 }, data: { lane: 'Planning', title: 'CI test suite', subtitle: 'Same resolver path', details: 'Pytest resolves the same BenchConfig plan, filters allowed_in_ci tests, runs instances and writes results.' } },
    { id: 'ci', type: 'architecture', position: { x: 990, y: 0 }, data: { lane: 'Execution', title: 'GitLab CI', subtitle: 'External trigger', details: 'Fetches config, applies safety/test filters, starts pytest and publishes the run to PocketBase.' } },
    { id: 'runner', type: 'architecture', position: { x: 990, y: 180 }, data: { lane: 'Execution', title: 'Hardware test runner', subtitle: 'Sequential execution', details: 'Dispatches each resolved instance against the shared interface, updates checkpoints and preserves failed status.' } },
    { id: 'hardware', type: 'architecture', position: { x: 990, y: 360 }, data: { lane: 'Execution', title: 'CPX-AP hardware', subtitle: 'HAL + connection manager', details: 'Reads topology/diagnoses, writes outputs/parameters and resets outputs on completion.' } },
    { id: 'pocketbase', type: 'architecture', position: { x: 1320, y: 180 }, data: { lane: 'Persistence', title: 'PocketBase', subtitle: 'Runs + logs', details: 'Stores run lifecycle, checkpoints, measurements and system logs for UI/CI sharing.' } },
    { id: 'realtime', type: 'architecture', position: { x: 1320, y: 360 }, data: { lane: 'Persistence', title: 'Realtime + SSE', subtitle: 'Live fan-out', details: 'PocketBase events detect external runs; API SSE streams local logs to multiple UI subscribers.' } },
]

const edgeSpecs: Array<[string, string, string]> = [
    ['test-run-tab', 'run-api', 'start / abort'], ['topology-flow', 'io-api', 'poll /io/read-all'], ['connections-flow', 'io-api', 'manual I/O'],
    ['svg-assets', 'topology-flow', 'SVG + ports'], ['svg-assets', 'connections-flow', 'handles'], ['fastapi', 'run-api', 'routes'],
    ['test-run-tab', 'selection-filters', 'selected IDs'], ['ci', 'selection-filters', 'CI policy'], ['run-api', 'bench-config', 'load config'], ['run-api', 'selection-filters', 'request filters'], ['run-api', 'resolver', 'resolve plan'], ['run-api', 'resolved-plan', 'execute selection'],
    ['dry-run', 'resolver', 'resolve only'], ['test-files', 'test-definition', 'metadata'], ['test-files', 'test-suite', 'run(hw, config)'],
    ['bench-config', 'resolver', 'modules + wiring'], ['selection-filters', 'resolver', 'filters'], ['test-definition', 'resolver', 'requirements'], ['resolver', 'resolved-plan', 'instances / reasons'],
    ['resolved-plan', 'runner', 'instances'], ['resolved-plan', 'test-suite', 'same plan'], ['ci', 'test-suite', 'pipeline'],
    ['test-suite', 'hardware', 'CI test calls'], ['runner', 'hardware', 'HAL calls'], ['runner', 'pocketbase', 'run/checkpoints'],
    ['test-suite', 'pocketbase', 'CI results'], ['pocketbase', 'realtime', 'events'], ['realtime', 'test-run-tab', 'external run/logs'],
]

export default function ArchitectureFlow() {
    const theme = useTheme()
    const edges = useMemo<Edge[]>(() => edgeSpecs.map(([source, target, label]) => ({
        id: `${source}-${target}`, source, target, label,
        animated: source === 'realtime' || source === 'run-api',
        markerEnd: { type: MarkerType.ArrowClosed, color: theme.palette.text.secondary },
        style: { stroke: theme.palette.text.secondary, strokeWidth: 1.4 },
        labelStyle: { fill: theme.palette.text.secondary, fontSize: 10 },
        labelBgStyle: { fill: theme.palette.background.paper, fillOpacity: 0.9 },
    })), [theme])

    return (
        <Box sx={{ width: '100%', height: '100%', minHeight: 620, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
                <Typography variant="h6">System data flow</Typography>
                <Typography variant="body2" color="text.secondary">Follow UI or CI selection through test definitions, capability/wiring matching, resolved instances, hardware execution, persistence and live updates.</Typography>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }} role="img" aria-label="CPX-AP testing framework architecture and data flow">
                <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.18 }} minZoom={0.25} maxZoom={1.5} colorMode={theme.palette.mode}>
                    <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
                    <Controls />
                    <MiniMap nodeColor={node => laneColors[(node.data as ArchitectureNodeData).lane]} />
                </ReactFlow>
            </Box>
        </Box>
    )
}
