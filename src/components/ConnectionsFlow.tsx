/**
 * ConnectionsFlow – full-page I/O wiring editor.
 *
 * Shows the topology with port handles visible on each module.
 * Drag from a port to another to create a wired I/O connection.
 * Save/load connections (including valve-mount info) via /connections.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
    Box, TextField, Typography, Divider, Alert,
    Stack, Chip, CircularProgress,
} from '@mui/material'
import CableIcon from '@mui/icons-material/Cable'
import TimelineIcon from '@mui/icons-material/Timeline'
import PowerIcon from '@mui/icons-material/Power'
import SaveIcon from '@mui/icons-material/Save'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent'
import BoltIcon from '@mui/icons-material/Bolt'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Tooltip } from '@mui/material'
import { TooltipButton, TooltipIconButton } from './TooltipButton'
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
import ModuleActuateModal from './ModuleActuateModal'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus, ConnectionEntry, BenchConfig, WiringConnection, TopologyModule } from '../types'

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
    /** IP address of the CPX-AP gateway (from App toolbar) */
    ip?: string
    /** Called when a valve body's mounted valves change (indices 0-based) */
    onModuleValveChange?: (addr: number, mountedValves: number[]) => void
    /** Called when a BenchConfig is loaded — allows parent to sync topology state */
    onConfigLoad?: (config: BenchConfig) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ConnectionsFlow({ topology, diffStatus, ip, onModuleValveChange, onConfigLoad }: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])  // ModuleNode | BackplaneNode
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
    const [showCables, setShowCables] = useState(false)  // hidden by default for cleaner IO editing
    const [savePath, setSavePath] = useState('bench_config.json')
    const [loadPath, setLoadPath] = useState('bench_config.json')
    const [statusMsg, setStatusMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null)
    const [wiringDisplay, setWiringDisplay] = useState<'all' | 'selected' | 'none'>('all')
    const [straightWires, setStraightWires] = useState(false)

    // ── Power Supply configuration state ───────────────────
    const [showPsConfig, setShowPsConfig] = useState(false)
    const [psComPort, setPsComPort] = useState<string>('')
    const [psIpAddr, setPsIpAddr] = useState<string>('')
    const [psPlChannel, setPsPlChannel] = useState<string>('')
    const [psPsChannel, setPsPsChannel] = useState<string>('')

    // ── Wire Test state ────────────────────────────────────
    const [showTestPanel, setShowTestPanel] = useState(false)
    /** edgeId → true when output is currently held HIGH */
    const [outputStates, setOutputStates] = useState<Record<string, boolean>>({})
    /** edgeId → last input reading */
    const [testResults, setTestResults] = useState<Record<string, { values?: boolean[]; value: boolean | null; error?: string }>>({})
    /** edge IDs currently awaiting a device call */
    const [testBusy, setTestBusy] = useState<Set<string>>(new Set())
    const [testAllBusy, setTestAllBusy] = useState(false)

    // ── Module Actuate Modal state ─────────────────────────
    const [actuateModule, setActuateModule] = useState<TopologyModule | null>(null)
    const [actuateMountedValves, setActuateMountedValves] = useState<number[] | undefined>(undefined)

    const ioEdgesRef = useRef<Edge[]>([])
    /** IO edges stashed by doLoad so the topology rebuild effect restores them
     *  rather than wiping them when onConfigLoad triggers a topology change. */
    const pendingIoRef = useRef<Edge[]>([])
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

        // ── Preserve existing node data (hiddenValves, etc.) across rebuilds ──
        const prevNodeMap = new Map(nodes.map(n => [n.id, n]))

        // Inject valve-change callback into valve body nodes
        const enriched = (newNodes as Node[]).map(n => {
            if (n.type !== 'mod') return n
            const d = n.data as ModuleNodeData
            // Preserve hiddenValves from previous render so valve checkboxes persist
            const prev = prevNodeMap.get(n.id)
            const prevHidden = prev ? (prev.data as ModuleNodeData).hiddenValves : undefined
            if (!d.showValveEditor && prevHidden === undefined) return n
            return {
                ...n,
                data: {
                    ...d,
                    hiddenValves: prevHidden ?? d.hiddenValves ?? [],
                    onValveChange: d.showValveEditor ? onModuleValveChange : d.onValveChange,
                },
            }
        })
        setNodes(enriched)
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

    // ── Right-click module → open actuate modal ──────────
    const onNodeContextMenu = useCallback((_event: React.MouseEvent, node: Node) => {
        _event.preventDefault()
        if (node.type !== 'mod') return
        const d = node.data as ModuleNodeData
        setActuateModule(d.mod)
        // Collect mounted valves for valve bodies
        if (d.mod.MountedValves && d.mod.MountedValves.length >= 0) {
            setActuateMountedValves(d.mod.MountedValves)
        } else {
            setActuateMountedValves(undefined)
        }
    }, [])

    // ── New connection ────────────────────────────────────
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

        const pSrc = portId(sh)
        const pTgt = portId(th)
        // Block same-port self-loop (same module AND same port ID) but allow
        // cross-port connections on the same module (DIDO / DIO loopback).
        if (srcNode === tgtNode && pSrc === pTgt) return
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
            label: `#${srcNode}:${pSrc} \u2192 #${tgtNode}:${pTgt}`,
            data: { kind: 'io', portSrc: pSrc, portTgt: pTgt, wireColor, straight: straightWires },
        }
        // Only deduplicate by edge ID — allow fan-out (one output → many inputs)
        // and fan-in (many outputs → one input). Exact duplicate = same ID.
        setEdges(prev => prev.some(e => e.id === edgeId) ? prev : [...prev, newEdge])
    }, [setEdges, straightWires])

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
        // Block same-port self-loop; allow cross-port same-module connections (DIDO / DIO loopback).
        if (srcNode === tgtNode && portId(nsh) === portId(nth)) return false
        const edgeId = `io-${srcNode}-${portId(nsh)}-${tgtNode}-${portId(nth)}`
        return !ioEdgesRef.current.some(e => e.id === edgeId)
    }, [])

    // ── Save ──────────────────────────────────────────────
    // ── Save ──────────────────────────────────────────────
    async function doSave() {
        try {
            // 1. Fetch current config
            const getRes = await fetch(`/config?file_path=${encodeURIComponent(savePath)}`)
            if (!getRes.ok) throw new Error('Could not read existing configuration to update. Make sure you generate/save a configuration first.')
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
                }
            })

            // 3. Update mounted valves in module_instances
            const mountedValvesMap: Record<string, number[]> = {}
            nodes.forEach(n => {
                if (n.type !== 'mod') return
                const d = n.data as ModuleNodeData
                if (d.mod.MountedValves && d.mod.MountedValves.length >= 0) {
                    mountedValvesMap[String(d.mod.Adress)] = d.mod.MountedValves
                }
            })

            config.wiring = wiring
            config.module_instances = (config.module_instances || []).map(inst => {
                const mv = mountedValvesMap[String(inst.address)]
                if (mv !== undefined) {
                    return { ...inst, mounted_valves: mv }
                }
                return inst
            })

            config.power_supply = {
                ComPort: psComPort.trim() || null,
                'Ip addr': psIpAddr.trim() || null,
                pl_channel: psPlChannel.trim() ? parseInt(psPlChannel) : null,
                ps_channel: psPsChannel.trim() ? parseInt(psPsChannel) : null,
            }

            // 4. Save entire BenchConfig
            const saveRes = await fetch('/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config,
                    save_path: savePath,
                }),
            })
            const d = await saveRes.json()
            setStatusMsg(saveRes.ok
                ? { text: `Saved \u2192 ${d.saved_to}`, severity: 'success' }
                : { text: `Error: ${d.detail}`, severity: 'error' })
        } catch (e) {
            setStatusMsg({ text: `Error: ${(e as Error).message}`, severity: 'error' })
        }
    }

    // ── Load ──────────────────────────────────────────────
    async function doLoad() {
        try {
            const r = await fetch(`/config?file_path=${encodeURIComponent(loadPath)}`)
            const d: BenchConfig = await r.json()
            if (!r.ok) { setStatusMsg({ text: `Error: ${(d as any).detail ?? 'Unknown error'}`, severity: 'error' }); return }

            if (d.power_supply) {
                setPsComPort(d.power_supply.ComPort || '')
                setPsIpAddr(d.power_supply['Ip addr'] || '')
                setPsPlChannel(d.power_supply.pl_channel != null ? String(d.power_supply.pl_channel) : '')
                setPsPsChannel(d.power_supply.ps_channel != null ? String(d.power_supply.ps_channel) : '')
            } else {
                setPsComPort('')
                setPsIpAddr('')
                setPsPlChannel('')
                setPsPsChannel('')
            }

            // Build an address → category map so we can derive correct handle kind
            const catByAddr: Record<number, string> = {}
                ; (d.module_instances ?? []).forEach(inst => {
                    catByAddr[inst.address] = inst.category
                })

            // Derive the ReactFlow handle kind from the module category:
            //   output/inout module on the source side → 'out'
            //   input/inout module on the target side → 'in'
            //   otherwise → 'inout'
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
                        waypoints: c.waypoints ?? undefined,
                        straight: c.straight ?? false,
                    },
                }
            })

            // Stash IO edges BEFORE calling onConfigLoad so the topology rebuild
            // effect (triggered by onConfigLoad changing topology) picks them up
            // from pendingIoRef instead of the not-yet-updated ioEdgesRef.
            pendingIoRef.current = newIo

            // Let the parent sync topology / rawConfig from the loaded file
            onConfigLoad?.(d)

            // Also set edges directly – covers cases where topology doesn't change
            // (same config already loaded) so the topology rebuild effect won't fire.
            setEdges(prev => [
                ...prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io'),
                ...newIo,
            ])

            // Restore mounted valve config for each valve body
            if (d.module_instances) {
                d.module_instances.forEach(inst => {
                    if (inst.mounted_valves && inst.mounted_valves.length >= 0) {
                        onModuleValveChange?.(inst.address, inst.mounted_valves)
                    }
                })
            }

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

    // ── Wire Test: connections derived from current IO edges ──────
    interface TestConn {
        id: string; srcAddr: number; srcCh: string
        tgtAddr: number; tgtCh: string; label: string
        /** Channels per port: 2 for M12-5P connectors, 1 for M8 / single-channel */
        srcCPP: number; tgtCPP: number
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
    const testConns: TestConn[] = edges
        .filter(e => (e.data as Record<string, unknown>)?.kind === 'io')
        .map(e => {
            const d = e.data as Record<string, unknown>
            const srcMod = topology?.Topology?.find(m => String(m.Adress) === String(e.source))
            const tgtMod = topology?.Topology?.find(m => String(m.Adress) === String(e.target))
            return {
                id: e.id,
                srcAddr: parseInt(e.source),
                srcCh: String(d.portSrc ?? portId(String(e.sourceHandle ?? ''))),
                tgtAddr: parseInt(e.target),
                tgtCh: String(d.portTgt ?? portId(String(e.targetHandle ?? ''))),
                label: typeof e.label === 'string' ? e.label : `#${e.source} → #${e.target}`,
                srcCPP: isM12(srcMod?.Name) ? 2 : 1,
                tgtCPP: isM12(tgtMod?.Name) ? 2 : 1,
            }
        })

    async function doReadInput(conn: TestConn) {
        if (!ip) return
        try {
            const r = await fetch(
                `/io/read-input?ip_address=${encodeURIComponent(ip)}&module_addr=${conn.tgtAddr}&channel=${encodeURIComponent(conn.tgtCh)}&channels_per_port=${conn.tgtCPP}`,
                { signal: AbortSignal.timeout(8000) },
            )
            if (!r.ok) {
                const errMsg = await extractErrMsg(r)
                setTestResults(prev => ({ ...prev, [conn.id]: { value: null, error: errMsg } }))
                return
            }
            const d = await r.json()
            const vals: boolean[] = Array.isArray(d.values) ? d.values.map(Boolean) : [Boolean(d.value)]
            setTestResults(prev => ({ ...prev, [conn.id]: { values: vals, value: vals.every(Boolean) } }))
        } catch (e) {
            setTestResults(prev => ({ ...prev, [conn.id]: { value: null, error: (e as Error).message } }))
        }
    }

    async function toggleOutput(conn: TestConn) {
        const newVal = !(outputStates[conn.id] ?? false)
        setTestBusy(prev => new Set(prev).add(conn.id))
        try {
            const r = await fetch('/io/set-output', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip_address: ip ?? '', module_addr: conn.srcAddr, channel: conn.srcCh, value: newVal, channels_per_port: conn.srcCPP }),
                signal: AbortSignal.timeout(8000),
            })
            if (!r.ok) {
                const errMsg = await extractErrMsg(r)
                setTestResults(prev => ({ ...prev, [conn.id]: { value: null, error: errMsg } }))
                return
            }
            setOutputStates(prev => ({ ...prev, [conn.id]: newVal }))
            if (newVal) {
                await doReadInput(conn)
            } else {
                setTestResults(prev => { const n = { ...prev }; delete n[conn.id]; return n })
            }
        } catch (e) {
            setTestResults(prev => ({ ...prev, [conn.id]: { value: null, error: (e as Error).message } }))
        } finally {
            setTestBusy(prev => { const n = new Set(prev); n.delete(conn.id); return n })
        }
    }

    async function testAll() {
        setTestAllBusy(true)
        try {
            for (const conn of testConns) {
                setTestBusy(prev => new Set(prev).add(conn.id))
                try {
                    // Pulse HIGH
                    const rOn = await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ip_address: ip ?? '', module_addr: conn.srcAddr, channel: conn.srcCh, value: true, channels_per_port: conn.srcCPP }),
                        signal: AbortSignal.timeout(8000),
                    })
                    setOutputStates(prev => ({ ...prev, [conn.id]: true }))
                    if (rOn.ok) {
                        await new Promise(res => setTimeout(res, 300))
                        await doReadInput(conn)
                    } else {
                        const errMsg = await extractErrMsg(rOn)
                        setTestResults(prev => ({ ...prev, [conn.id]: { value: null, error: errMsg } }))
                    }
                    // Set LOW
                    await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ip_address: ip ?? '', module_addr: conn.srcAddr, channel: conn.srcCh, value: false, channels_per_port: conn.srcCPP }),
                        signal: AbortSignal.timeout(8000),
                    }).catch(() => { /* best-effort LOW */ })
                    setOutputStates(prev => ({ ...prev, [conn.id]: false }))
                } finally {
                    setTestBusy(prev => { const n = new Set(prev); n.delete(conn.id); return n })
                }
            }
        } finally {
            setTestAllBusy(false)
        }
    }

    async function clearAllOutputs() {
        for (const conn of testConns) {
            if (outputStates[conn.id]) {
                try {
                    await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ip_address: ip ?? '', module_addr: conn.srcAddr, channel: conn.srcCh, value: false, channels_per_port: conn.srcCPP }),
                    })
                } catch { /* best-effort */ }
            }
        }
        setOutputStates({})
        setTestResults({})
    }

    // ── Visible edges ─────────────────────────────────────
    const visibleEdges = edges.filter(e => {
        const isCable = (e.data as Record<string, unknown>)?.kind === 'cable'
        if (isCable) return showCables
        if (wiringDisplay === 'none') return false
        if (wiringDisplay === 'selected') {
            const srcNode = nodes.find(n => n.id === e.source)
            const tgtNode = nodes.find(n => n.id === e.target)
            return e.selected || srcNode?.selected || tgtNode?.selected
        }
        return true
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

            {/* ── Top Controls Bar ─────────────────────────────────── */}
            <Box sx={{
                background: '#fff',
                borderBottom: '1px solid #e0e0e0',
                px: 2, py: 0.75,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                flexShrink: 0,
            }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#e65100', whiteSpace: 'nowrap' }}>
                    <SettingsInputComponentIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> I/O Connection Editor
                </Typography>

                {ioCount > 0 && (
                    <Chip
                        label={`${ioCount} wire${ioCount !== 1 ? 's' : ''}`}
                        size="small" color="warning"
                        sx={{ height: 22, fontSize: '0.72rem' }}
                    />
                )}

                <Divider orientation="vertical" flexItem />

                {/* Cable visibility toggle */}
                <TooltipButton
                    size="small"
                    variant={showCables ? 'contained' : 'outlined'}
                    color="inherit"
                    onClick={() => setShowCables(s => !s)}
                    tooltip={showCables ? 'Hide backplane connections and AP cables' : 'Show backplane connections and AP cables'}
                    icon={<CableIcon />}
                    sx={{
                        fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap',
                        color: showCables ? '#fff' : '#546e7a',
                        background: showCables ? '#546e7a' : 'transparent',
                        borderColor: '#546e7a',
                        '&:hover': { borderColor: '#455a64', background: showCables ? '#455a64' : 'rgba(84,110,122,0.08)' },
                    }}
                >
                    {showCables ? 'Hide AP Cables' : 'Show AP Cables'}
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Wiring display mode selection */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                        Wiring View:
                    </Typography>
                    <TooltipButton
                        size="small"
                        variant={wiringDisplay === 'all' ? 'contained' : 'outlined'}
                        onClick={() => setWiringDisplay('all')}
                        tooltip="Show all I/O wiring lines"
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 1, minWidth: 40 }}
                    >
                        All
                    </TooltipButton>
                    <TooltipButton
                        size="small"
                        variant={wiringDisplay === 'selected' ? 'contained' : 'outlined'}
                        color="warning"
                        onClick={() => setWiringDisplay('selected')}
                        tooltip="Only show wiring connected to the currently selected module"
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 1, minWidth: 80 }}
                    >
                        Selected Only
                    </TooltipButton>
                    <TooltipButton
                        size="small"
                        variant={wiringDisplay === 'none' ? 'contained' : 'outlined'}
                        onClick={() => setWiringDisplay('none')}
                        tooltip="Hide all I/O wiring lines"
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 1, minWidth: 50 }}
                    >
                        Hidden
                    </TooltipButton>
                </Stack>

                <Divider orientation="vertical" flexItem />

                {/* Wire routing style */}
                <TooltipButton
                    size="small"
                    variant={straightWires ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={() => setStraightWires(s => !s)}
                    tooltip={straightWires ? 'Use smart right-angle routing' : 'Use point-to-point straight line routing'}
                    icon={<TimelineIcon />}
                    sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                >
                    {straightWires ? 'Straight Wires' : 'Smart Stepped Wires'}
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Power Supply toggle */}
                <TooltipButton
                    size="small"
                    variant={showPsConfig ? 'contained' : 'outlined'}
                    onClick={() => setShowPsConfig(s => !s)}
                    tooltip={showPsConfig ? 'Hide power supply configuration panel' : 'Show power supply configuration panel'}
                    icon={<PowerIcon />}
                    sx={{
                        fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap',
                        color: showPsConfig ? '#fff' : '#673ab7',
                        background: showPsConfig ? '#673ab7' : 'transparent',
                        borderColor: '#673ab7',
                        '&:hover': { borderColor: '#5e35b1', background: showPsConfig ? '#5e35b1' : 'rgba(103,58,183,0.08)' },
                    }}
                >
                    Power Supply
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Save */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                        Save:
                    </Typography>
                    <TextField
                        size="small" value={savePath}
                        onChange={e => setSavePath(e.target.value)}
                        placeholder="connections.jsonc"
                        sx={{ width: 180 }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.72rem', padding: '4px 8px' } } }}
                    />
                    <TooltipButton
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={doSave}
                        tooltip="Save wiring and configuration to the JSON file"
                        icon={<SaveIcon />}
                        sx={{ fontSize: '0.72rem', py: 0.4, minWidth: 56, whiteSpace: 'nowrap' }}
                    >
                        Save
                    </TooltipButton>
                </Stack>

                {/* Load */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                        Load:
                    </Typography>
                    <TextField
                        size="small" value={loadPath}
                        onChange={e => setLoadPath(e.target.value)}
                        placeholder="connections.jsonc"
                        sx={{ width: 180 }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.72rem', padding: '4px 8px' } } }}
                    />
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={doLoad}
                        tooltip="Load wiring and configuration from the JSON file"
                        icon={<FolderOpenIcon />}
                        sx={{ fontSize: '0.72rem', py: 0.4, minWidth: 56, whiteSpace: 'nowrap' }}
                    >
                        Load
                    </TooltipButton>
                </Stack>

                {/* Clear */}
                {ioCount > 0 && (
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={doClear}
                        tooltip="Delete all drawn I/O wires"
                        icon={<DeleteIcon />}
                        sx={{ fontSize: '0.72rem', py: 0.4, whiteSpace: 'nowrap' }}
                    >
                        Clear
                    </TooltipButton>
                )}

                {/* Test Wiring toggle */}
                {ioCount > 0 && (
                    <>
                        <Divider orientation="vertical" flexItem />
                        <TooltipButton
                            size="small"
                            variant={showTestPanel ? 'contained' : 'outlined'}
                            color={showTestPanel ? 'warning' : 'inherit'}
                            onClick={() => setShowTestPanel(p => !p)}
                            tooltip={showTestPanel ? 'Hide interactive wire test panel' : 'Open interactive wire test panel'}
                            icon={<PlayArrowIcon />}
                            sx={{
                                fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap',
                                ...(showTestPanel ? {} : { color: '#546e7a', borderColor: '#546e7a' }),
                            }}
                        >
                            Test Wiring
                        </TooltipButton>
                    </>
                )}

                {/* Status message */}
                {statusMsg && (
                    <Alert
                        severity={statusMsg.severity}
                        onClose={() => setStatusMsg(null)}
                        sx={{ py: 0, fontSize: '0.72rem', '& .MuiAlert-message': { wordBreak: 'break-all' } }}
                    >
                        {statusMsg.text}
                    </Alert>
                )}
            </Box>

            {showPsConfig && (
                <Box sx={{
                    background: '#f9f9f9',
                    borderBottom: '1px solid #e0e0e0',
                    px: 3, py: 1.5,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#333' }}>
                        <PowerIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> Power Supply Configuration:
                    </Typography>
                    <TextField
                        label="COM Port"
                        size="small"
                        value={psComPort}
                        onChange={e => setPsComPort(e.target.value)}
                        placeholder="e.g. COM3"
                        sx={{ width: 120, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <TextField
                        label="IP Address"
                        size="small"
                        value={psIpAddr}
                        onChange={e => setPsIpAddr(e.target.value)}
                        placeholder="e.g. 192.168.0.20"
                        sx={{ width: 150, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <TextField
                        label="PL Channel"
                        size="small"
                        type="number"
                        value={psPlChannel}
                        onChange={e => setPsPlChannel(e.target.value)}
                        placeholder="1"
                        sx={{ width: 100, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <TextField
                        label="PS Channel"
                        size="small"
                        type="number"
                        value={psPsChannel}
                        onChange={e => setPsPsChannel(e.target.value)}
                        placeholder="2"
                        sx={{ width: 100, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        (Only ComPort or IP addr should be populated to connect)
                    </Typography>
                </Box>
            )}

            {/* ── Legend Bar ───────────────────────────────────────── */}
            <Box sx={{
                background: '#f8f9fa',
                borderBottom: '1px solid #e0e0e0',
                px: 2, py: 0.5,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2.5,
                flexWrap: 'wrap',
                flexShrink: 0,
            }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                    Ports:
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#1565c0', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Input (blue)
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#2e7d32', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Output (green)
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#ff9800', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Bidirectional (orange)
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>
                    Drag port to connect · Drag wire endpoint to reconnect
                </Typography>
            </Box>

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
                {/* End ReactFlow Canvas Box */}

                {/* ── Wire Test Panel ────────────────────────────────────── */}
                {showTestPanel && (
                    <Box sx={{
                        width: 360, flexShrink: 0,
                        borderLeft: '1px solid #e0e0e0',
                        display: 'flex', flexDirection: 'column',
                        background: '#fafafa', overflow: 'hidden',
                    }}>
                        {/* Panel header */}
                        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #e0e0e0', background: '#fff', flexShrink: 0 }}>
                            <Stack direction="row" spacing={1} sx={{ mb: 0.75, alignItems: 'center' }}>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', flex: 1 }}>
                                    Wire Test
                                </Typography>
                                {ip
                                    ? <Chip label={ip} size="small" color="info" sx={{ fontSize: '0.62rem', maxWidth: 140, overflow: 'hidden' }} />
                                    : <Chip label="No IP set" size="small" color="warning" sx={{ fontSize: '0.65rem' }} />
                                }
                                {testAllBusy && <CircularProgress size={16} />}
                            </Stack>
                            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.75, lineHeight: 1.3 }}>
                                Toggle output ON to light the physical indicator.<br />
                                Input is read automatically. Output stays on until toggled off.
                            </Typography>
                            <Stack direction="row" spacing={0.5}>
                                <TooltipButton
                                    size="small" variant="contained" color="warning"
                                    onClick={testAll}
                                    disabled={testAllBusy || !ip || testConns.length === 0}
                                    tooltip="Pulse each output HIGH, read input, and set LOW sequentially"
                                    icon={<PlayArrowIcon />}
                                    sx={{ fontSize: '0.7rem', py: 0.3 }}
                                >
                                    Test All (pulse)
                                </TooltipButton>
                                <TooltipButton
                                    size="small" variant="outlined" color="error"
                                    onClick={clearAllOutputs}
                                    disabled={!Object.values(outputStates).some(v => v)}
                                    tooltip="Turn off all outputs immediately"
                                    icon={<BoltIcon />}
                                    sx={{ fontSize: '0.7rem', py: 0.3 }}
                                >
                                    All OFF
                                </TooltipButton>
                            </Stack>
                        </Box>

                        {/* Connection list */}
                        <Box sx={{ flex: 1, overflowY: 'auto' }}>
                            {testConns.length === 0 && (
                                <Typography variant="caption" color="text.secondary"
                                    sx={{ p: 2, textAlign: 'center', display: 'block' }}>
                                    No I/O wires drawn yet.
                                </Typography>
                            )}
                            {testConns.map(conn => {
                                const isOn = outputStates[conn.id] ?? false
                                const isBusy = testBusy.has(conn.id)
                                const result = testResults[conn.id]
                                return (
                                    <Box key={conn.id} sx={{
                                        px: 1.5, py: 0.75,
                                        borderBottom: '1px solid #f0f0f0',
                                        background: isOn ? '#fff8e1' : '#fff',
                                        transition: 'background 0.2s',
                                    }}>
                                        {/* Connection label */}
                                        <Typography sx={{
                                            fontSize: '0.7rem', fontFamily: 'monospace',
                                            color: '#333', mb: 0.5, wordBreak: 'break-all',
                                        }}>
                                            {conn.label}
                                        </Typography>
                                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                            {/* Output toggle */}
                                            <TooltipButton
                                                size="small"
                                                variant={isOn ? 'contained' : 'outlined'}
                                                color={isOn ? 'error' : 'inherit'}
                                                onClick={() => toggleOutput(conn)}
                                                disabled={isBusy || testAllBusy || !ip}
                                                tooltip={isOn ? 'Turn output OFF' : 'Turn output ON'}
                                                sx={{
                                                    fontSize: '0.68rem', py: 0.2, px: 0.75,
                                                    minWidth: 64, fontWeight: isOn ? 700 : 400,
                                                    color: isOn ? undefined : '#546e7a',
                                                    borderColor: isOn ? undefined : '#546e7a',
                                                }}
                                            >
                                                {isBusy
                                                    ? <CircularProgress size={12} color="inherit" />
                                                    : isOn ? 'ON' : 'OFF'}
                                            </TooltipButton>

                                            {/* Input reading result: per-channel chips for M12, single chip otherwise */}
                                            {result && !result.error && result.values && result.values.length > 1
                                                ? result.values.map((v, i) => (
                                                    <Tooltip key={i} title={`#${conn.tgtAddr}:${conn.tgtCh} channel ${i}`}>
                                                        <Chip
                                                            size="small"
                                                            label={v ? `CH${i} HIGH` : `CH${i} LOW`}
                                                            color={v ? 'success' : 'error'}
                                                            sx={{ fontSize: '0.65rem', height: 20, cursor: 'default' }}
                                                        />
                                                    </Tooltip>
                                                ))
                                                : result && (
                                                    <Tooltip title={result.error ?? `#${conn.tgtAddr}:${conn.tgtCh}`}>
                                                        <Chip
                                                            size="small"
                                                            label={result.error ? 'ERR' : result.value ? 'HIGH' : 'LOW'}
                                                            color={(result.error ? 'default' : result.value ? 'success' : 'error') as 'default' | 'success' | 'error'}
                                                            sx={{ fontSize: '0.65rem', height: 20, cursor: 'default' }}
                                                        />
                                                    </Tooltip>
                                                )
                                            }

                                            {/* Re-read button when output is live */}
                                            {isOn && !isBusy && (
                                                <TooltipIconButton
                                                    size="small"
                                                    onClick={() => doReadInput(conn)}
                                                    tooltip={`Read #${conn.tgtAddr}:${conn.tgtCh}`}
                                                    icon={<RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                                                    sx={{ py: 0, px: 0.5 }}
                                                />
                                            )}

                                            <Typography variant="caption"
                                                sx={{ color: '#bbb', fontSize: '0.6rem', ml: 'auto', whiteSpace: 'nowrap' }}>
                                                #{conn.srcAddr}:{conn.srcCh}→#{conn.tgtAddr}:{conn.tgtCh}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                )
                            })}
                        </Box>
                    </Box>
                )}

            </Box>
            {/* End content area */}

            {/* ── Module Actuate Modal (right-click context) ──────── */}
            <ModuleActuateModal
                open={actuateModule !== null}
                module={actuateModule}
                ip={ip ?? ''}
                mountedValves={actuateMountedValves}
                onClose={() => setActuateModule(null)}
            />
        </Box>
    )
}
