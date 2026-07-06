import { useState, useEffect, useCallback, useRef } from 'react'
import { useNodesState, useEdgesState, reconnectEdge } from '@xyflow/react'
import type { Node, Edge, Connection, EdgeChange } from '@xyflow/react'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { buildLayout } from '../utils/layoutBuilder'
import type { Topology, DiffStatus, BenchConfig, WiringConnection, ConnectionEntry } from '../types'
import type { ModuleNodeData } from './moduleNodeTypes'
import type { ConnectionsFlowAction } from './useConnectionsFlowState'

const HIGH_CONTRAST_COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
]

function handleKind(handleId: string): 'in' | 'out' | 'inout' {
    const k = handleId.split('-')[1]
    if (k === 'in' || k === 'out' || k === 'inout') return k as any
    return 'inout'
}

function portId(handleId: string): string {
    const parts = handleId.split('-')
    const known = new Set(['in', 'out', 'inout'])
    return (known.has(parts[1]) ? parts.slice(2) : parts.slice(1)).join('-')
}

function getWireColor(handleId: string, portEdgeCount: number, theme: Theme): string {
    const outKind = handleKind(handleId)
    const baseColor = outKind === 'out' ? theme.palette.success.dark : outKind === 'in' ? theme.palette.primary.dark : theme.palette.warning.dark
    if (portEdgeCount === 0) return baseColor
    return HIGH_CONTRAST_COLORS[(portEdgeCount - 1) % HIGH_CONTRAST_COLORS.length]
}

const isM12 = (name?: string) => !!(name ?? '').includes('M12')

