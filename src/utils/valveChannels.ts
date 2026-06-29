/**
 * Valve channel mapping — defines how many hardware channels correspond to each
 * valve slot per product family.  All VABX valve bodies have the same physical
 * layout (8 channels for 4 valves = 2 channels per valve) except for VEAM which
 * uses monostable valves (1 channel per valve).
 */

// Patterns use fnmatch-style glob matching against the module display_name
const VALVE_CHANNEL_CONFIG: Array<[string, number]> = [
    // V4A / V4B / V4C / BV-S variants: 4 bistable valves, 2 coils each → 8 channels
    ['VABX-A-S-BV-V4*', 2],
    ['VABX-A-S-BV-*', 2],    // generic BV-S catch-all
    ['VABX-A-BV-S-*', 2],    // BV-S without adaptor prefix
    ['VABX-A-BV-*', 2],      // plain BV variants

    // VEAM (monostable): 1 channel per valve
    ['VABX-A-VE-S*', 1],
    ['VABX-A-VE-*', 1],

    // VP (proportional): 2 channels per valve
    ['VABX-A-VP-*', 2],
]

/** Default channels-per-valve for unmatched VABX bodies */
const VALVE_DEFAULT_CPV = 2

/** Simple fnmatch-style glob matching */
function matchPattern(name: string, pattern: string): boolean {
    const re = new RegExp(
        '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        'i',
    )
    return re.test(name)
}

/** Return the number of hardware channels per valve slot for a given module name. */
export function channelsPerValve(moduleName: string): number {
    for (const [pattern, cpv] of VALVE_CHANNEL_CONFIG) {
        if (matchPattern(moduleName, pattern)) return cpv
    }
    return VALVE_DEFAULT_CPV
}

/** Return the hardware channel indices for a given 0-based valve slot. */
export function valveSlotToChannels(valveIndex: number, cpv?: number): number[] {
    const c = cpv ?? VALVE_DEFAULT_CPV
    const base = valveIndex * c
    return Array.from({ length: c }, (_, i) => base + i)
}

/** Flatten a list of valve slot indices into hardware channel indices. */
function expandValveIndices(valveIndices: number[], moduleName: string): number[] {
    const cpv = channelsPerValve(moduleName)
    const channels: number[] = []
    for (const vi of valveIndices) {
        channels.push(...valveSlotToChannels(vi, cpv))
    }
    return channels
}
