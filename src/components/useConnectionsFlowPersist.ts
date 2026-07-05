import { useContext } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { BenchConfig, WiringConnection } from '../types'
import type { ModuleNodeData } from './moduleNodeTypes'
import { AlertsContext } from '../utils/AlertsContext'

function portId(handleId: string): string {
    const parts = handleId.split('-')
    const known = new Set(['in', 'out', 'inout'])
    return (known.has(parts[1]) ? parts.slice(2) : parts.slice(1)).join('-')
}

export function useConnectionsFlowPersist(
    configPath: string,
    ioEdgesRef: React.MutableRefObject<Edge[]>,
    nodes: Node[],
    psComPort: string,
    psIpAddr: string,
    psPlChannel: string,
    psPsChannel: string,
    onConfigLoad?: (config: BenchConfig) => void
) {
    const alerts = useContext(AlertsContext)

    async function doSave() {
        try {
            const getRes = await fetch(`/config?file_path=${encodeURIComponent(configPath)}`)
            if (!getRes.ok) {
                alerts?.showAlert('error', 'Could not read existing configuration to update. Make sure you generate/save a configuration first.')
                return
            }
            const config: BenchConfig = await getRes.json()

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

    async function doLoad() {
        try {
            const r = await fetch(`/config?file_path=${encodeURIComponent(configPath)}`)
            const d: BenchConfig = await r.json()
            if (!r.ok) {
                alerts?.showAlert('error', `Error: ${(d as any).detail ?? 'Unknown error'}`)
                return
            }

            onConfigLoad?.(d)

            alerts?.showAlert('success', `Loaded config from ${configPath}`)
        } catch (e) {
            alerts?.showAlert('error', `Error: ${(e as Error).message}`)
        }
    }

    return { doSave, doLoad }
}
