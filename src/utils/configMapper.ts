import type { BenchConfig, Topology } from '../types'

export function configToTopology(config: BenchConfig): Topology {
    return {
        Name: config.test_bench.name || 'CPX-AP Bench',
        Description: config.test_bench.description || '',
        Version: config.test_bench.version || '1.0',
        Topology: (config.module_instances || []).map(inst => {
            const typeDef = config.module_types?.[inst.module_type_ref]
            const num_in = inst.num_inputs ?? typeDef?.num_inputs ?? 0
            const num_out = inst.num_outputs ?? typeDef?.num_outputs ?? 0
            const num_io = inst.num_inouts ?? typeDef?.num_configurable ?? 0
            const series = typeDef?.product_family ?? ''

            let m_type = 'Input'
            const upName = inst.display_name.toUpperCase()
            if (inst.category === 'valve' || upName.includes('VABX-A-S-BV-V4') || upName.includes('VMPAL') || upName.includes('VAEM')) m_type = 'Valve'
            else if (inst.category === 'inout') m_type = 'In/Out'
            else if (inst.category === 'output') m_type = 'Output'
            else if (inst.category === 'bus') m_type = 'Bus'

            return {
                Name: inst.display_name,
                Modulecode: inst.module_code,
                ProductKey: inst.product_key,
                Series: series,
                Adress: inst.address,
                Type: m_type,
                NumOfInputs: num_in,
                NumOfOutputs: num_out,
                NumOfInOuts: num_io,
                MountedValves: inst.mounted_valves ?? undefined,
                ValveSlots: inst.valve_slots ?? typeDef?.valve_count ?? undefined,
            }
        })
    }
}
