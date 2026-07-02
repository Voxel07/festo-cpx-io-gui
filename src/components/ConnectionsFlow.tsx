/**
 * ConnectionsFlow – full-page I/O wiring editor.
 *
 * Shows the topology with port handles visible on each module.
 * Drag from a port to another to create a wired I/O connection.
 * Save/load connections (including valve-mount info) via /connections.
 */
import { useEffect, useRef, useReducer, useCallback, useState, useContext } from 'react'
import { Box, Typography } from '@mui/material'
import {
    useNodesState,
    useEdgesState,
    reconnectEdge,
} from '@xyflow/react'
import type { Node, Edge, EdgeChange, Connection, NodeTypes, EdgeTypes } from '@xyflow/react'
import TopologyCanvas from './TopologyCanvas'
import ModuleNode from './ModuleNode'
import type { ModuleNodeData } from './ModuleNode'
import BackplaneNode from './BackplaneNode'
import { WireEdge } from './WireEdge'
import { CableEdge } from './CableEdge'
import ModuleActuateModal from './ModuleActuateModal'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus, ConnectionEntry, BenchConfig, WiringConnection, TopologyModule } from '../types'
import ConnectionsToolbar from './ConnectionsToolbar'
import WiringTestPanel from './WiringTestPanel'
import { AlertsContext } from '../utils/AlertsManager'
import ChannelSelectionModal from './ChannelSelectionModal'

// ─────────────────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
    mod: ModuleNode as NodeTypes[string],
    backplane: BackplaneNode as NodeTypes[string],
}
const EDGE_TYPES: EdgeTypes = { wire: WireEdge as EdgeTypes[string], cable: CableEdge as EdgeTypes[string] }

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

/** Extract a human-readable error string from a non-ok Response.
 *  Tries JSON → detail field first, then falls back to raw text, then to "HTTP <status>". */
async function extractErrMsg(r: Response): Promise<string> {
    try {
        const text = await r.text()
        if (text.trim()) {
            try {
                const j = JSON.parse(text)
                if (j.detail) return String(j.detail)
            } catch { /* not JSON — use raw text */ }
            return text.trim().slice(0, 300)
        }
    } catch { /* body unreadable */ }
    return `HTTP ${r.status}`
}

const isM12 = (name?: string) => !!(name ?? '').includes('M12')

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    topology: Topology | null
    diffStatus: DiffStatus | null
    /** IP address of the CPX-AP gateway (from App toolbar) */
    ip?: string
    /** Called when a valve body's mounted valves change (indices 0-based) */
    onModuleValveChange?: (addr: number, mountedValves: number[], valveSlots?: number) => void
    /** Called when a BenchConfig is loaded — allows parent to sync topology state */
    onConfigLoad?: (config: BenchConfig) => void
    rawConfig?: BenchConfig | null
    configPath: string
}

interface ConnectionsFlowState {
    showCables: boolean
    showWires: boolean
    showPsConfig: boolean
    psComPort: string
    psIpAddr: string
    psPlChannel: string
    psPsChannel: string
    showTestPanel: boolean
    outputStates: Record<string, boolean>
    testResults: Record<string, { values?: boolean[]; value: boolean | null; error?: string }>
    testBusy: Set<string>
    testAllBusy: boolean
    actuateModule: TopologyModule | null
    actuateMountedValves: number[] | undefined
    connectionMode: 'port' | 'channel'
}

const initialConnectionsFlowState: ConnectionsFlowState = {
    showCables: false,
    showWires: true,
    showPsConfig: false,
    psComPort: '',
    psIpAddr: '',
    psPlChannel: '',
    psPsChannel: '',
    showTestPanel: false,
    outputStates: {},
    testResults: {},
    testBusy: new Set(),
    testAllBusy: false,
    actuateModule: null,
    actuateMountedValves: undefined,
    connectionMode: 'port',
}

