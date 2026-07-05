import { useReducer, useContext, useState } from 'react'
import { AlertsContext } from '../utils/AlertsContext'
import type { ParameterMetadata } from '../components/ParametersTable'
import type { TopologyModule } from '../types'

export interface RawModeState {
    parameters: ParameterMetadata[]
    paramValues: Record<string, string>
    loadingParams: boolean
    readingParams: Record<string, boolean>
    writingParams: Record<string, boolean>
    writingAllParams: Record<string, boolean>
    expandedParams: Record<number, boolean>
    readingAll: boolean
    tabError: string | null
}

const initialRawModeState: RawModeState = {
    parameters: [],
    paramValues: {},
    loadingParams: false,
    readingParams: {},
    writingParams: {},
    writingAllParams: {},
    expandedParams: {},
    readingAll: false,
    tabError: null,
}

export type RawModeAction =
    | { type: 'RESET_MODULE' }
    | { type: 'FETCH_PARAMS_START' }
    | { type: 'FETCH_PARAMS_SUCCESS'; parameters: ParameterMetadata[] }
    | { type: 'FETCH_PARAMS_FAIL'; error: string }
    | { type: 'SET_READING_PARAM'; key: string; reading: boolean }
    | { type: 'SET_WRITING_PARAM'; key: string; writing: boolean }
    | { type: 'SET_PARAM_VALUE'; key: string; value: string }
    | { type: 'SET_PARAM_VALUES'; values: Record<string, string> }
    | { type: 'TOGGLE_EXPAND'; paramId: number }
    | { type: 'SET_WRITING_ALL_PARAM'; key: string; writing: boolean }
    | { type: 'SET_READING_ALL'; reading: boolean }
    | { type: 'SET_TAB_ERROR'; error: string | null }

export function rawModeReducer(state: RawModeState, action: RawModeAction): RawModeState {
    switch (action.type) {
        case 'RESET_MODULE':
            return {
                ...state,
                parameters: [],
                paramValues: {},
                expandedParams: {},
                tabError: null,
            }
        case 'FETCH_PARAMS_START':
            return {
                ...state,
                loadingParams: true,
                tabError: null,
            }
        case 'FETCH_PARAMS_SUCCESS':
            return {
                ...state,
                loadingParams: false,
                parameters: action.parameters,
                paramValues: {},
                expandedParams: {},
            }
        case 'FETCH_PARAMS_FAIL':
            return {
                ...state,
                loadingParams: false,
                tabError: action.error,
                parameters: [],
            }
        case 'SET_READING_PARAM':
            return {
                ...state,
                readingParams: { ...state.readingParams, [action.key]: action.reading },
            }
        case 'SET_WRITING_PARAM':
            return {
                ...state,
                writingParams: { ...state.writingParams, [action.key]: action.writing },
            }
        case 'SET_PARAM_VALUE':
            return {
                ...state,
                paramValues: { ...state.paramValues, [action.key]: action.value },
            }
        case 'SET_PARAM_VALUES':
            return {
                ...state,
                paramValues: { ...state.paramValues, ...action.values },
            }
        case 'TOGGLE_EXPAND':
            return {
                ...state,
                expandedParams: {
                    ...state.expandedParams,
                    [action.paramId]: !state.expandedParams[action.paramId],
                },
            }
        case 'SET_WRITING_ALL_PARAM':
            return {
                ...state,
                writingAllParams: { ...state.writingAllParams, [action.key]: action.writing },
            }
        case 'SET_READING_ALL':
            return {
                ...state,
                readingAll: action.reading,
            }
        case 'SET_TAB_ERROR':
            return {
                ...state,
                tabError: action.error,
            }
        default:
            return state
    }
}

