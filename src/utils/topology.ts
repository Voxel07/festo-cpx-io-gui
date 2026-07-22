import type { BenchConfig, Topology } from '../types'

/**
 * Mounted valves and the configured slot count are installation metadata; live
 * topology discovery cannot determine them. Keep the stored values when a live
 * refresh returns the same physical module.
 */
export function preserveMountedValveMetadata(live: BenchConfig, stored: BenchConfig | null): BenchConfig {
    if (!stored?.module_instances?.length) return live

    const storedByProductKey = new Map(stored.module_instances
        .filter(module => module.product_key)
        .map(module => [module.product_key, module]))
    const storedByAddress = new Map(stored.module_instances.map(module => [module.address, module]))

    return {
        ...live,
        module_instances: (live.module_instances ?? []).map(module => {
            const productMatch = module.product_key ? storedByProductKey.get(module.product_key) : undefined
            const addressMatch = storedByAddress.get(module.address)
            const previous = productMatch ?? (
                addressMatch && addressMatch.module_code === module.module_code ? addressMatch : undefined
            )
            if (!previous) return module
            return {
                ...module,
                mounted_valves: previous.mounted_valves !== undefined
                    ? [...previous.mounted_valves]
                    : module.mounted_valves,
                valve_slots: previous.valve_slots ?? module.valve_slots,
            }
        }),
    }
}

export function configToTopology(config: BenchConfig): Topology {
    return {
        Name: config.test_bench.name || 'CPX-AP Bench',
        Description: config.test_bench.description || '',
        Version: config.test_bench.version || '1.0',
        Topology: (config.module_instances || []).map(inst => {
            const typeDef = config.module_types?.[inst.module_type_ref]
            return {
                Name: inst.display_name,
                Modulecode: inst.module_code,
                ProductKey: inst.product_key,
                Adress: inst.address,
                Type: inst.category, // Direct mapping from backend metadata!
                NumOfInputs: inst.num_inputs ?? typeDef?.num_inputs ?? 0,
                NumOfOutputs: inst.num_outputs ?? typeDef?.num_outputs ?? 0,
                NumOfInOuts: inst.num_inouts ?? typeDef?.num_configurable ?? 0,
                MountedValves: inst.mounted_valves ?? undefined,
                ValveSlots: inst.valve_slots ?? typeDef?.valve_count ?? undefined,
            }
        })
    }
}
