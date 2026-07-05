import type { Node } from '@xyflow/react'
import type { TopologyModule, DiffStatusKind, ConnectionEntry, DiagnosisEntry } from '../types'

export type ModuleNodeData = {
    mod: TopologyModule
    status: DiffStatusKind
    editMode: boolean
    /** AP-A backplane or VABX valve body – rendered without card border/shadow */
    isBackplane: boolean
    showLeftHandle: boolean
    showRightHandle: boolean
    /** EPLI module: show AP-in handle on top */
    showApIn?: boolean
    /** EPLI module: show AP-out handle on bottom */
    showApOut?: boolean
    /** Override handle position for AP-in (percentage within SVG image box); defaults to EPLI positions */
    apInPos?: { top: string; left: string }
    /** Override handle position for AP-out (percentage within SVG image box); defaults to EPLI positions */
    apOutPos?: { top: string; left: string }
    /** Show valve editor button (VABX body modules in ConnectionsFlow) */
    showValveEditor?: boolean
    /** Show mounted valves visually without editor UI (read-only topology view) */
    showValves?: boolean
    /** Valve slot group IDs that are hidden (empty, not mounted) */
    hiddenValves?: string[]
    /** IO connections for this module, populated by ConnectionsFlow */
    connections?: ConnectionEntry[]
    /** Suppress all IO port handles (valve bodies have no external M12 connectors) */
    suppressIoHandles?: boolean
    /** Called when the user changes which valves are mounted or total slots; indices are 0-based */
    onValveChange?: (addr: number, mountedValves: number[], valveSlots?: number) => void
    /** True when this module is currently being tested (pulse highlight) */
    active?: boolean
    /** Show VABX module inputs based on parameter 20201 */
    hasVabxInputs?: boolean
    /** True if a comparison is currently active */
    compareActive?: boolean
    /** Active diagnoses for this module (from system diagnostics) */
    diagnoses?: DiagnosisEntry[]
}

export type ModuleNodeType = Node<ModuleNodeData, 'mod'>
