export interface TopologyModule {
    Name: string
    Modulecode: number
    ProductKey: string
    Series?: string   // 'CPX-AP-A' | 'CPX-AP-I' | 'Other'
    Adress: number
    Type: string
    NumOfInputs: number
    NumOfOutputs: number
    NumOfInOuts: number
    /** Indices (0-based) of valve slots with a valve physically mounted (VABX only) */
    MountedValves?: number[]
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
}