export function useConnectionsFlowLayout(
    topology: Topology | null,
    diffStatus: DiffStatus | null,
    ip: string | undefined,
    rawConfig: BenchConfig | null | undefined,
    onModuleValveChange: ((addr: number, mountedValves: number[], valveSlots?: number) => void) | undefined,
    connectionMode: 'port' | 'channel',
    dispatch: React.Dispatch<ConnectionsFlowAction>
) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
    const [edges, setEdges, _onEdgesChange] = useEdgesState<Edge>([])
    const theme = useTheme()

    const ioEdgesRef = useRef<Edge[]>([])
    const pendingIoRef = useRef<Edge[]>([])
    const topologyName = useRef('')

    useEffect(() => {
        ioEdgesRef.current = edges.filter(e => (e.data as Record<string, unknown>)?.kind === 'io')
    }, [edges])

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
                } catch (e) { }
            }
        })
    }, [topology, ip])

    useEffect(() => {
        if (!rawConfig) return
        const d = rawConfig

        if (d.power_supply) {
            const rawCom = d.power_supply.ComPort || d.power_supply.comport || ''
            const rawIp = d.power_supply['Ip addr'] || d.power_supply.ip_address || ''
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
        const portEdgeCounts: Record<string, number> = {}
        const newIo: Edge[] = loaded.map(c => {
            const srcAddrStr = c.source_instance_id.replace(/^mod-0*/, '')
            const tgtAddrStr = c.target_instance_id.replace(/^mod-0*/, '')
            const srcAddr = srcAddrStr === '' ? 0 : parseInt(srcAddrStr)
            const tgtAddr = tgtAddrStr === '' ? 0 : parseInt(tgtAddrStr)
            const resolvedSrcHandle = c.source_handle || `src-${srcKind(srcAddr)}-${c.source_channel}`
            const resolvedTgtHandle = c.target_handle || `tgt-${tgtKind(tgtAddr)}-${c.target_channel}`

            const portKey = `${srcAddr}-${tgtAddr}`
            const count = portEdgeCounts[portKey] || 0
            portEdgeCounts[portKey] = count + 1
            const wireColor = getWireColor(resolvedSrcHandle, count, theme)

            return {
                id: c.id,
                source: String(srcAddr),
                sourceHandle: resolvedSrcHandle,
                target: String(tgtAddr),
                targetHandle: resolvedTgtHandle,
                type: 'wire',
                animated: true,
                zIndex: 1000,
                style: { stroke: wireColor, strokeWidth: 1.25 },
                label: c.label ?? `#${srcAddr}:${c.source_channel} \u2192 #${tgtAddr}:${c.target_channel}`,
                data: {
                    kind: 'io',
                    portSrc: c.source_channel,
                    portTgt: c.target_channel,
                    subSrc: c.source_subchannel,
                    subTgt: c.target_subchannel,
                    waypoints: c.waypoints ?? undefined,
                    straight: c.straight ?? false,
                    labelOffset: c.label_offset ?? undefined,
                    wireColor,
                },
            }
        })

        pendingIoRef.current = newIo
        setEdges(prev => [
            ...prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io'),
            ...newIo,
        ])
    }, [rawConfig, setEdges, dispatch, theme])

    useEffect(() => {
        if (!topology?.Topology?.length) { setNodes([]); setEdges([]); return }
        topologyName.current = topology.Name

        const { nodes: newNodes, edges: chainEdges } = buildLayout(
            topology.Topology, null, true /* editMode */,
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

        const validIds = new Set(topology.Topology.map(m => String(m.Adress)))
        const sourceIo = pendingIoRef.current.length > 0 ? pendingIoRef.current : ioEdgesRef.current
        pendingIoRef.current = []
        const validIo = sourceIo.filter(
            e => validIds.has(e.source) && validIds.has(e.target),
        )
        setEdges([...chainEdges, ...validIo])
    }, [topology, diffStatus, onModuleValveChange, setNodes, setEdges, vabxInputs])

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
                        wireColor: (e.data as Record<string, unknown>)?.wireColor as string | undefined,
                    })
                }
                return acc
            }, [])
            return { ...n, data: { ...(n.data as ModuleNodeData), connections: conns } }
        }))
    }, [edges, setNodes])

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        _onEdgesChange(
            changes.filter(c =>
                c.type !== 'remove' ||
                ioEdgesRef.current.some(e => e.id === c.id),
            ),
        )
    }, [_onEdgesChange])

    const onNodeContextMenu = useCallback((_event: React.MouseEvent, node: Node) => {
        _event.preventDefault()
        if (node.type !== 'mod') return
        const d = node.data as ModuleNodeData
        const mounted = (d.mod.MountedValves && d.mod.MountedValves.length >= 0) ? d.mod.MountedValves : undefined
        dispatch({ type: 'OPEN_ACTUATE', module: d.mod, mountedValves: mounted })
    }, [dispatch])

    const processConnection = useCallback((
        srcNode: string, tgtNode: string, sh: string, th: string,
        subSrc?: number, subTgt?: number, direction?: 'forward' | 'reverse'
    ) => {
        const pSrc = portId(sh)
        const pTgt = portId(th)

        if (srcNode === tgtNode && pSrc === pTgt) return

        const edgeId = subSrc !== undefined && subTgt !== undefined
            ? `io-${srcNode}-${pSrc}.${subSrc}-${tgtNode}-${pTgt}.${subTgt}`
            : `io-${srcNode}-${pSrc}-${tgtNode}-${pTgt}`

        const existingEdges = edges.filter(e => e.source === srcNode && e.target === tgtNode && (e.data as any)?.kind === 'io')
        const wireColor = getWireColor(sh, existingEdges.length, theme)

        const sk = handleKind(sh)
        const tk = handleKind(th)
        let srcIsOutput = false
        if (sk === 'out' || (sk === 'inout' && tk === 'in') || (sk === 'inout' && tk === 'inout' && direction === 'forward')) {
            srcIsOutput = true
        }

        if (ip) {
            const srcMod = topology?.Topology?.find(m => String(m.Adress) === srcNode)
            const tgtMod = topology?.Topology?.find(m => String(m.Adress) === tgtNode)
            const srcIsM12 = isM12(srcMod?.Name)
            const tgtIsM12 = isM12(tgtMod?.Name)
            
            const srcCh = (parseInt(pSrc.replace(/\D/g, '') || '0') * (srcIsM12 ? 2 : 1)) + (subSrc ?? 0)
            const tgtCh = (parseInt(pTgt.replace(/\D/g, '') || '0') * (tgtIsM12 ? 2 : 1)) + (subTgt ?? 0)

            if (sk === 'inout') {
                fetch(`/io/module/${srcNode}/parameter/20145`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip_address: ip, timeout: 2.0, value: srcIsOutput ? 'true' : 'false', instance: srcCh })
                }).catch(() => {})
            }
            if (tk === 'inout') {
                fetch(`/io/module/${tgtNode}/parameter/20145`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip_address: ip, timeout: 2.0, value: srcIsOutput ? 'false' : 'true', instance: tgtCh })
                }).catch(() => {})
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
            style: { stroke: wireColor, strokeWidth: 1.25 },
            label: subSrc !== undefined
                ? `#${srcNode}:${pSrc}.${subSrc} \u2192 #${tgtNode}:${pTgt}.${subTgt}`
                : `#${srcNode}:${pSrc} \u2192 #${tgtNode}:${pTgt}`,
            data: { kind: 'io', portSrc: pSrc, portTgt: pTgt, subSrc, subTgt, wireColor, straight: false, srcIsOutput },
        }
        setEdges(prev => prev.some(e => e.id === edgeId) ? prev : [...prev, newEdge])
    }, [edges, setEdges, theme, ip, topology])

    const onConnect = useCallback((connection: Connection) => {
        let sh = connection.sourceHandle ?? ''
        let th = connection.targetHandle ?? ''
        let srcNode = connection.source
        let tgtNode = connection.target
        if (!sh.startsWith('src-') || !th.startsWith('tgt-')) return

        if (handleKind(sh) === 'in') {
            const tmp = srcNode; srcNode = tgtNode; tgtNode = tmp
            const tmpH = sh
            sh = th.replace(/^tgt-/, 'src-')
            th = tmpH.replace(/^src-/, 'tgt-')
        }

        const sk = handleKind(sh)
        const tk = handleKind(th)
        const bothInOut = sk === 'inout' && tk === 'inout'

        const srcMod = topology?.Topology?.find(m => String(m.Adress) === srcNode)
        const tgtMod = topology?.Topology?.find(m => String(m.Adress) === tgtNode)
        const srcIsM12 = isM12(srcMod?.Name)
        const tgtIsM12 = isM12(tgtMod?.Name)

        if (connectionMode === 'channel') {
            if (srcIsM12 || tgtIsM12) {
                setPendingConn({ conn: connection, srcIsM12, tgtIsM12, sh, th, srcNode, tgtNode })
            } else {
                if (bothInOut) {
                    setPendingConn({ conn: connection, srcIsM12, tgtIsM12, sh, th, srcNode, tgtNode })
                } else {
                    processConnection(srcNode, tgtNode, sh, th, 0, 0)
                }
            }
        } else {
            if (bothInOut) {
                setPendingConn({ conn: connection, srcIsM12, tgtIsM12, sh, th, srcNode, tgtNode })
            } else {
                processConnection(srcNode, tgtNode, sh, th)
            }
        }
    }, [connectionMode, topology, processConnection, setPendingConn])

    const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        setEdges(prev => reconnectEdge(oldEdge, newConnection, prev))
    }, [setEdges])

    const isValidConnection = useCallback((conn: Connection | Edge): boolean => {
        const c = conn as Connection & { data?: Record<string, unknown> }
        const sh = c.sourceHandle ?? ''
        const th = c.targetHandle ?? ''
        if (!sh.startsWith('src-') || !th.startsWith('tgt-')) return false
        const sk = handleKind(sh)
        const tk = handleKind(th)
        if (sk !== 'inout' && tk !== 'inout' && sk === tk) return false
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

        if (srcNode === tgtNode && portId(nsh) === portId(nth)) return false

        const edgeId = subSrc !== undefined && subTgt !== undefined
            ? `io-${srcNode}-${portId(nsh)}.${subSrc}-${tgtNode}-${portId(nth)}.${subTgt}`
            : `io-${srcNode}-${portId(nsh)}-${tgtNode}-${portId(nth)}`

        return !ioEdgesRef.current.some(e => e.id === edgeId)
    }, [])

    function doClear() {
        setEdges(prev => prev.filter(e => (e.data as Record<string, unknown>)?.kind !== 'io'))
    }

    return {
        nodes, onNodesChange,
        edges, onEdgesChange,
        ioEdgesRef, pendingConn, setPendingConn, processConnection,
        onConnect, onReconnect, isValidConnection, onNodeContextMenu, doClear
    }
}