export function useRawMode(selectedModule: TopologyModule | null, ip: string, selectedModuleAddr: number | null) {
    const [state, dispatch] = useReducer(rawModeReducer, initialRawModeState)
    const alerts = useContext(AlertsContext)

    async function fetchParams(address: number, ipAddress: string) {
        dispatch({ type: 'FETCH_PARAMS_START' })
        try {
            const r = await fetch(`/io/module/${address}/parameters?ip_address=${encodeURIComponent(ipAddress)}`)
            const d = await r.json()
            if (!r.ok) {
                dispatch({ type: 'FETCH_PARAMS_FAIL', error: d.detail ?? 'Failed to load parameters.' })
            } else {
                dispatch({ type: 'FETCH_PARAMS_SUCCESS', parameters: d })
            }
        } catch (err) {
            dispatch({ type: 'FETCH_PARAMS_FAIL', error: (err as Error).message })
        }
    }

    const [prevSelectedAddr, setPrevSelectedAddr] = useState<number | null>(null)

    if (selectedModuleAddr !== prevSelectedAddr) {
        setPrevSelectedAddr(selectedModuleAddr)
        if (!selectedModule || !ip) {
            dispatch({ type: 'RESET_MODULE' })
        } else {
            fetchParams(selectedModule.Adress, ip)
        }
    }

    const toggleExpand = (paramId: number) => {
        dispatch({ type: 'TOGGLE_EXPAND', paramId })
    }

    const onValueChange = (key: string, value: string) => {
        dispatch({ type: 'SET_PARAM_VALUE', key, value })
    }

    async function handleReadParamInstance(paramId: number, instanceIdx: number) {
        if (!selectedModule || !ip) return
        const key = `${paramId}_${instanceIdx}`
        dispatch({ type: 'SET_READING_PARAM', key, reading: true })
        dispatch({ type: 'SET_TAB_ERROR', error: null })
        try {
            const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${paramId}?ip_address=${encodeURIComponent(ip)}&instance=${instanceIdx}`)
            const d = await r.json()
            if (!r.ok) {
                const errText = d.detail ?? `Failed to read parameter ${paramId} instance ${instanceIdx}.`
                alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
                dispatch({ type: 'SET_TAB_ERROR', error: errText })
            } else {
                dispatch({ type: 'SET_PARAM_VALUE', key, value: String(d.value) })
                alerts?.showAlert('success', `Parameter ${paramId} read successfully.`)
            }
            dispatch({ type: 'SET_READING_PARAM', key, reading: false })
        } catch (err) {
            const errText = (err as Error).message
            alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
            dispatch({ type: 'SET_TAB_ERROR', error: errText })
            dispatch({ type: 'SET_READING_PARAM', key, reading: false })
        }
    }

    async function handleReadParamAllInstances(paramId: number, numInstances: number) {
        if (!selectedModule || !ip) return
        const readKey = `${paramId}_all`
        dispatch({ type: 'SET_READING_PARAM', key: readKey, reading: true })
        dispatch({ type: 'SET_TAB_ERROR', error: null })
        try {
            const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${paramId}?ip_address=${encodeURIComponent(ip)}`)
            const d = await r.json()
            if (!r.ok) {
                const errText = d.detail ?? `Failed to read parameter ${paramId}.`
                dispatch({ type: 'SET_TAB_ERROR', error: errText })
                alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
            } else {
                const nextVals: Record<string, string> = {}
                if (Array.isArray(d.value)) {
                    for (let i = 0; i < numInstances; i++) {
                        nextVals[`${paramId}_${i}`] = d.value[i] !== undefined ? String(d.value[i]) : ''
                    }
                } else {
                    nextVals[`${paramId}_0`] = String(d.value)
                }
                alerts?.showAlert('success', `Parameter ${paramId} (all instances) read successfully.`)
                dispatch({ type: 'SET_PARAM_VALUES', values: nextVals })
            }
            dispatch({ type: 'SET_READING_PARAM', key: readKey, reading: false })
        } catch (err) {
            const errText = (err as Error).message
            dispatch({ type: 'SET_TAB_ERROR', error: errText })
            alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
            dispatch({ type: 'SET_READING_PARAM', key: readKey, reading: false })
        }
    }

    async function handleReadAll() {
        if (!selectedModule || !ip || state.parameters.length === 0) return
        dispatch({ type: 'SET_READING_ALL', reading: true })
        dispatch({ type: 'SET_TAB_ERROR', error: null })
        const errors: string[] = []

        for (const p of state.parameters) {
            try {
                const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${p.parameter_id}?ip_address=${encodeURIComponent(ip)}`)
                const d = await r.json()
                if (r.ok) {
                    const vals: Record<string, string> = {}
                    if (Array.isArray(d.value)) {
                        for (let i = 0; i < p.num_instances; i++) {
                            vals[`${p.parameter_id}_${i}`] = d.value[i] !== undefined ? String(d.value[i]) : ''
                        }
                    } else {
                        vals[`${p.parameter_id}_0`] = String(d.value)
                    }
                    dispatch({ type: 'SET_PARAM_VALUES', values: vals })
                } else {
                    const errText = d.detail ?? 'error'
                    errors.push(`${p.name}: ${errText}`)
                }
            } catch (err) {
                const errText = (err as Error).message
                errors.push(`${p.name}: ${errText}`)
            }
        }

        if (errors.length > 0) {
            alerts?.showAlert('error', 'Some parameters failed to read. Check the tab error.')
            dispatch({ type: 'SET_TAB_ERROR', error: `Some parameters failed to read:\n${errors.join('\n')}` })
        } else {
            alerts?.showAlert('success', 'All parameters read successfully.')
        }
        dispatch({ type: 'SET_READING_ALL', reading: false })
    }

    async function handleWriteParamInstance(paramId: number, instanceIdx: number) {
        if (!selectedModule || !ip) return
        const key = `${paramId}_${instanceIdx}`
        const val = state.paramValues[key]
        if (val === undefined || val.trim() === '') {
            dispatch({ type: 'SET_TAB_ERROR', error: 'Please enter a value to write.' })
            return
        }

        dispatch({ type: 'SET_WRITING_PARAM', key, writing: true })
        dispatch({ type: 'SET_TAB_ERROR', error: null })
        try {
            const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${paramId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip_address: ip,
                    value: val,
                    instance: instanceIdx,
                }),
            })
            const d = await r.json()
            if (!r.ok) {
                const errText = d.detail ?? `Failed to write parameter ${paramId} instance ${instanceIdx}.`
                alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
                dispatch({ type: 'SET_TAB_ERROR', error: errText })
            } else {
                dispatch({ type: 'SET_PARAM_VALUE', key, value: String(d.value) })
                alerts?.showAlert('success', `Parameter ${paramId} written successfully.`)
            }
            dispatch({ type: 'SET_WRITING_PARAM', key, writing: false })
        } catch (err) {
            const errText = (err as Error).message
            alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
            dispatch({ type: 'SET_TAB_ERROR', error: errText })
            dispatch({ type: 'SET_WRITING_PARAM', key, writing: false })
        }
    }

    async function handleWriteParamAllInstances(paramId: number, numInstances: number) {
        if (!selectedModule || !ip) return
        const bulkKey = `${paramId}_bulk`
        const val = state.paramValues[bulkKey]
        if (val === undefined || val.trim() === '') {
            dispatch({ type: 'SET_TAB_ERROR', error: 'Please enter a value to write to all channels.' })
            return
        }

        const writeKey = `${paramId}_writeall`
        dispatch({ type: 'SET_WRITING_ALL_PARAM', key: writeKey, writing: true })
        dispatch({ type: 'SET_TAB_ERROR', error: null })
        try {
            const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${paramId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip_address: ip,
                    value: val,
                }),
            })
            const d = await r.json()
            if (!r.ok) {
                const errText = d.detail ?? `Failed to write parameter ${paramId} to all instances.`
                alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
                dispatch({ type: 'SET_TAB_ERROR', error: errText })
            } else {
                const r2 = await fetch(`/io/module/${selectedModule.Adress}/parameter/${paramId}?ip_address=${encodeURIComponent(ip)}`)
                const d2 = await r2.json()
                if (r2.ok) {
                    const nextVals: Record<string, string> = {}
                    if (Array.isArray(d2.value)) {
                        for (let i = 0; i < numInstances; i++) {
                            nextVals[`${paramId}_${i}`] = d2.value[i] !== undefined ? String(d2.value[i]) : ''
                        }
                    } else {
                        nextVals[`${paramId}_0`] = String(d2.value)
                    }
                    dispatch({ type: 'SET_PARAM_VALUES', values: nextVals })
                }
                alerts?.showAlert('success', `Parameter ${paramId} written to all instances successfully.`)
            }
            dispatch({ type: 'SET_WRITING_ALL_PARAM', key: writeKey, writing: false })
        } catch (err) {
            const errText = (err as Error).message
            alerts?.showAlert('error', `Param ${paramId}: ${errText}`)
            dispatch({ type: 'SET_TAB_ERROR', error: errText })
            dispatch({ type: 'SET_WRITING_ALL_PARAM', key: writeKey, writing: false })
        }
    }

    return {
        state,
        dispatch,
        handleReadParamInstance,
        handleReadParamAllInstances,
        handleReadAll,
        handleWriteParamInstance,
        handleWriteParamAllInstances,
        toggleExpand,
        onValueChange
    }
}
