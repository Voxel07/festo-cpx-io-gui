import type { Edge, Node } from '@xyflow/react'
import type { Topology } from '../types'

export type AutomationBlockType =
    | 'input'
    | 'temperature'
    | 'voltage'
    | 'pressure'
    | 'timer'
    | 'delay'
    | 'counter'
    | 'and'
    | 'or'
    | 'not'
    | 'output'
    | 'valve'
    | 'cylinder'
    | 'comment'

export type AutomationTarget = 'real' | 'simulated'

export interface AutomationNodeData extends Record<string, unknown> {
    label: string
    module_addr?: number
    module_name?: string
    channel?: number
    trigger?: 'rising' | 'falling' | 'change' | 'level_high' | 'level_low'
    debounce_ms?: number
    limit?: number
    hysteresis?: number
    scale?: number
    offset?: number
    events_per_toggle?: number
    initial_delay_ms?: number
    interval_ms?: number
    repeat?: boolean
    delay_ms?: number
    action?: 'on' | 'off' | 'toggle' | 'follow'
    travel_time_s?: number
    text?: string
    runtime?: Record<string, boolean | number>
}

export type AutomationNode = Node<AutomationNodeData, AutomationBlockType>
export type AutomationEdge = Edge

export interface AutomationProgram {
    id?: string | null
    name: string
    description: string
    version: string
    scan_interval_ms: number
    nodes: AutomationNode[]
    edges: AutomationEdge[]
    topology?: Topology | null
}

export interface AutomationStatus {
    running: boolean
    target?: AutomationTarget | null
    program_id?: string | null
    program_name?: string | null
    cycle_count: number
    last_cycle_ms?: number | null
    last_error?: string | null
    node_states: Record<string, Record<string, boolean | number>>
    simulation?: {
        inputs: Record<string, boolean>
        analogs: Record<string, number>
        outputs: Record<string, boolean>
    }
}
