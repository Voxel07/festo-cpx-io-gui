/**
 * ConnectionsFlow – full-page I/O wiring editor.
 *
 * Shows the topology with orange port handles visible on each module.
 * The user can drag from any port (output) to another port (input) to
 * create a wired connection.  Connections can be saved / loaded as JSON
 * via the FastAPI /connections endpoints.
 *
 * IO edges are rendered with zIndex: 1000 so they appear in front of
 * module images.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
    Box, Button, TextField, Typography, Divider, Alert, Tooltip,
    Stack,
} from '@mui/material'
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    reconnectEdge,
} from '@xyflow/react'
import type { Node, Edge, EdgeChange, Connection, NodeTypes, EdgeTypes } from '@xyflow/react'
import ModuleNode, { STATUS_STYLE } from './ModuleNode'
import type { ModuleNodeData } from './ModuleNode'
import BackplaneNode from './BackplaneNode'
import { WireEdge } from './WireEdge'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus, IOConnection, ConnectionEntry } from '../types'

// ─────────────────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
    mod: ModuleNode as NodeTypes[string],
    backplane: BackplaneNode as NodeTypes[string],
}
const EDGE_TYPES: EdgeTypes = { wire: WireEdge as EdgeTypes[string] }

// Colour for IO wiring edges
const IO_COLOR = '#e65100'

// ─── Port-kind utilities ──────────────────────────────────────────────────────

type PortKind = 'in' | 'out' | 'inout'

/** Extract port kind from handle ID: 'src-out-X0' → 'out', 'src-X0' (legacy) → 'inout' */
function handleKind(handleId: string): PortKind {
    const k = handleId.split('-')[1]
    if (k === 'in' || k === 'out' || k === 'inout') return k
    return 'inout'
}

