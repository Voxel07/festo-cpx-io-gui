import { useState, useEffect, Fragment } from 'react'
import {
    Box, Typography, Divider, TextField, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow,
    Select, MenuItem, Alert, CircularProgress, Stack, Paper, IconButton, Collapse
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import ModuleActuatePanel from './ModuleActuatePanel'
import type { Topology, TopologyModule } from '../types'
import { TooltipButton } from './TooltipButton'

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

export default function RawModeTab({ topology, ip, selectedModuleAddr, onSelectModuleAddr }: Props) {
    const [parameters, setParameters] = useState<ParameterMetadata[]>([])
    // Store values as "paramId_instanceIdx" -> value string
    const [paramValues, setParamValues] = useState<Record<string, string>>({})
    const [loadingParams, setLoadingParams] = useState(false)
    const [readingParams, setReadingParams] = useState<Record<string, boolean>>({})
    const [writingParams, setWritingParams] = useState<Record<string, boolean>>({})
    const [expandedParams, setExpandedParams] = useState<Record<number, boolean>>({})
    const [paramFeedback, setParamFeedback] = useState<Record<string, { severity: 'success' | 'error'; text: string }>>({})
    const [readingAll, setReadingAll] = useState(false)
    const [tabError, setTabError] = useState<string | null>(null)

    // Lookup selected module
    const selectedModule = topology?.Topology?.find(m => m.Adress === selectedModuleAddr) || null

    // Load parameters when selected module changes
    useEffect(() => {
        if (!selectedModule || !ip) {
            setParameters([])
            setParamValues({})
            setExpandedParams({})
            setParamFeedback({})
            setTabError(null)
            return
        }

        async function fetchParams() {
            setLoadingParams(true)
            setTabError(null)
            try {
                const r = await fetch(`/io/module/${selectedModule!.Adress}/parameters?ip_address=${encodeURIComponent(ip)}`)
                const d = await r.json()
                if (!r.ok) {
                    setTabError(d.detail ?? 'Failed to load parameters.')
                    setParameters([])
                } else {
                    setParameters(d)
                    setParamValues({})
                    setExpandedParams({})
                    setParamFeedback({})
                }
            } catch (err) {
                setTabError((err as Error).message)
                setParameters([])
            } finally {
                setLoadingParams(false)
            }
        }
        fetchParams()
    }, [selectedModule, ip])

    // Helper to trigger and clear feedback
    const setFeedback = (key: string, severity: 'success' | 'error', text: string) => {
        setParamFeedback(prev => ({ ...prev, [key]: { severity, text } }))
        if (severity === 'success') {
            setTimeout(() => {
                setParamFeedback(prev => {
                    const next = { ...prev }
                    if (next[key]?.severity === 'success') delete next[key]
                    return next
                })
            }, 4000)
        }
    }

    // Toggle collapsible channels view
    const toggleExpand = (paramId: number) => {
        setExpandedParams(prev => ({ ...prev, [paramId]: !prev[paramId] }))
    }

    // Read a specific instance of a parameter
    async function handleReadParamInstance(paramId: number, instanceIdx: number) {
        if (!selectedModule || !ip) return
        const key = `${paramId}_${instanceIdx}`
        setReadingParams(prev => ({ ...prev, [key]: true }))
        setTabError(null)
        try {
            const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${paramId}?ip_address=${encodeURIComponent(ip)}&instance=${instanceIdx}`)
            const d = await r.json()
            if (!r.ok) {
                const errText = d.detail ?? `Failed to read parameter ${paramId} instance ${instanceIdx}.`
                setFeedback(key, 'error', errText)
                setTabError(errText)
            } else {
                setParamValues(prev => ({ ...prev, [key]: d.value }))
                setFeedback(key, 'success', '✓ Read')
            }
        } catch (err) {
            const errText = (err as Error).message
            setFeedback(key, 'error', errText)
            setTabError(errText)
        } finally {
            setReadingParams(prev => ({ ...prev, [key]: false }))
        }
    }

    // Read all instances of a specific parameter (using single backend call returning a list)
    async function handleReadParamAllInstances(paramId: number, numInstances: number) {
        if (!selectedModule || !ip) return
        const readKey = `${paramId}_all`
        setReadingParams(prev => ({ ...prev, [readKey]: true }))
        setTabError(null)
        try {
            const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${paramId}?ip_address=${encodeURIComponent(ip)}`)
            const d = await r.json()
            if (!r.ok) {
                const errText = d.detail ?? `Failed to read parameter ${paramId}.`
                setTabError(errText)
                for (let i = 0; i < numInstances; i++) {
                    setFeedback(`${paramId}_${i}`, 'error', errText)
                }
            } else {
                const nextVals = { ...paramValues }
                if (Array.isArray(d.value)) {
                    for (let i = 0; i < numInstances; i++) {
                        nextVals[`${paramId}_${i}`] = d.value[i] !== undefined ? String(d.value[i]) : ''
                        setFeedback(`${paramId}_${i}`, 'success', '✓ Read')
                    }
                } else {
                    nextVals[`${paramId}_0`] = String(d.value)
                    setFeedback(`${paramId}_0`, 'success', '✓ Read')
                }
                setParamValues(nextVals)
            }
        } catch (err) {
            const errText = (err as Error).message
            setTabError(errText)
            for (let i = 0; i < numInstances; i++) {
                setFeedback(`${paramId}_${i}`, 'error', errText)
            }
        } finally {
            setReadingParams(prev => ({ ...prev, [readKey]: false }))
        }
    }

    // Read all parameters on the selected module
    async function handleReadAll() {
        if (!selectedModule || !ip || parameters.length === 0) return
        setReadingAll(true)
        setTabError(null)
        const errors: string[] = []
        const nextVals = { ...paramValues }

        for (const p of parameters) {
            try {
                const r = await fetch(`/io/module/${selectedModule.Adress}/parameter/${p.parameter_id}?ip_address=${encodeURIComponent(ip)}`)
                const d = await r.json()
                if (r.ok) {
                    if (Array.isArray(d.value)) {
                        for (let i = 0; i < p.num_instances; i++) {
                            nextVals[`${p.parameter_id}_${i}`] = d.value[i] !== undefined ? String(d.value[i]) : ''
                            setFeedback(`${p.parameter_id}_${i}`, 'success', '✓ Read')
                        }
                    } else {
                        nextVals[`${p.parameter_id}_0`] = String(d.value)
                        setFeedback(`${p.parameter_id}_0`, 'success', '✓ Read')
                    }
                } else {
                    const errText = d.detail ?? 'error'
                    errors.push(`${p.name}: ${errText}`)
                    for (let i = 0; i < p.num_instances; i++) {
                        setFeedback(`${p.parameter_id}_${i}`, 'error', errText)
                    }
                }
            } catch (err) {
                const errText = (err as Error).message
                errors.push(`${p.name}: ${errText}`)
                for (let i = 0; i < p.num_instances; i++) {
                    setFeedback(`${p.parameter_id}_${i}`, 'error', errText)
                }
            }
        }

        setParamValues(nextVals)
        if (errors.length > 0) {
            setTabError(`Some parameters failed to read:\n${errors.join('\n')}`)
        }
        setReadingAll(false)
    }

    // Write a specific parameter instance
    async function handleWriteParamInstance(paramId: number, instanceIdx: number) {
        if (!selectedModule || !ip) return
        const key = `${paramId}_${instanceIdx}`
        const val = paramValues[key]
        if (val === undefined || val.trim() === '') {
            setTabError('Please enter a value to write.')
            return
        }

        setWritingParams(prev => ({ ...prev, [key]: true }))
        setTabError(null)
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
                setFeedback(key, 'error', errText)
                setTabError(errText)
            } else {
                setParamValues(prev => ({ ...prev, [key]: d.value }))
                setFeedback(key, 'success', '✓ Written')
            }
        } catch (err) {
            const errText = (err as Error).message
            setFeedback(key, 'error', errText)
            setTabError(errText)
        } finally {
            setWritingParams(prev => ({ ...prev, [key]: false }))
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
            <Box sx={{ px: 3, py: 1, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SettingsIcon fontSize="small" /> Raw Mode
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Click any module in the topology map above to inspect and control it here.
                </Typography>
            </Box>

            {tabError && (
                <Box sx={{ px: 3, pt: 2 }}>
                    <Alert severity="error" onClose={() => setTabError(null)} sx={{ fontSize: '0.75rem' }}>
                        {tabError}
                    </Alert>
                </Box>
            )}

            <Box sx={{ flex: 1, overflowY: 'auto', p: 3, background: '#fafafa' }}>
                {!selectedModule ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', py: 8 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                            Click a module in the topology map above to inspect parameters and control outputs.
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'flex-start' }}>
                        {/* Actuation Control Section */}
                        <Paper variant="outlined" sx={{ p: 2.5, background: '#fff', width: { xs: '100%', md: '35%' }, flexShrink: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, fontSize: '0.8rem', color: '#1976d2' }}>
                                Output Control Panel
                            </Typography>
                            <ModuleActuatePanel
                                module={selectedModule}
                                ip={ip}
                                mountedValves={selectedModule.MountedValves}
                            />
                        </Paper>

                        {/* Parameters Section */}
                        <Paper variant="outlined" sx={{ p: 2.5, background: '#fff', flex: 1 }}>
                            <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#1976d2', flex: 1 }}>
                                    Device Parameters
                                </Typography>
                                {parameters.length > 0 && (
                                    <TooltipButton
                                        size="small"
                                        variant="outlined"
                                        onClick={handleReadAll}
                                        disabled={readingAll || !ip}
                                        tooltip="Read current values of all parameters"
                                        icon={readingAll ? <CircularProgress size={14} /> : <RefreshIcon />}
                                        sx={{ fontSize: '0.68rem', py: 0.2 }}
                                    >
                                        Read All
                                    </TooltipButton>
                                )}
                            </Stack>

                            {loadingParams ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : parameters.length === 0 ? (
                                <Alert severity="info" sx={{ fontSize: '0.75rem', py: 0 }}>
                                    No parameters metadata retrieved from this module type.
                                </Alert>
                            ) : (
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600, overflowY: 'auto' }}>
                                    <Table size="small">
                                        <TableHead sx={{ background: '#f5f5f5' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Parameter Name</TableCell>
                                                <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Value</TableCell>
                                                <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {parameters.map(p => {
                                                const hasMultiple = p.num_instances > 1
                                                const isExpanded = !!expandedParams[p.parameter_id]
                                                const val0 = paramValues[`${p.parameter_id}_0`] ?? ''
                                                const isReading0 = readingParams[`${p.parameter_id}_0`] === true
                                                const isWriting0 = writingParams[`${p.parameter_id}_0`] === true
                                                const isReadingAllP = readingParams[`${p.parameter_id}_all`] === true
                                                const fb0 = paramFeedback[`${p.parameter_id}_0`]

                                                return (
                                                    <Fragment key={p.parameter_id}>
                                                        {/* Main Parameter Row */}
                                                        <TableRow sx={{ '& > *': { borderBottom: hasMultiple ? 'none' : undefined } }}>
                                                            <TableCell sx={{ py: 1 }}>
                                                                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                                                    {hasMultiple && (
                                                                        <IconButton size="small" onClick={() => toggleExpand(p.parameter_id)}>
                                                                            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                                                                        </IconButton>
                                                                    )}
                                                                    <Box>
                                                                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>
                                                                            {p.name}
                                                                        </Typography>
                                                                        <Typography sx={{ fontSize: '0.62rem', color: '#888' }}>
                                                                            ID: {p.parameter_id} · Type: {p.data_type} {p.unit ? `· Unit: ${p.unit}` : ''}
                                                                            {hasMultiple ? ` · [${p.num_instances} channels]` : ''}
                                                                        </Typography>
                                                                    </Box>
                                                                </Stack>
                                                            </TableCell>
                                                            <TableCell sx={{ py: 1, minWidth: 140 }}>
                                                                {hasMultiple ? (
                                                                    <Typography sx={{ fontSize: '0.68rem', color: '#666', fontStyle: 'italic' }}>
                                                                        Expand to configure channels
                                                                    </Typography>
                                                                ) : p.enums ? (
                                                                    <Select
                                                                        size="small"
                                                                        value={val0}
                                                                        onChange={e => setParamValues(prev => ({ ...prev, [`${p.parameter_id}_0`]: e.target.value }))}
                                                                        sx={{ fontSize: '0.72rem', height: 28, width: '100%' }}
                                                                        displayEmpty
                                                                    >
                                                                        <MenuItem value="" disabled sx={{ fontSize: '0.72rem' }}>
                                                                            Select...
                                                                        </MenuItem>
                                                                        {p.enums.map(enumName => (
                                                                            <MenuItem key={enumName} value={enumName} sx={{ fontSize: '0.72rem' }}>
                                                                                {enumName}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                ) : (
                                                                    <TextField
                                                                        size="small"
                                                                        placeholder="Value..."
                                                                        value={val0}
                                                                        onChange={e => setParamValues(prev => ({ ...prev, [`${p.parameter_id}_0`]: e.target.value }))}
                                                                        sx={{ '& input': { fontSize: '0.72rem', py: 0.5, px: 1 } }}
                                                                        fullWidth
                                                                    />
                                                                )}
                                                                {fb0 && (
                                                                    <Typography sx={{
                                                                        fontSize: '0.62rem', mt: 0.5,
                                                                        color: fb0.severity === 'success' ? '#2e7d32' : '#d32f2f',
                                                                        fontWeight: 600
                                                                    }}>
                                                                        {fb0.text}
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ py: 1, whiteSpace: 'nowrap' }}>
                                                                {hasMultiple ? (
                                                                    <TooltipButton
                                                                        size="small"
                                                                        variant="outlined"
                                                                        onClick={() => handleReadParamAllInstances(p.parameter_id, p.num_instances)}
                                                                        disabled={isReadingAllP || !ip}
                                                                        tooltip="Read all channel instances in one call"
                                                                        icon={isReadingAllP ? <CircularProgress size={12} /> : undefined}
                                                                        sx={{ fontSize: '0.65rem', minWidth: 70, py: 0.4 }}
                                                                    >
                                                                        Read All
                                                                    </TooltipButton>
                                                                ) : (
                                                                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                                                        <TooltipButton
                                                                            size="small"
                                                                            variant="text"
                                                                            onClick={() => handleReadParamInstance(p.parameter_id, 0)}
                                                                            disabled={isReading0 || isWriting0 || !ip}
                                                                            tooltip="Read parameter from device"
                                                                            icon={isReading0 ? <CircularProgress size={12} /> : undefined}
                                                                            sx={{ fontSize: '0.65rem', minWidth: 40, p: 0.5 }}
                                                                        >
                                                                            Read
                                                                        </TooltipButton>
                                                                        {p.is_writable && (
                                                                            <TooltipButton
                                                                                size="small"
                                                                                variant="contained"
                                                                                color="primary"
                                                                                onClick={() => handleWriteParamInstance(p.parameter_id, 0)}
                                                                                disabled={isReading0 || isWriting0 || !ip || val0 === ''}
                                                                                tooltip="Write parameter to device"
                                                                                icon={isWriting0 ? <CircularProgress size={12} color="inherit" /> : undefined}
                                                                                sx={{ fontSize: '0.65rem', minWidth: 40, p: 0.5 }}
                                                                            >
                                                                                Write
                                                                            </TooltipButton>
                                                                        )}
                                                                    </Stack>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>

                                                        {/* Expanded Collapsible Channels Table */}
                                                        {hasMultiple && (
                                                            <TableRow>
                                                                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={3}>
                                                                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                                        <Box sx={{ margin: 1, pl: 4, pb: 1, borderLeft: '2px dashed #e0e0e0' }}>
                                                                            <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block', color: '#666', fontSize: '0.65rem' }}>
                                                                                Channel Parameters
                                                                            </Typography>
                                                                            <Table size="small">
                                                                                <TableBody>
                                                                                    {Array.from({ length: p.num_instances }, (_, idx) => {
                                                                                        const instanceIdx = p.first_index + idx
                                                                                        const instKey = `${p.parameter_id}_${idx}`
                                                                                        const val = paramValues[instKey] ?? ''
                                                                                        const isReading = readingParams[instKey] === true
                                                                                        const isWriting = writingParams[instKey] === true
                                                                                        const fb = paramFeedback[instKey]

                                                                                        return (
                                                                                            <TableRow key={instanceIdx} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                                                                <TableCell sx={{ py: 0.5, fontSize: '0.7rem', color: '#555' }}>
                                                                                                    Channel {instanceIdx}
                                                                                                </TableCell>
                                                                                                <TableCell sx={{ py: 0.5, minWidth: 120 }}>
                                                                                                    {p.enums ? (
                                                                                                        <Select
                                                                                                            size="small"
                                                                                                            value={val}
                                                                                                            onChange={e => setParamValues(prev => ({ ...prev, [instKey]: e.target.value }))}
                                                                                                            sx={{ fontSize: '0.7rem', height: 26, width: '100%' }}
                                                                                                            displayEmpty
                                                                                                        >
                                                                                                            <MenuItem value="" disabled sx={{ fontSize: '0.7rem' }}>
                                                                                                                Select...
                                                                                                            </MenuItem>
                                                                                                            {p.enums.map(enumName => (
                                                                                                                <MenuItem key={enumName} value={enumName} sx={{ fontSize: '0.7rem' }}>
                                                                                                                    {enumName}
                                                                                                                </MenuItem>
                                                                                                            ))}
                                                                                                        </Select>
                                                                                                    ) : (
                                                                                                        <TextField
                                                                                                            size="small"
                                                                                                            placeholder="Value..."
                                                                                                            value={val}
                                                                                                            onChange={e => setParamValues(prev => ({ ...prev, [instKey]: e.target.value }))}
                                                                                                            sx={{ '& input': { fontSize: '0.7rem', py: 0.35, px: 0.8 } }}
                                                                                                            fullWidth
                                                                                                        />
                                                                                                    )}
                                                                                                    {fb && (
                                                                                                        <Typography sx={{
                                                                                                            fontSize: '0.62rem', mt: 0.25,
                                                                                                            color: fb.severity === 'success' ? '#2e7d32' : '#d32f2f',
                                                                                                            fontWeight: 600
                                                                                                        }}>
                                                                                                            {fb.text}
                                                                                                        </Typography>
                                                                                                    )}
                                                                                                </TableCell>
                                                                                                <TableCell align="right" sx={{ py: 0.5, whiteSpace: 'nowrap' }}>
                                                                                                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                                                                                                        <TooltipButton
                                                                                                            size="small"
                                                                                                            variant="text"
                                                                                                            onClick={() => handleReadParamInstance(p.parameter_id, idx)}
                                                                                                            disabled={isReading || isWriting || !ip}
                                                                                                            tooltip="Read this specific channel value"
                                                                                                            icon={isReading ? <CircularProgress size={10} /> : undefined}
                                                                                                            sx={{ fontSize: '0.62rem', minWidth: 32, p: 0.3 }}
                                                                                                        >
                                                                                                            Read
                                                                                                        </TooltipButton>
                                                                                                        {p.is_writable && (
                                                                                                            <TooltipButton
                                                                                                                size="small"
                                                                                                                variant="contained"
                                                                                                                color="primary"
                                                                                                                onClick={() => handleWriteParamInstance(p.parameter_id, idx)}
                                                                                                                disabled={isReading || isWriting || !ip || val === ''}
                                                                                                                tooltip="Write this specific channel value"
                                                                                                                icon={isWriting ? <CircularProgress size={10} color="inherit" /> : undefined}
                                                                                                                sx={{ fontSize: '0.62rem', minWidth: 32, p: 0.3 }}
                                                                                                            >
                                                                                                                Write
                                                                                                            </TooltipButton>
                                                                                                        )}
                                                                                                    </Stack>
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        )
                                                                                    })}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </Box>
                                                                    </Collapse>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </Fragment>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    </Box>
                )}
            </Box>
        </Box>
    )
}
