import { useReducer } from 'react'
import type { TopologyModule } from '../types'

export interface ConnectionsFlowState {
    showCables: boolean
    showWires: boolean
    animateWires: boolean
    showPsConfig: boolean
    psComPort: string
    psIpAddr: string
    psPlChannel: string
    psPsChannel: string
    showTestPanel: boolean
    outputStates: Record<string, boolean>
    testResults: Record<string, { values?: boolean[]; value: boolean | null; error?: string }>
    testBusy: Set<string>
    testAllBusy: boolean
    actuateModule: TopologyModule | null
    actuateMountedValves: number[] | undefined
    connectionMode: 'port' | 'channel'
    showDebug: boolean
}

export const initialConnectionsFlowState: ConnectionsFlowState = {
    showCables: false,
    showWires: true,
    animateWires: true,
    showPsConfig: false,
    psComPort: '',
    psIpAddr: '',
    psPlChannel: '',
    psPsChannel: '',
    showTestPanel: false,
    outputStates: {},
    testResults: {},
    testBusy: new Set(),
    testAllBusy: false,
    actuateModule: null,
    actuateMountedValves: undefined,
    connectionMode: 'port',
    showDebug: false,
}

export type ConnectionsFlowAction =
    | { type: 'TOGGLE_CABLES' }
    | { type: 'TOGGLE_WIRES' }
    | { type: 'TOGGLE_ANIMATION' }
    | { type: 'TOGGLE_PS_CONFIG' }
    | { type: 'SET_PS_COMPORT'; port: string }
    | { type: 'SET_PS_IPADDR'; ip: string }
    | { type: 'SET_PS_PL_CHANNEL'; ch: string }
    | { type: 'SET_PS_PS_CHANNEL'; ch: string }
    | { type: 'SET_PS_CONFIG_ALL'; ComPort: string; IpAddr: string; plChannel: string; psChannel: string }
    | { type: 'TOGGLE_TEST_PANEL' }
    | { type: 'SET_OUTPUT_STATE'; edgeId: string; value: boolean }
    | { type: 'SET_OUTPUT_STATES'; states: Record<string, boolean> }
    | { type: 'SET_TEST_RESULT'; edgeId: string; result: { values?: boolean[]; value: boolean | null; error?: string } }
    | { type: 'SET_TEST_RESULTS'; results: Record<string, { values?: boolean[]; value: boolean | null; error?: string }> }
    | { type: 'SET_TEST_BUSY'; edgeId: string; busy: boolean }
    | { type: 'SET_TEST_ALL_BUSY'; busy: boolean }
    | { type: 'OPEN_ACTUATE'; module: TopologyModule; mountedValves: number[] | undefined }
    | { type: 'CLOSE_ACTUATE' }
    | { type: 'SET_CONNECTION_MODE'; mode: 'port' | 'channel' }
    | { type: 'TOGGLE_DEBUG' }

export function connectionsFlowReducer(state: ConnectionsFlowState, action: ConnectionsFlowAction): ConnectionsFlowState {
    switch (action.type) {
        case 'TOGGLE_CABLES':
            return { ...state, showCables: !state.showCables }
        case 'TOGGLE_WIRES':
            return { ...state, showWires: !state.showWires }
        case 'TOGGLE_ANIMATION':
            return { ...state, animateWires: !state.animateWires }
        case 'TOGGLE_PS_CONFIG':
            return { ...state, showPsConfig: !state.showPsConfig }
        case 'SET_PS_COMPORT':
            return { ...state, psComPort: action.port }
        case 'SET_PS_IPADDR':
            return { ...state, psIpAddr: action.ip }
        case 'SET_PS_PL_CHANNEL':
            return { ...state, psPlChannel: action.ch }
        case 'SET_PS_PS_CHANNEL':
            return { ...state, psPsChannel: action.ch }
        case 'SET_PS_CONFIG_ALL':
            return {
                ...state,
                psComPort: action.ComPort,
                psIpAddr: action.IpAddr,
                psPlChannel: action.plChannel,
                psPsChannel: action.psChannel,
            }
        case 'TOGGLE_TEST_PANEL':
            return { ...state, showTestPanel: !state.showTestPanel }
        case 'SET_OUTPUT_STATE':
            return {
                ...state,
                outputStates: { ...state.outputStates, [action.edgeId]: action.value },
            }
        case 'SET_OUTPUT_STATES':
            return { ...state, outputStates: action.states }
        case 'SET_TEST_RESULT':
            return {
                ...state,
                testResults: { ...state.testResults, [action.edgeId]: action.result },
            }
        case 'SET_TEST_RESULTS':
            return { ...state, testResults: action.results }
        case 'SET_TEST_BUSY': {
            const next = new Set(state.testBusy)
            if (action.busy) next.add(action.edgeId); else next.delete(action.edgeId)
            return { ...state, testBusy: next }
        }
        case 'SET_TEST_ALL_BUSY':
            return { ...state, testAllBusy: action.busy }
        case 'OPEN_ACTUATE':
            return { ...state, actuateModule: action.module, actuateMountedValves: action.mountedValves }
        case 'CLOSE_ACTUATE':
            return { ...state, actuateModule: null, actuateMountedValves: undefined }
        case 'SET_CONNECTION_MODE':
            return { ...state, connectionMode: action.mode }
        case 'TOGGLE_DEBUG':
            return { ...state, showDebug: !state.showDebug }
        default:
            return state
    }
}

export function useConnectionsFlowState() {
    return useReducer(connectionsFlowReducer, initialConnectionsFlowState)
}
