import { Fragment } from 'react'
import {
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
    Stack, Box, Typography, Select, MenuItem, TextField, Collapse, IconButton, CircularProgress
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
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

interface TopologyModule {
    Adress: number
    Name: string
    Type: string
    Modulecode: number
    NumOfInputs: number
    NumOfOutputs: number
    NumOfInOuts: number
    MountedValves?: number[]
    ProductKey?: string
}

interface ParametersTableProps {
    parameters: ParameterMetadata[]
    paramValues: Record<string, string>
    loadingParams: boolean
    readingParams: Record<string, boolean>
    writingParams: Record<string, boolean>
    expandedParams: Record<number, boolean>
    paramFeedback: Record<string, { severity: 'success' | 'error'; text: string }>
    readingAll: boolean
    ip: string
    selectedModule: TopologyModule
    onReadParamInstance: (paramId: number, instanceIdx: number) => void
    onReadParamAllInstances: (paramId: number, numInstances: number) => void
    onWriteParamInstance: (paramId: number, instanceIdx: number) => void
    onReadAll: () => void
    onToggleExpand: (paramId: number) => void
    onValueChange: (key: string, value: string) => void
}

export default function ParametersTable({
    parameters,
    paramValues,
    loadingParams,
    readingParams,
    writingParams,
    expandedParams,
    paramFeedback,
    readingAll,
    ip,
    selectedModule,
    onReadParamInstance,
    onReadParamAllInstances,
    onWriteParamInstance,
    onReadAll,
    onToggleExpand,
    onValueChange,
}: ParametersTableProps) {
    return (
        <>
            <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#1976d2', flex: 1 }}>
                    Device Parameters
                </Typography>
                {parameters.length > 0 && (
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        onClick={onReadAll}
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
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No parameters metadata retrieved from this module type.
                </Typography>
            ) : (
                <TableContainer sx={{ maxHeight: 600, overflowY: 'auto' }}>
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
                                                        <IconButton size="small" onClick={() => onToggleExpand(p.parameter_id)}>
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
                                                        onChange={e => onValueChange(`${p.parameter_id}_0`, e.target.value)}
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
                                                        onChange={e => onValueChange(`${p.parameter_id}_0`, e.target.value)}
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
                                                        onClick={() => onReadParamAllInstances(p.parameter_id, p.num_instances)}
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
                                                            onClick={() => onReadParamInstance(p.parameter_id, 0)}
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
                                                                onClick={() => onWriteParamInstance(p.parameter_id, 0)}
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
                                                                                            onChange={e => onValueChange(instKey, e.target.value)}
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
                                                                                            onChange={e => onValueChange(instKey, e.target.value)}
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
                                                                                            onClick={() => onReadParamInstance(p.parameter_id, idx)}
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
                                                                                                onClick={() => onWriteParamInstance(p.parameter_id, idx)}
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
        </>
    )
}
