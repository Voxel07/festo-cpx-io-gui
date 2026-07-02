export interface TopologyModule {
    Name: string
    Modulecode: number
    ProductKey: string
    Adress: number
    Type: string
    NumOfInputs: number
    NumOfOutputs: number
    NumOfInOuts: number
    /** Indices (0-based) of valve slots with a valve physically mounted (VABX only) */
    MountedValves?: number[]
    /** Number of physical slots on the block (VMPAL only) */
    ValveSlots?: number
}

export interface Topology {
    Name: string
    Description: string
    Version: string
    Topology: TopologyModule[]
}

export interface Change {
    address: number
    field: string
    stored_value: unknown
    live_value: unknown
}

export interface CompareResult {
    stored: Topology
    live: Topology
    changes: Change[]
    added: TopologyModule[]
    removed: TopologyModule[]
    has_diff: boolean
}

export type DiffStatusKind = 'unchanged' | 'changed' | 'added' | 'removed'
export type DiffStatus = Record<number, DiffStatusKind>

export interface GenerateResult {
    topology: Topology
    saved_to: string | null
}

export interface IOConnection {
    id: string
    source_module_addr: number
    source_channel: string   // port ID only, e.g. 'X0'
    target_module_addr: number
    target_channel: string   // port ID only
    /** Full xyflow handle ID including kind, e.g. 'src-out-X0' (v2 format) */
    source_handle?: string
    /** Full xyflow handle ID including kind, e.g. 'tgt-in-X0' (v2 format) */
    target_handle?: string
    label?: string
    /** 90°-corner waypoints for the routed cable (canvas coordinates) */
    waypoints?: Array<{ x: number; y: number }>
    /** True if point-to-point straight line routing is used */
    straight?: boolean
    /** For per-channel wiring: specific subchannel index (e.g., 0 or 1 for M12, 0 for M8) */
    source_subchannel?: number
    target_subchannel?: number
}

export interface ConnectionEntry {
    portId: string      // port ID on THIS module, e.g. 'X0'
    peerAddr: string    // address of the peer module (node ID)
    peerPort: string    // port ID on the peer module
    dir: 'src' | 'tgt' // whether this module is the source (output end) or target (input end)
}

export interface ConnectionFile {
    version: string
    topology_name?: string
    connections: IOConnection[]
    /** MountedValves per valve-body module, keyed by address string */
    mounted_valves?: Record<string, number[]>
}


// ── BenchConfig Schema ────────────────────────────────────────────────────────

export interface TestBenchMetadata {
    id: string
    name: string
    description: string
    ip_address: string
    version: string
}

export interface ChannelDefinition {
    index: number
    port_index?: number
    name: string
    supported_modes?: string[]
    default_mode?: string
    current_mode?: string
    capabilities: string[]
}

export interface ModuleTypeDefinition {
    module_code: number
    capabilities: string[]
    num_inputs: number
    num_outputs: number
    num_configurable: number
    valve_count: number
    channels: ChannelDefinition[]
    image_asset?: string
}

export interface ModuleInstance {
    instance_id: string
    display_name: string
    module_code: number
    product_key: string
    address: number
    category: 'input' | 'output' | 'inout' | 'bus' | 'valve'
    module_type_ref: string
    mounted_valves?: number[]
    valve_slots?: number
    num_inputs?: number
    num_outputs?: number
    num_inouts?: number
}

export interface WiringConnection {
    id: string
    source_instance_id: string
    source_channel: string
    target_instance_id: string
    target_channel: string
    source_handle?: string
    target_handle?: string
    label?: string
    waypoints?: Array<{ x: number; y: number }>
    straight?: boolean
    source_subchannel?: number
    target_subchannel?: number
}

export interface TestDefinition {
    test_id: string
    name: string
    version: string
    description: string
    required_capabilities: string[]
    required_wiring_type?: 'physical' | 'simulated' | 'virtual'
    supported_categories: string[]
    safety_class: 'safe' | 'caution' | 'destructive'
    allowed_in_ci: boolean
    can_run_parallel?: boolean
    parameters?: Record<string, unknown>
}

export interface UIModulePosition {
    instance_id: string
    x: number
    y: number
    image_path?: string
}

export interface UIChannelAnchor {
    instance_id: string
    channel_index: number
    anchor_x: number
    anchor_y: number
    hotspot_radius?: number
}

export interface UIVisualizationMetadata {
    module_positions?: UIModulePosition[]
    channel_anchors?: UIChannelAnchor[]
}

export interface PowerSupplyConfig {
    ComPort?: string | null
    'Ip addr'?: string | null
    comport?: string | null
    ip_address?: string | null
    pl_channel?: number | null
    ps_channel?: number | null
}

export interface BenchConfig {
    schema_version: string
    test_bench: TestBenchMetadata
    power_supply?: PowerSupplyConfig | null
    module_types: Record<string, ModuleTypeDefinition>
    module_instances: ModuleInstance[]
    wiring: WiringConnection[]
    test_definitions?: TestDefinition[]
    ui_metadata?: UIVisualizationMetadata
}