type ConnectionsFlowAction =
    | { type: 'TOGGLE_CABLES' }
    | { type: 'TOGGLE_WIRES' }
    | { type: 'TOGGLE_PS_CONFIG' }
    | { type: 'SET_PS_COMPORT'; port: string }
    | { type: 'SET_PS_IPADDR'; ip: string }
    | { type: 'SET_PS_PL_CHANNEL'; ch: string }
    | { type: 'SET_PS_PS_CHANNEL'; ch: string }
    | { type: 'SET_PS_CONFIG_ALL'; ComPort: string; IpAddr: string; plChannel: string; psChannel: string }
    | { type: 'TOGGLE_TEST_PANEL' }
    | { type: 'SET_OUTPUT_STATE'; edgeId: string; value: boolean }
    | { type: 'SET_OUTPUT_STATES'; states: Record<string, boolean> }
    | { type: 'SET_TEST_RESULT'; edgeId: string; result: { values?: boolean[]; value: boolean | null; error?: string } }
    | { type: 'SET_TEST_RESULTS'; results: Record<string, { values?: boolean[]; value: boolean | null; error?: string }> }
    | { type: 'SET_TEST_BUSY'; edgeId: string; busy: boolean }
    | { type: 'SET_TEST_ALL_BUSY'; busy: boolean }
    | { type: 'OPEN_ACTUATE'; module: TopologyModule; mountedValves: number[] | undefined }
    | { type: 'CLOSE_ACTUATE' }
    | { type: 'SET_CONNECTION_MODE'; mode: 'port' | 'channel' }