/** Extract port ID from handle: 'src-out-X0' → 'X0', 'src-X0' (legacy) → 'X0' */
function portId(handleId: string): string {
    const parts = handleId.split('-')
    const known = new Set(['in', 'out', 'inout'])
    return (known.has(parts[1]) ? parts.slice(2) : parts.slice(1)).join('-')
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    topology: Topology | null
    diffStatus: DiffStatus | null
    /** Called when a valve body's mounted valves change (indices 0-based) */
    onModuleValveChange?: (addr: number, mountedValves: number[]) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ConnectionsFlow({ topology, diffStatus, onModuleValveChange }: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])  // ModuleNode | BackplaneNode
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
    const [showCables, setShowCables] = useState(true)
    const [savePath, setSavePath] = useState('connections.json')
    const [loadPath, setLoadPath] = useState('connections.json')
    const [statusMsg, setStatusMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null)

    const ioEdgesRef = useRef<Edge[]>([])
    const topologyName = useRef('')

    // Keep ioEdgesRef current
    useEffect(() => {
        ioEdgesRef.current = edges.filter(e => (e.data as Record<string, unknown>)?.kind === 'io')
    }, [edges])

    // ── Build nodes when topology changes ─────────────────────
    useEffect(() => {
        if (!topology?.Topology?.length) { setNodes([]); setEdges([]); return }
        topologyName.current = topology.Name

        const { nodes: newNodes, edges: chainEdges } = buildLayout(
            topology.Topology, diffStatus, true /* editMode */,
        )
        // Inject valve-change callback into valve body nodes
        const enriched = (newNodes as Node[]).map(n => {
            if (n.type !== 'mod') return n
            const d = n.data as ModuleNodeData
            if (!d.showValveEditor) return n
            return { ...n, data: { ...d, onValveChange: onModuleValveChange } }
        })
        setNodes(enriched)
        // Preserve existing IO edges if nodes are still valid
        const validIds = new Set(topology.Topology.map(m => String(m.Adress)))
        const validIo = ioEdgesRef.current.filter(
            e => validIds.has(e.source) && validIds.has(e.target),
        )
        setEdges([...chainEdges, ...validIo])
    }, [topology, diffStatus, setNodes, setEdges])

    // ── Propagate IO edges → node connection lists ─────────────────
    useEffect(() => {
        const ioEdges = edges.filter(e => (e.data as Record<string, unknown>)?.kind === 'io')
        setNodes(prev => prev.map(n => {
            if (n.type !== 'mod') return n
            const conns: ConnectionEntry[] = ioEdges
                .filter(e => e.source === n.id || e.target === n.id)
                .map(e => {
                    const isSrc = e.source === n.id
                    const myHandle = String(isSrc ? e.sourceHandle : e.targetHandle ?? '')
                    const peerHandle = String(isSrc ? e.targetHandle : e.sourceHandle ?? '')
                    return {
                        portId: portId(myHandle),
                        peerAddr: isSrc ? e.target : e.source,
                        peerPort: portId(peerHandle),
                        dir: isSrc ? ('src' as const) : ('tgt' as const),
                    }
                })
            return { ...n, data: { ...(n.data as ModuleNodeData), connections: conns } }
        }))
    }, [edges, setNodes])

    // ── Edge change: protect chain/cable edges ────────────
    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        _onEdgesChange(
            changes.filter(c =>
                c.type !== 'remove' ||
                ioEdgesRef.current.some(e => e.id === c.id),
            ),
        )
    }, [_onEdgesChange])

    // ── New connection ────────────────────────────────────
    const onConnect = useCallback((connection: Connection) => {
        let sh = connection.sourceHandle ?? ''
        let th = connection.targetHandle ?? ''
        let srcNode = connection.source
        let tgtNode = connection.target
        if (!sh.startsWith('src-') || !th.startsWith('tgt-')) return
        if (srcNode === tgtNode) return

        // Normalise direction: animation always flows output → input.
        // If the user dragged FROM an input port, flip source↔target.
        if (handleKind(sh) === 'in') {
            const tmp = srcNode; srcNode = tgtNode; tgtNode = tmp
            const tmpH = sh
            sh = th.replace(/^tgt-/, 'src-')   // tgt-out-X1 → src-out-X1
            th = tmpH.replace(/^src-/, 'tgt-') // src-in-X0  → tgt-in-X0
        }

        const pSrc = portId(sh)
        const pTgt = portId(th)
        const edgeId = `io-${srcNode}-${pSrc}-${tgtNode}-${pTgt}`

        // Wire colour by source port kind
        const outKind = handleKind(sh)
        const wireColor = outKind === 'out' ? '#2e7d32' : outKind === 'in' ? '#1565c0' : IO_COLOR

        const newEdge: Edge = {
            id: edgeId,
            source: srcNode,
            sourceHandle: sh,
            target: tgtNode,
            targetHandle: th,
            type: 'wire',
            animated: true,
            zIndex: 1000,
            style: { stroke: wireColor, strokeWidth: 2 },
            label: `#${srcNode}:${pSrc} → #${tgtNode}:${pTgt}`,
            data: { kind: 'io', portSrc: pSrc, portTgt: pTgt, wireColor },
        }
        setEdges(prev => addEdge(newEdge, prev))
    }, [setEdges])

    // ── Reconnect: drag an existing IO edge endpoint to a new port ──
    const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        setEdges(prev => reconnectEdge(oldEdge, newConnection, prev))
    }, [setEdges])

    // ── Validate: enforce input→output compatibility ───────────
    const isValidConnection = useCallback((conn: Connection | Edge): boolean => {
        const c = conn as Connection
        if (c.source === c.target) return false
        const sh = c.sourceHandle ?? ''
        const th = c.targetHandle ?? ''
        if (!sh.startsWith('src-') || !th.startsWith('tgt-')) return false
        const sk = handleKind(sh)
        const tk = handleKind(th)
        // inout is compatible with everything; in↔out is allowed; in↔in and out↔out are not
        if (sk === 'inout' || tk === 'inout') return true
        return sk !== tk  // out→in: OK, in→out: OK (user dragged reverse)
    }, [])

    // ── Save ──────────────────────────────────────────────
    async function doSave() {
        const connections: IOConnection[] = ioEdgesRef.current.map(e => {
            const d = e.data as Record<string, unknown>
            return {
                id: e.id,
                source_module_addr: parseInt(e.source),
                source_channel: String(d.portSrc ?? portId(String(e.sourceHandle ?? ''))),
                target_module_addr: parseInt(e.target),
                target_channel: String(d.portTgt ?? portId(String(e.targetHandle ?? ''))),
                source_handle: String(e.sourceHandle ?? ''),
                target_handle: String(e.targetHandle ?? ''),
                label: typeof e.label === 'string' ? e.label : '',
            }
        })
        try {
            const r = await fetch('/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topology_name: topologyName.current,
                    connections,
                    save_path: savePath,
                }),
            })
            const d = await r.json()
            setStatusMsg(r.ok
                ? { text: `Saved → ${d.saved_to}`, severity: 'success' }
                : { text: `Error: ${d.detail}`, severity: 'error' })
        } catch (e) {
            setStatusMsg({ text: `Error: ${(e as Error).message}`, severity: 'error' })
        }
    }

    // ── Load ──────────────────────────────────────────────
    async function doLoad() {
        try {
            const r = await fetch(`/connections?file_path=${encodeURIComponent(loadPath)}`)
            const d = await r.json()
            if (!r.ok) { setStatusMsg({ text: `Error: ${d.detail}`, severity: 'error' }); return }

            const loaded: IOConnection[] = d.connections ?? []
            const newIo: Edge[] = loaded.map(c => ({
                id: c.id,
                source: String(c.source_module_addr),
                // Prefer stored full handle; fall back to inout for old files
                sourceHandle: c.source_handle ?? `src-inout-${c.source_channel}`,
                target: String(c.target_module_addr),
                targetHandle: c.target_handle ?? `tgt-inout-${c.target_channel}`,
                type: 'wire',
                animated: true,
                zIndex: 1000,
                style: { stroke: IO_COLOR, strokeWidth: 2.5 },
                label: c.label ?? `#${c.source_module_addr}:${c.source_channel} → #${c.target_module_addr}:${c.target_channel}`,
                data: { kind: 'io', portSrc: c.source_channel, portTgt: c.target_channel },
            }))

            setEdges(prev => [
                ...prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io'),
                ...newIo,
            ])
            setStatusMsg({ text: `Loaded ${loaded.length} connection(s)`, severity: 'success' })
        } catch (e) {
            setStatusMsg({ text: `Error: ${(e as Error).message}`, severity: 'error' })
        }
    }

    // ── Clear all IO edges ────────────────────────────────
    function doClear() {
        setEdges(prev => prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io'))
        setStatusMsg(null)
    }

    // ── Visible edges ─────────────────────────────────────
    const visibleEdges = showCables
        ? edges
        : edges.filter(e => (e.data as Record<string, unknown>)?.kind !== 'cable')

    const ioCount = ioEdgesRef.current.length

    // ─────────────────────────────────────────────────────
    if (!topology) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                    Generate or load a topology first to use the connection editor.
                </Typography>
            </Box>
        )
    }

    return (
        <ReactFlow
            nodes={nodes}
            edges={visibleEdges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            isValidConnection={isValidConnection}
            edgesReconnectable
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.1}
            maxZoom={4}
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

            {/* ── Right-side control panel ── */}
            <Panel position="top-right">
                <Box sx={{
                    background: 'rgba(255,255,255,0.97)',
                    border: '1px solid #e0e0e0',
                    borderRadius: 1.5,
                    p: 1.25,
                    boxShadow: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    width: 260,
                }}>

                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#e65100' }}>
                        🔧 I/O Connection Editor
                    </Typography>

                    <Typography sx={{ fontSize: '0.6rem', color: '#555', lineHeight: 1.5 }}>
                        Click &amp; drag from an <strong style={{ color: '#ff9800' }}>orange port</strong> to
                        another port to create a wired connection.
                        {ioCount > 0 && (
                            <span style={{ color: '#e65100', fontWeight: 700 }}>
                                {` ${ioCount} connection${ioCount !== 1 ? 's' : ''}`}
                            </span>
                        )}
                    </Typography>

                    <Divider />

                    {/* Cable visibility toggle */}
                    <Button
                        size="small"
                        variant={showCables ? 'outlined' : 'contained'}
                        color="inherit"
                        onClick={() => setShowCables(s => !s)}
                        sx={{
                            fontSize: '0.65rem', py: 0.25, color: showCables ? '#546e7a' : '#fff',
                            background: showCables ? 'transparent' : '#546e7a',
                            borderColor: '#546e7a',
                            '&:hover': { borderColor: '#455a64' }
                        }}
                    >
                        {showCables ? '🔌 Hide Cable Topology' : '🔌 Show Cable Topology'}
                    </Button>

                    <Divider />

                    {/* Save */}
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#333' }}>Save connections</Typography>
                    <Stack direction="row" spacing={0.5}>
                        <TextField
                            size="small" value={savePath}
                            onChange={e => setSavePath(e.target.value)}
                            placeholder="connections.json"
                            sx={{ flex: 1 }}
                            inputProps={{ style: { fontSize: '0.65rem', padding: '4px 8px' } }}
                        />
                        <Button size="small" variant="contained" color="success"
                            onClick={doSave}
                            sx={{ fontSize: '0.65rem', py: 0.3, minWidth: 50, whiteSpace: 'nowrap' }}>
                            💾 Save
                        </Button>
                    </Stack>

                    {/* Load */}
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: '#333' }}>Load connections</Typography>
                    <Stack direction="row" spacing={0.5}>
                        <TextField
                            size="small" value={loadPath}
                            onChange={e => setLoadPath(e.target.value)}
                            placeholder="connections.json"
                            sx={{ flex: 1 }}
                            inputProps={{ style: { fontSize: '0.65rem', padding: '4px 8px' } }}
                        />
                        <Button size="small" variant="outlined"
                            onClick={doLoad}
                            sx={{ fontSize: '0.65rem', py: 0.3, minWidth: 50, whiteSpace: 'nowrap' }}>
                            📂 Load
                        </Button>
                    </Stack>

                    {/* Clear */}
                    {ioCount > 0 && (
                        <Tooltip title="Delete all drawn I/O wires">
                            <Button size="small" variant="outlined" color="error"
                                onClick={doClear}
                                sx={{ fontSize: '0.65rem', py: 0.3 }}>
                                🗑️ Clear all wires
                            </Button>
                        </Tooltip>
                    )}

                    {/* Status */}
                    {statusMsg && (
                        <Alert severity={statusMsg.severity} onClose={() => setStatusMsg(null)}
                            sx={{ py: 0, fontSize: '0.6rem', '& .MuiAlert-message': { wordBreak: 'break-all' } }}>
                            {statusMsg.text}
                        </Alert>
                    )}

                    <Divider />
                    <Typography sx={{ fontSize: '0.52rem', color: '#999', lineHeight: 1.7 }}>
                        <span style={{ color: '#1565c0' }}>●</span> input port &nbsp;
                        <span style={{ color: '#2e7d32' }}>●</span> output port &nbsp;
                        <span style={{ color: '#ff9800' }}>●</span> inout / unknown<br />
                        ╌╌ cable &nbsp;
                        <span style={{ color: IO_COLOR }}>──▶</span> I/O wire (animated)<br />
                        Drag wire endpoint to reconnect.
                    </Typography>
                </Box>
            </Panel>
        </ReactFlow>
    )
}
