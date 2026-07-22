import type { TopologyModule } from '../types'
import { channelsPerValve, valveSlotToChannels } from './valveChannels'
import type { ActuateChannel } from '../components/ModuleActuatePanel'

export const isM12 = (name?: string) => !!(name ?? '').includes('M12')
export const isValveBody = (mod: TopologyModule) =>
    (mod.ValveSlots ?? 0) > 0 || (mod.Type.toLowerCase().includes('valve') && mod.NumOfOutputs > 0)
export const isValveInterface = (mod: TopologyModule) =>
    mod.Type.toLowerCase().includes('valve') && mod.NumOfOutputs === 0

export function buildChannels(
    mod: TopologyModule,
    mountedValves?: number[],
    includeUnmounted = false,
): ActuateChannel[] {
    const name = mod.Name

    // ── Valve body: each slot → N hardware channels ──
    if (isValveBody(mod)) {
        const cpv = channelsPerValve(mod)
        // Determine number of valve slots from NumOfOutputs / cpv
        const totalValves = mod.NumOfOutputs > 0
            ? Math.floor(mod.NumOfOutputs / cpv)
            : 4 // fallback: assume 4 valves

        const slots = includeUnmounted
            ? Array.from({ length: totalValves }, (_, i) => i)
            : (mountedValves && mountedValves.length > 0
                ? mountedValves
                : Array.from({ length: totalValves }, (_, i) => i))

        const channels: ActuateChannel[] = []
        for (const slotIdx of slots) {
            const hwChannels = valveSlotToChannels(slotIdx, cpv)
            for (let sub = 0; sub < hwChannels.length; sub++) {
                const coil = cpv > 1 ? (sub === 0 ? 'A' : 'B') : ''
                channels.push({
                    label: `Valve ${slotIdx + 1}${coil ? ` (coil ${coil})` : ''}`,
                    index: hwChannels[sub],
                    valveIndex: slotIdx,
                    subChannel: sub,
                })
            }
        }
        return channels
    }

    // ── Regular output / inout module: enumerate by port ──
    const cpp = isM12(name) ? 2 : 1
    const channels: ActuateChannel[] = []

    for (let i = 0; i < mod.NumOfOutputs; i++) {
        const portIdx = Math.floor(i / cpp)
        const sub = cpp > 1 ? i % cpp : 0
        channels.push({
            label: cpp > 1 ? `X${portIdx} ch${sub}` : `X${portIdx}`,
            index: i,
            valveIndex: -1,
            subChannel: sub,
        })
    }
    const inoutStart = mod.NumOfOutputs
    for (let i = 0; i < mod.NumOfInOuts; i++) {
        const portIdx = Math.floor((inoutStart + i) / cpp)
        const sub = cpp > 1 ? (inoutStart + i) % cpp : 0
        channels.push({
            label: cpp > 1 ? `X${portIdx} ch${sub}` : `X${portIdx}`,
            index: inoutStart + i,
            valveIndex: -1,
            subChannel: sub,
        })
    }

    return channels
}
