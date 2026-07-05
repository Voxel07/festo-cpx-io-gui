import type { BenchConfig, Topology } from '../types'

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
