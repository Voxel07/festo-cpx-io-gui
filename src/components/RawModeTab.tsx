import { useReducer, useState, useContext } from 'react'
import { Box, Typography, Alert, Paper } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ModuleActuatePanel from './ModuleActuatePanel'
import type { Topology } from '../types'
import ParametersTable from './ParametersTable'
import { AlertsContext } from '../utils/AlertsManager'

interface ParameterMetadata {
    parameter_id: number
    name: string
    is_writable: boolean
    data_type: string
    enums: string[] | null
    unit: string
    first_index: number
    num_instances: number
}

interface Props {
    topology: Topology | null
    ip: string
    selectedModuleAddr: number | null
    onSelectModuleAddr: (addr: number | null) => void
}

interface RawModeState {
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

type RawModeAction =
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

function rawModeReducer(state: RawModeState, action: RawModeAction): RawModeState {
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

export default function RawModeTab({ topology, ip, selectedModuleAddr, onSelectModuleAddr: _onSelectModuleAddr }: Props) {
    const [state, dispatch] = useReducer(rawModeReducer, initialRawModeState)
    const {
        parameters,
        paramValues,
        loadingParams,
        readingParams,
        writingParams,
        writingAllParams,
        expandedParams,
        readingAll,
        tabError,
    } = state
    const alerts = useContext(AlertsContext)

    // Lookup selected module
    const selectedModule = topology?.Topology?.find(m => m.Adress === selectedModuleAddr) || null

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

    // Helper to trigger and clear feedback (now unused, handled by global alerts)

    const toggleExpand = (paramId: number) => {
        dispatch({ type: 'TOGGLE_EXPAND', paramId })
    }

    const onValueChange = (key: string, value: string) => {
        dispatch({ type: 'SET_PARAM_VALUE', key, value })
    }

    // Read a specific instance of a parameter
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

    // Read all instances of a specific parameter
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

    // Read all parameters on the selected module
    async function handleReadAll() {
        if (!selectedModule || !ip || parameters.length === 0) return
        dispatch({ type: 'SET_READING_ALL', reading: true })
        dispatch({ type: 'SET_TAB_ERROR', error: null })
        const errors: string[] = []

        for (const p of parameters) {
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
                    // Dispatch incrementally so the UI fills in value by value
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

    // Write a specific parameter instance
    async function handleWriteParamInstance(paramId: number, instanceIdx: number) {
        if (!selectedModule || !ip) return
        const key = `${paramId}_${instanceIdx}`
        const val = paramValues[key]
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

    // Write the same value to all instances of a multi-instance parameter
    async function handleWriteParamAllInstances(paramId: number, numInstances: number) {
        if (!selectedModule || !ip) return
        const bulkKey = `${paramId}_bulk`
        const val = paramValues[bulkKey]
        if (val === undefined || val.trim() === '') {
            dispatch({ type: 'SET_TAB_ERROR', error: 'Please enter a value to write to all channels.' })
            return
        }

        const writeKey = `${paramId}_writeall`
        dispatch({ type: 'SET_WRITING_ALL_PARAM', key: writeKey, writing: true })
        dispatch({ type: 'SET_TAB_ERROR', error: null })
        try {
            // Omit instance field → backend writes to ALL instances
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
                // Read all instances back to refresh the per-channel UI
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

    if (!topology) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    Please load or generate a topology first to access Raw Mode.
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SettingsIcon fontSize="small" /> Raw Mode
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Click any module in the topology map above to inspect and control it here.
                </Typography>
            </Box>

            {tabError && (
                <Box sx={{ px: 3, pt: 2 }}>
                    <Alert severity="error" onClose={() => dispatch({ type: 'SET_TAB_ERROR', error: null })} sx={{ fontSize: '0.75rem' }}>
                        {tabError}
                    </Alert>
                </Box>
            )}

            <Box sx={{ flex: 1, overflowY: 'auto', p: 3, bgcolor: 'background.default' }}>
                {!selectedModule ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', py: 8 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                            Click a module in the topology map above to inspect parameters and control outputs.
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'flex-start' }}>
                        {/* Actuation Control Section */}
                        <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'background.paper', width: { xs: '100%', md: '35%' }, flexShrink: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: '0.8rem', color: (t) => t.palette.mode === 'dark' ? 'primary.light' : '#1976d2' }}>
                                Output Control Panel
                            </Typography>
                            <ModuleActuatePanel
                                key={selectedModule.Adress}
                                module={selectedModule}
                                ip={ip}
                                mountedValves={selectedModule.MountedValves}
                            />
                        </Paper>

                        {/* Parameters Section */}
                        <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'background.paper', flex: 1 }}>
                            <ParametersTable
                                parameters={parameters}
                                paramValues={paramValues}
                                loadingParams={loadingParams}
                                readingParams={readingParams}
                                writingParams={writingParams}
                                writingAllParams={writingAllParams}
                                expandedParams={expandedParams}
                                readingAll={readingAll}
                                ip={ip}
                                selectedModule={selectedModule}
                                onReadParamInstance={handleReadParamInstance}
                                onReadParamAllInstances={handleReadParamAllInstances}
                                onWriteParamInstance={handleWriteParamInstance}
                                onWriteParamAllInstances={handleWriteParamAllInstances}
                                onReadAll={handleReadAll}
                                onToggleExpand={toggleExpand}
                                onValueChange={onValueChange}
                            />
                        </Paper>
                    </Box>
                )}
            </Box>
        </Box>
    )
}
