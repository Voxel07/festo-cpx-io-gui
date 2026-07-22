import type { TopologyModule } from '../types'

/** Resolve valve geometry from API/config data, never from display-name globs. */
export function channelsPerValve(module: TopologyModule): number {
    const slots = module.ValveSlots ?? 0
    if (slots > 0 && module.NumOfOutputs > 0) {
        return Math.max(1, Math.floor(module.NumOfOutputs / slots))
    }
    return 2
}

export function valveSlotToChannels(valveIndex: number, cpv = 2): number[] {
    const base = valveIndex * cpv
    return Array.from({ length: cpv }, (_, index) => base + index)
}

export function expandValveIndices(valveIndices: number[], cpv: number): number[] {
    return valveIndices.flatMap((index) => valveSlotToChannels(index, cpv))
}