function connectionsFlowReducer(state: ConnectionsFlowState, action: ConnectionsFlowAction): ConnectionsFlowState {
    switch (action.type) {
        case 'TOGGLE_CABLES':
            return { ...state, showCables: !state.showCables }
        case 'TOGGLE_WIRES':
            return { ...state, showWires: !state.showWires }
        case 'TOGGLE_PS_CONFIG':
            return { ...state, showPsConfig: !state.showPsConfig }
        case 'SET_PS_COMPORT':
            return { ...state, psComPort: action.port }
        case 'SET_PS_IPADDR':
            return { ...state, psIpAddr: action.ip }
        case 'SET_PS_PL_CHANNEL':
            return { ...state, psPlChannel: action.ch }
        case 'SET_PS_PS_CHANNEL':
            return { ...state, psPsChannel: action.ch }
        case 'SET_PS_CONFIG_ALL':
            return {
                ...state,
                psComPort: action.ComPort,
                psIpAddr: action.IpAddr,
                psPlChannel: action.plChannel,
                psPsChannel: action.psChannel,
            }
        case 'TOGGLE_TEST_PANEL':
            return { ...state, showTestPanel: !state.showTestPanel }
        case 'SET_OUTPUT_STATE':
            return {
                ...state,
                outputStates: { ...state.outputStates, [action.edgeId]: action.value },
            }
        case 'SET_OUTPUT_STATES':
            return { ...state, outputStates: action.states }
        case 'SET_TEST_RESULT':
            return {
                ...state,
                testResults: { ...state.testResults, [action.edgeId]: action.result },
            }
        case 'SET_TEST_RESULTS':
            return { ...state, testResults: action.results }
        case 'SET_TEST_BUSY': {
            const next = new Set(state.testBusy)
            if (action.busy) next.add(action.edgeId); else next.delete(action.edgeId)
            return { ...state, testBusy: next }
        }
        case 'SET_TEST_ALL_BUSY':
            return { ...state, testAllBusy: action.busy }
        case 'OPEN_ACTUATE':
            return { ...state, actuateModule: action.module, actuateMountedValves: action.mountedValves }
        case 'CLOSE_ACTUATE':
            return { ...state, actuateModule: null, actuateMountedValves: undefined }
        case 'SET_CONNECTION_MODE':
            return { ...state, connectionMode: action.mode }
        default:
            return state
    }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ConnectionsFlow({ topology, diffStatus, ip, onModuleValveChange, onConfigLoad, rawConfig, configPath }: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])  // ModuleNode | BackplaneNode
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])

    const [state, dispatch] = useReducer(connectionsFlowReducer, initialConnectionsFlowState)
    const {
        showCables,
        showWires,
        showPsConfig,
        psComPort,
        psIpAddr,
        psPlChannel,
        psPsChannel,
        showTestPanel,
        outputStates,
        testResults,
        testBusy,
        testAllBusy,
        actuateModule,
        actuateMountedValves,
        connectionMode,
    } = state

    const ioEdgesRef = useRef<Edge[]>([])
    /** IO edges stashed by doLoad so the topology rebuild effect restores them
     *  rather than wiping them when onConfigLoad triggers a topology change. */
    const pendingIoRef = useRef<Edge[]>([])
    const topologyName = useRef('')

    const alerts = useContext(AlertsContext)

    // Keep ioEdgesRef current
    useEffect(() => {
        ioEdgesRef.current = edges.filter(e => (e.data as Record<string, unknown>)?.kind === 'io')
    }, [edges])

    // Fetch param 20201 for VABX modules
    const [vabxInputs, setVabxInputs] = useState<Record<number, boolean>>({})

    const [pendingConn, setPendingConn] = useState<{
        conn: Connection,
        srcIsM12: boolean,
        tgtIsM12: boolean,
        sh: string,
        th: string,
        srcNode: string,
        tgtNode: string
    } | null>(null)

    useEffect(() => {
        if (!topology?.Topology?.length || !ip) return
        topology.Topology.forEach(async (mod) => {
            if (mod.Name.startsWith('VABX')) {
                try {
                    const r = await fetch(`/io/module/${mod.Adress}/parameter/20201?ip_address=${encodeURIComponent(ip)}`)
                    if (r.ok) {
                        setVabxInputs(prev => ({ ...prev, [mod.Adress]: true }))
                    }
                } catch (e) {
                    // ignore
                }
            }
        })
    }, [topology, ip])

    // ── Sync from rawConfig ──────────────────────────────────────────────
    useEffect(() => {
        if (!rawConfig) return
        const d = rawConfig

        if (d.power_supply) {
            const rawCom = d.power_supply.ComPort || d.power_supply.comport || ''
            const rawIp = d.power_supply['Ip addr'] || d.power_supply.ip_address || ''
            // If both are somehow present in the file, prioritize COM to prevent UI deadlock
            const finalCom = rawCom
            const finalIp = rawCom ? '' : rawIp

            dispatch({
                type: 'SET_PS_CONFIG_ALL',
                ComPort: finalCom.replace(/^COM\s*/i, ''),
                IpAddr: finalIp,
                plChannel: d.power_supply.pl_channel != null ? String(d.power_supply.pl_channel) : '',
                psChannel: d.power_supply.ps_channel != null ? String(d.power_supply.ps_channel) : '',
            })
        } else {
            dispatch({ type: 'SET_PS_CONFIG_ALL', ComPort: '', IpAddr: '', plChannel: '', psChannel: '' })
        }

        const catByAddr: Record<number, string> = {}
        ; (d.module_instances ?? []).forEach(inst => {
            catByAddr[inst.address] = inst.category
        })

        function srcKind(addr: number): string {
            const cat = catByAddr[addr] ?? 'inout'
            if (cat === 'inout') return 'inout'
            return 'out'
        }
        function tgtKind(addr: number): string {
            const cat = catByAddr[addr] ?? 'inout'
            if (cat === 'inout') return 'inout'
            return 'in'
        }

        const loaded: WiringConnection[] = d.wiring ?? []
        const newIo: Edge[] = loaded.map(c => {
            const srcAddrStr = c.source_instance_id.replace(/^mod-0*/, '')
            const tgtAddrStr = c.target_instance_id.replace(/^mod-0*/, '')
            const srcAddr = srcAddrStr === '' ? 0 : parseInt(srcAddrStr)
            const tgtAddr = tgtAddrStr === '' ? 0 : parseInt(tgtAddrStr)
            const resolvedSrcHandle = c.source_handle || `src-${srcKind(srcAddr)}-${c.source_channel}`
            const resolvedTgtHandle = c.target_handle || `tgt-${tgtKind(tgtAddr)}-${c.target_channel}`
            return {
                id: c.id,
                source: String(srcAddr),
                sourceHandle: resolvedSrcHandle,
                target: String(tgtAddr),
                targetHandle: resolvedTgtHandle,
                type: 'wire',
                animated: true,
                zIndex: 1000,
                style: { stroke: IO_COLOR, strokeWidth: 2.5 },
                label: c.label ?? `#${srcAddr}:${c.source_channel} → #${tgtAddr}:${c.target_channel}`,
                data: {
                    kind: 'io',
                    portSrc: c.source_channel,
                    portTgt: c.target_channel,
                    subSrc: c.source_subchannel,
                    subTgt: c.target_subchannel,
                    waypoints: c.waypoints ?? undefined,
                    straight: c.straight ?? false,
                },
            }
        })

        pendingIoRef.current = newIo
        setEdges(prev => [
            ...prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io'),
            ...newIo,
        ])
    }, [rawConfig, setEdges])

    // ── Build nodes when topology changes ─────────────────────
    useEffect(() => {
        if (!topology?.Topology?.length) { setNodes([]); setEdges([]); return }
        topologyName.current = topology.Name

        const { nodes: newNodes, edges: chainEdges } = buildLayout(
            topology.Topology, diffStatus, true /* editMode */,
        )

        setNodes(prevNodes => {
            const prevNodeMap = new Map(prevNodes.map(n => [n.id, n]))
            return (newNodes as Node[]).map(n => {
                if (n.type !== 'mod') return n
                const d = n.data as ModuleNodeData
                const prev = prevNodeMap.get(n.id)
                const prevHidden = prev ? (prev.data as ModuleNodeData).hiddenValves : undefined
                return {
                    ...n,
                    data: {
                        ...d,
                        hiddenValves: prevHidden ?? d.hiddenValves ?? [],
                        onValveChange: d.showValveEditor ? onModuleValveChange : d.onValveChange,
                        hasVabxInputs: vabxInputs[d.mod.Adress] ?? false,
                    },
                }
            })
        })

        // Preserve existing IO edges if nodes are still valid.
        // Prefer pendingIoRef (set by doLoad) over ioEdgesRef so that topology
        // rebuilds triggered by onConfigLoad don't wipe freshly loaded IO edges.
        const validIds = new Set(topology.Topology.map(m => String(m.Adress)))
        const sourceIo = pendingIoRef.current.length > 0 ? pendingIoRef.current : ioEdgesRef.current
        pendingIoRef.current = []
        const validIo = sourceIo.filter(
            e => validIds.has(e.source) && validIds.has(e.target),
        )
        setEdges([...chainEdges, ...validIo])
    }, [topology, diffStatus, onModuleValveChange, setNodes, setEdges, vabxInputs])

    // ── Propagate IO edges → node connection lists ─────────────────
    useEffect(() => {
        const ioEdges = edges.filter(e => (e.data as Record<string, unknown>)?.kind === 'io')
        setNodes(prev => prev.map(n => {
            if (n.type !== 'mod') return n
            const conns: ConnectionEntry[] = ioEdges.reduce<ConnectionEntry[]>((acc, e) => {
                if (e.source === n.id || e.target === n.id) {
                    const isSrc = e.source === n.id
                    const myHandle = String(isSrc ? e.sourceHandle : e.targetHandle ?? '')
                    const peerHandle = String(isSrc ? e.targetHandle : e.sourceHandle ?? '')
                    acc.push({
                        portId: portId(myHandle),
                        peerAddr: isSrc ? e.target : e.source,
                        peerPort: portId(peerHandle),
                        dir: isSrc ? ('src' as const) : ('tgt' as const),
                    })
                }
                return acc
            }, [])
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

    // ── Right-click module → open actuate modal ──────────
    const onNodeContextMenu = useCallback((_event: React.MouseEvent, node: Node) => {
        _event.preventDefault()
        if (node.type !== 'mod') return
        const d = node.data as ModuleNodeData
        const mounted = (d.mod.MountedValves && d.mod.MountedValves.length >= 0) ? d.mod.MountedValves : undefined
        dispatch({ type: 'OPEN_ACTUATE', module: d.mod, mountedValves: mounted })
    }, [dispatch])

    // ── New connection ────────────────────────────────────
    const processConnection = useCallback((
        srcNode: string, tgtNode: string, sh: string, th: string,
        subSrc?: number, subTgt?: number
    ) => {
        const pSrc = portId(sh)
        const pTgt = portId(th)
        
        // Block same-port self-loop (same module AND same port ID) but allow
        // cross-port connections on the same module (DIDO / DIO loopback).
        if (srcNode === tgtNode && pSrc === pTgt) return
        
        // If subchannels are provided, append them to the edge ID to make it unique per channel.
        const edgeId = subSrc !== undefined && subTgt !== undefined
            ? `io-${srcNode}-${pSrc}.${subSrc}-${tgtNode}-${pTgt}.${subTgt}`
            : `io-${srcNode}-${pSrc}-${tgtNode}-${pTgt}`

        // Wire colour by source port kind
        const outKind = handleKind(sh)
        let wireColor = outKind === 'out' ? '#2e7d32' : outKind === 'in' ? '#1565c0' : IO_COLOR

        // Multi-color logic for multiple edges to same device
        if (subSrc !== undefined || subTgt !== undefined) {
            // Count existing edges between these two nodes
            const existingEdges = edges.filter(e => e.source === srcNode && e.target === tgtNode)
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
        }

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
            label: subSrc !== undefined
                ? `#${srcNode}:${pSrc}.${subSrc} \u2192 #${tgtNode}:${pTgt}.${subTgt}`
                : `#${srcNode}:${pSrc} \u2192 #${tgtNode}:${pTgt}`,
            data: { kind: 'io', portSrc: pSrc, portTgt: pTgt, subSrc, subTgt, wireColor, straight: false },
        }
        // Only deduplicate by edge ID — allow fan-out (one output → many inputs)
        // and fan-in (many outputs → one input). Exact duplicate = same ID.
        setEdges(prev => prev.some(e => e.id === edgeId) ? prev : [...prev, newEdge])
    }, [edges, setEdges])

    const onConnect = useCallback((connection: Connection) => {
        let sh = connection.sourceHandle ?? ''
        let th = connection.targetHandle ?? ''
        let srcNode = connection.source
        let tgtNode = connection.target
        if (!sh.startsWith('src-') || !th.startsWith('tgt-')) return

        // Normalise direction: animation always flows output → input.
        // If the user dragged FROM an input port, flip source↔target.
        if (handleKind(sh) === 'in') {
            const tmp = srcNode; srcNode = tgtNode; tgtNode = tmp
            const tmpH = sh
            sh = th.replace(/^tgt-/, 'src-')   // tgt-out-X1 → src-out-X1
            th = tmpH.replace(/^src-/, 'tgt-') // src-in-X0  → tgt-in-X0
        }

        if (connectionMode === 'channel') {
            const srcMod = topology?.Topology?.find(m => String(m.Adress) === srcNode)
            const tgtMod = topology?.Topology?.find(m => String(m.Adress) === tgtNode)
            const srcIsM12 = isM12(srcMod?.Name)
            const tgtIsM12 = isM12(tgtMod?.Name)
            
            if (srcIsM12 || tgtIsM12) {
                setPendingConn({ conn: connection, srcIsM12, tgtIsM12, sh, th, srcNode, tgtNode })
            } else {
                // both M8, auto connect on channel 0
                processConnection(srcNode, tgtNode, sh, th, 0, 0)
            }
        } else {
            processConnection(srcNode, tgtNode, sh, th)
        }
    }, [connectionMode, topology, processConnection])

    // ── Reconnect: drag an existing IO edge endpoint to a new port ──
    const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        setEdges(prev => reconnectEdge(oldEdge, newConnection, prev))
    }, [setEdges])

    // ── Validate: enforce input→output compatibility + block exact duplicates ──
    const isValidConnection = useCallback((conn: Connection | Edge): boolean => {
        const c = conn as Connection
        const sh = c.sourceHandle ?? ''
        const th = c.targetHandle ?? ''
        if (!sh.startsWith('src-') || !th.startsWith('tgt-')) return false
        const sk = handleKind(sh)
        const tk = handleKind(th)
        // in↔in or out↔out not allowed
        if (sk !== 'inout' && tk !== 'inout' && sk === tk) return false
        // Compute the normalised edge ID (mirrors onConnect direction flip) to
        // block exact duplicates while still allowing fan-out / fan-in.
        let srcNode = c.source, tgtNode = c.target, nsh = sh, nth = th
        if (handleKind(sh) === 'in') {
            srcNode = c.target; tgtNode = c.source
            nsh = th.replace(/^tgt-/, 'src-')
            nth = sh.replace(/^src-/, 'tgt-')
        }
        let subSrc: number | undefined
        let subTgt: number | undefined
        if ((c.data as Record<string, unknown>)?.subSrc !== undefined) {
            subSrc = (c.data as Record<string, unknown>).subSrc as number
            subTgt = (c.data as Record<string, unknown>).subTgt as number
        }

        // Block same-port self-loop; allow cross-port same-module connections (DIDO / DIO loopback).
        if (srcNode === tgtNode && portId(nsh) === portId(nth)) return false
        
        const edgeId = subSrc !== undefined && subTgt !== undefined
            ? `io-${srcNode}-${portId(nsh)}.${subSrc}-${tgtNode}-${portId(nth)}.${subTgt}`
            : `io-${srcNode}-${portId(nsh)}-${tgtNode}-${portId(nth)}`

        return !ioEdgesRef.current.some(e => e.id === edgeId)
    }, [])

    // ── Save ──────────────────────────────────────────────
    async function doSave() {
        try {
            // 1. Fetch current config
            const getRes = await fetch(`/config?file_path=${encodeURIComponent(configPath)}`)
            if (!getRes.ok) {
                alerts?.showAlert('error', 'Could not read existing configuration to update. Make sure you generate/save a configuration first.')
                return
            }
            const config: BenchConfig = await getRes.json()

            // 2. Map edges back to WiringConnection structure
            const wiring: WiringConnection[] = ioEdgesRef.current.map(e => {
                const d = e.data as Record<string, unknown>
                const srcAddr = parseInt(e.source)
                const tgtAddr = parseInt(e.target)
                const srcInstId = `mod-${srcAddr.toString().padStart(3, '0')}`
                const tgtInstId = `mod-${tgtAddr.toString().padStart(3, '0')}`
                return {
                    id: e.id,
                    source_instance_id: srcInstId,
                    source_channel: String(d.portSrc ?? portId(String(e.sourceHandle ?? ''))),
                    target_instance_id: tgtInstId,
                    target_channel: String(d.portTgt ?? portId(String(e.targetHandle ?? ''))),
                    source_handle: String(e.sourceHandle ?? ''),
                    target_handle: String(e.targetHandle ?? ''),
                    label: typeof e.label === 'string' ? e.label : '',
                    waypoints: (d.waypoints as Array<{ x: number; y: number }>) ?? undefined,
                    straight: d.straight === true ? true : undefined,
                    source_subchannel: typeof d.subSrc === 'number' ? d.subSrc : undefined,
                    target_subchannel: typeof d.subTgt === 'number' ? d.subTgt : undefined,
                }
            })

            // 3. Update mounted valves in module_instances
            const mountedValvesMap: Record<string, number[]> = {}
            const valveSlotsMap: Record<string, number> = {}
            nodes.forEach(n => {
                if (n.type !== 'mod') return
                const d = n.data as ModuleNodeData
                if (d.mod.MountedValves && d.mod.MountedValves.length >= 0) {
                    mountedValvesMap[String(d.mod.Adress)] = d.mod.MountedValves
                }
                if (d.mod.ValveSlots !== undefined) {
                    valveSlotsMap[String(d.mod.Adress)] = d.mod.ValveSlots
                }
            })

            config.wiring = wiring
            config.module_instances = (config.module_instances || []).map(inst => {
                const mv = mountedValvesMap[String(inst.address)]
                const vs = valveSlotsMap[String(inst.address)]
                let next = inst
                if (mv !== undefined) next = { ...next, mounted_valves: mv }
                if (vs !== undefined) next = { ...next, valve_slots: vs }
                return next
            })

            const hasPs = psComPort.trim() || psIpAddr.trim() || psPlChannel.trim() || psPsChannel.trim()
            const formattedComPort = psComPort.trim() ? (
                /^\d+$/.test(psComPort.trim()) ? `COM${psComPort.trim()}` : psComPort.trim()
            ) : null
            // Ensure only one connection method is saved
            const formattedIpAddr = formattedComPort ? null : (psIpAddr.trim() || null)

            config.power_supply = hasPs ? {
                ComPort: formattedComPort,
                comport: null,
                'Ip addr': formattedIpAddr,
                ip_address: null,
                pl_channel: psPlChannel.trim() ? parseInt(psPlChannel) : null,
                ps_channel: psPsChannel.trim() ? parseInt(psPsChannel) : null,
            } : null

            const saveRes = await fetch('/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config,
                    save_path: configPath,
                }),
            })
            const d = await saveRes.json()
            if (saveRes.ok) {
                alerts?.showAlert('success', `Saved \u2192 ${d.saved_to}`)
            } else {
                alerts?.showAlert('error', `Error: ${d.detail}`)
            }
        } catch (e) {
            alerts?.showAlert('error', `Error: ${(e as Error).message}`)
        }
    }

    // ── Load ──────────────────────────────────────────────
    async function doLoad() {
        try {
            const r = await fetch(`/config?file_path=${encodeURIComponent(configPath)}`)
            const d: BenchConfig = await r.json()
            if (!r.ok) {
                alerts?.showAlert('error', `Error: ${(d as any).detail ?? 'Unknown error'}`)
                return
            }

            // Let the parent sync topology / rawConfig from the loaded file
            onConfigLoad?.(d)

            alerts?.showAlert('success', `Loaded config from ${configPath}`)
        } catch (e) {
            alerts?.showAlert('error', `Error: ${(e as Error).message}`)
        }
    }

    // ── Clear all IO edges ────────────────────────────────
    function doClear() {
        setEdges(prev => prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io'))
    }

    // ── Wire Test: connections derived from current IO edges ──────
    interface TestConn {
        id: string; srcAddr: number; srcCh: string
        tgtAddr: number; tgtCh: string; label: string
        /** Channels per port: 2 for M12-5P connectors, 1 for M8 / single-channel */
        srcCPP: number; tgtCPP: number
        srcSubchannel?: number; tgtSubchannel?: number
    }



    const testConns: TestConn[] = edges.reduce<TestConn[]>((acc, e) => {
        if ((e.data as Record<string, unknown>)?.kind === 'io') {
            const d = e.data as Record<string, unknown>
            const srcMod = topology?.Topology?.find(m => String(m.Adress) === String(e.source))
            const tgtMod = topology?.Topology?.find(m => String(m.Adress) === String(e.target))
            acc.push({
                id: e.id,
                srcAddr: parseInt(e.source),
                srcCh: String(d.portSrc ?? portId(String(e.sourceHandle ?? ''))),
                tgtAddr: parseInt(e.target),
                tgtCh: String(d.portTgt ?? portId(String(e.targetHandle ?? ''))),
                label: typeof e.label === 'string' ? e.label : `#${e.source} → #${e.target}`,
                srcCPP: isM12(srcMod?.Name) ? 2 : 1,
                tgtCPP: isM12(tgtMod?.Name) ? 2 : 1,
                srcSubchannel: typeof d.subSrc === 'number' ? d.subSrc : undefined,
                tgtSubchannel: typeof d.subTgt === 'number' ? d.subTgt : undefined,
            })
        }
        return acc
    }, [])

    async function doReadInput(conn: TestConn) {
        if (!ip) return
        try {
            const url = new URL('/io/read-input', window.location.origin)
            url.searchParams.set('ip_address', ip)
            url.searchParams.set('module_addr', String(conn.tgtAddr))
            url.searchParams.set('channel', conn.tgtCh)
            url.searchParams.set('channels_per_port', String(conn.tgtCPP))
            if (conn.tgtSubchannel !== undefined) {
                url.searchParams.set('subchannel', String(conn.tgtSubchannel))
            }

            const r = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
            if (!r.ok) {
                const errMsg = await extractErrMsg(r)
                dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: errMsg } })
                return
            }
            const d = await r.json()
            const vals: boolean[] = Array.isArray(d.values) ? d.values.map(Boolean) : [Boolean(d.value)]
            dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { values: vals, value: vals.every(Boolean) } })
        } catch (e) {
            dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: (e as Error).message } })
        }
    }

    async function toggleOutput(conn: TestConn) {
        const newVal = !(outputStates[conn.id] ?? false)
        dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: true })
        try {
            const r = await fetch('/io/set-output', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip_address: ip ?? '',
                    module_addr: conn.srcAddr,
                    channel: conn.srcCh,
                    value: newVal,
                    channels_per_port: conn.srcCPP,
                    subchannel: conn.srcSubchannel
                }),
                signal: AbortSignal.timeout(8000),
            })
            if (!r.ok) {
                const errMsg = await extractErrMsg(r)
                dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: errMsg } })
                dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
                return
            }
            dispatch({ type: 'SET_OUTPUT_STATE', edgeId: conn.id, value: newVal })
            if (newVal) {
                await doReadInput(conn)
            } else {
                const nextResults = { ...testResults }
                delete nextResults[conn.id]
                dispatch({ type: 'SET_TEST_RESULTS', results: nextResults })
            }
            dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
        } catch (e) {
            dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: (e as Error).message } })
            dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
        }
    }

    async function testAll() {
        dispatch({ type: 'SET_TEST_ALL_BUSY', busy: true })
        try {
            for (const conn of testConns) {
                dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: true })
                try {
                    // Pulse HIGH
                    const rOn = await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ip_address: ip ?? '',
                            module_addr: conn.srcAddr,
                            channel: conn.srcCh,
                            value: true,
                            channels_per_port: conn.srcCPP,
                            subchannel: conn.srcSubchannel
                        }),
                        signal: AbortSignal.timeout(8000),
                    })
                    dispatch({ type: 'SET_OUTPUT_STATE', edgeId: conn.id, value: true })
                    if (rOn.ok) {
                        await new Promise(res => setTimeout(res, 300))
                        await doReadInput(conn)
                    } else {
                        const errMsg = await extractErrMsg(rOn)
                        dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: errMsg } })
                    }
                    // Set LOW
                    await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ip_address: ip ?? '',
                            module_addr: conn.srcAddr,
                            channel: conn.srcCh,
                            value: false,
                            channels_per_port: conn.srcCPP,
                            subchannel: conn.srcSubchannel
                        }),
                        signal: AbortSignal.timeout(8000),
                    }).catch(() => { /* best-effort LOW */ })
                    dispatch({ type: 'SET_OUTPUT_STATE', edgeId: conn.id, value: false })
                    dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
                } catch {
                    dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
                }
            }
            dispatch({ type: 'SET_TEST_ALL_BUSY', busy: false })
        } catch {
            dispatch({ type: 'SET_TEST_ALL_BUSY', busy: false })
        }
    }

    async function clearAllOutputs() {
        for (const conn of testConns) {
            if (outputStates[conn.id]) {
                try {
                    await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ip_address: ip ?? '',
                            module_addr: conn.srcAddr,
                            channel: conn.srcCh,
                            value: false,
                            channels_per_port: conn.srcCPP,
                            subchannel: conn.srcSubchannel
                        }),
                    })
                } catch { /* best-effort */ }
            }
        }
        dispatch({ type: 'SET_OUTPUT_STATES', states: {} })
        dispatch({ type: 'SET_TEST_RESULTS', results: {} })
    }

    // ── Visible edges ─────────────────────────────────────
    const visibleEdges = edges.filter(e => {
        const isCable = (e.data as Record<string, unknown>)?.kind === 'cable'
        if (isCable) return showCables
        return showWires
    })

    // Compute ioCount directly from edges state (not from the ref) so the
    // displayed count is always in sync with what's actually rendered.
    const ioCount = edges.filter(e => (e.data as Record<string, unknown>)?.kind === 'io').length

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
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <ConnectionsToolbar
                ioCount={ioCount}
                showCables={showCables}
                onToggleCables={() => dispatch({ type: 'TOGGLE_CABLES' })}
                showWires={showWires}
                onToggleWires={() => dispatch({ type: 'TOGGLE_WIRES' })}
                connectionMode={connectionMode}
                onConnectionModeChange={(mode) => dispatch({ type: 'SET_CONNECTION_MODE', mode })}
                showPsConfig={showPsConfig}
                onTogglePsConfig={() => dispatch({ type: 'TOGGLE_PS_CONFIG' })}
                onSave={doSave}
                onLoad={doLoad}
                onClear={doClear}
                showTestPanel={showTestPanel}
                onToggleTestPanel={() => dispatch({ type: 'TOGGLE_TEST_PANEL' })}
                psComPort={psComPort}
                onPsComPortChange={port => dispatch({ type: 'SET_PS_COMPORT', port })}
                psIpAddr={psIpAddr}
                onPsIpAddrChange={ip => dispatch({ type: 'SET_PS_IPADDR', ip })}
                psPlChannel={psPlChannel}
                onPsPlChannelChange={ch => dispatch({ type: 'SET_PS_PL_CHANNEL', ch })}
                psPsChannel={psPsChannel}
                onPsPsChannelChange={ch => dispatch({ type: 'SET_PS_PS_CHANNEL', ch })}
            />

            {/* ── Content area: ReactFlow + Wire Test Panel ────────── */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>

                {/* ── ReactFlow Canvas ─────────────────────────────────── */}
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <TopologyCanvas
                        nodes={nodes}
                        edges={visibleEdges}
                        nodeTypes={NODE_TYPES}
                        edgeTypes={EDGE_TYPES}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onReconnect={onReconnect}
                        isValidConnection={isValidConnection}
                        onNodeContextMenu={onNodeContextMenu}
                        editMode
                        fitView
                    />
                </Box>

                {/* ── Wire Test Panel ────────────────────────────────────── */}
                {showTestPanel && (
                    <WiringTestPanel
                        ip={ip}
                        testAllBusy={testAllBusy}
                        testConns={testConns}
                        outputStates={outputStates}
                        testBusy={testBusy}
                        testResults={testResults}
                        onTestAll={testAll}
                        onClearAllOutputs={clearAllOutputs}
                        onToggleOutput={toggleOutput}
                        onReadInput={doReadInput}
                    />
                )}
            </Box>

            {/* ── Module Actuate Modal (right-click context) ──────── */}
            <ModuleActuateModal
                open={actuateModule !== null}
                module={actuateModule}
                ip={ip ?? ''}
                mountedValves={actuateMountedValves}
                onClose={() => dispatch({ type: 'CLOSE_ACTUATE' })}
            />

            {/* ── Channel Selection Modal ──────── */}
            <ChannelSelectionModal
                open={pendingConn !== null}
                sourceIsM12={pendingConn?.srcIsM12 ?? false}
                targetIsM12={pendingConn?.tgtIsM12 ?? false}
                onConfirm={(srcSub, tgtSub) => {
                    if (pendingConn) {
                        const { srcNode, tgtNode, sh, th, srcIsM12, tgtIsM12 } = pendingConn

                        if (srcSub === 'both' || tgtSub === 'both') {
                            const srcChannels = (srcSub === 'both' && srcIsM12) ? [0, 1] : [srcSub === 'both' ? 0 : srcSub]
                            const tgtChannels = (tgtSub === 'both' && tgtIsM12) ? [0, 1] : [tgtSub === 'both' ? 0 : tgtSub]

                            const maxLen = Math.max(srcChannels.length, tgtChannels.length)
                            for (let i = 0; i < maxLen; i++) {
                                const s = srcChannels[i % srcChannels.length]
                                const t = tgtChannels[i % tgtChannels.length]
                                processConnection(srcNode, tgtNode, sh, th, s as number, t as number)
                            }
                        } else {
                            processConnection(srcNode, tgtNode, sh, th, srcSub as number, tgtSub as number)
                        }
                        
                        setPendingConn(null)
                    }
                }}
                onCancel={() => setPendingConn(null)}
            />
        </Box>
    )
}
