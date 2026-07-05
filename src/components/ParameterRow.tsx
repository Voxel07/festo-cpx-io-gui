import { Fragment } from 'react'
import { TableRow, TableCell, Stack, Box, Typography, Select, MenuItem, TextField, Collapse, IconButton, CircularProgress, Checkbox, Divider, Table, TableBody } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { TooltipButton } from './TooltipButton'
import type { ParameterMetadata } from './ParametersTable'

interface Props {
    p: ParameterMetadata
    paramValues: Record<string, string>
    readingParams: Record<string, boolean>
    writingParams: Record<string, boolean>
    writingAllParams: Record<string, boolean>
    isExpanded: boolean
    ip: string
    onReadParamInstance: (paramId: number, instanceIdx: number) => void
    onReadParamAllInstances: (paramId: number, numInstances: number) => void
    onWriteParamInstance: (paramId: number, instanceIdx: number) => void
    onWriteParamAllInstances: (paramId: number, numInstances: number) => void
    onToggleExpand: (paramId: number) => void
    onValueChange: (key: string, value: string) => void
}

export default function ParameterRow({
    p, paramValues, readingParams, writingParams, writingAllParams, isExpanded, ip,
    onReadParamInstance, onReadParamAllInstances, onWriteParamInstance, onWriteParamAllInstances,
    onToggleExpand, onValueChange
}: Props) {
    const hasMultiple = p.num_instances > 1
    const val0 = paramValues[`${p.parameter_id}_0`] ?? ''
    const isReading0 = readingParams[`${p.parameter_id}_0`] === true
    const isWriting0 = writingParams[`${p.parameter_id}_0`] === true
    const isReadingAllP = readingParams[`${p.parameter_id}_all`] === true
    const bulkKey = `${p.parameter_id}_bulk`
    const bulkVal = paramValues[bulkKey] ?? ''
    const isWritingAllP = writingAllParams[`${p.parameter_id}_writeall`] === true

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
                            <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
                                ID: {p.parameter_id} · Type: {p.data_type} {p.unit ? `· Unit: ${p.unit}` : ''}
                                {hasMultiple ? ` · [${p.num_instances} channels]` : ''}
                            </Typography>
                        </Box>
                    </Stack>
                </TableCell>
                <TableCell sx={{ py: 1, minWidth: 140 }}>
                    {hasMultiple ? (
                        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontStyle: 'italic' }}>
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
                    ) : p.data_type === 'BOOL' ? (
                        <Checkbox
                            size="small"
                            checked={val0 === 'true' || val0 === '1'}
                            onChange={e => onValueChange(`${p.parameter_id}_0`, e.target.checked ? 'true' : 'false')}
                            sx={{ p: 0 }}
                        />
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
                            <Box sx={{ margin: 1, pl: 4, pb: 1, borderLeft: 2, borderColor: 'divider', borderStyle: 'dashed' }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}>
                                    Channel Parameters
                                </Typography>
                                {p.is_writable && (
                                    <Box sx={{ mb: 1.5, p: 1, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.08)' : '#f0f7ff', borderRadius: 1, border: 1, borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.5)' : '#90caf9', borderStyle: 'dashed' }}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                            <Typography sx={{ fontSize: '0.62rem', color: '#1976d2', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Write all:
                                            </Typography>
                                            {p.enums ? (
                                                <Select
                                                    size="small"
                                                    value={bulkVal}
                                                    onChange={e => onValueChange(bulkKey, e.target.value)}
                                                    sx={{ fontSize: '0.68rem', height: 26, flex: 1 }}
                                                    displayEmpty
                                                >
                                                    <MenuItem value="" disabled sx={{ fontSize: '0.68rem' }}>
                                                        Select...
                                                    </MenuItem>
                                                    {p.enums.map(enumName => (
                                                        <MenuItem key={enumName} value={enumName} sx={{ fontSize: '0.68rem' }}>
                                                            {enumName}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            ) : p.data_type === 'BOOL' ? (
                                                <Checkbox
                                                    size="small"
                                                    checked={bulkVal === 'true' || bulkVal === '1'}
                                                    onChange={e => onValueChange(bulkKey, e.target.checked ? 'true' : 'false')}
                                                    sx={{ p: 0 }}
                                                />
                                            ) : (
                                                <TextField
                                                    size="small"
                                                    placeholder="Value..."
                                                    value={bulkVal}
                                                    onChange={e => onValueChange(bulkKey, e.target.value)}
                                                    sx={{ '& input': { fontSize: '0.68rem', py: 0.3, px: 0.8 }, flex: 1 }}
                                                />
                                            )}
                                            <TooltipButton
                                                size="small"
                                                variant="contained"
                                                color="secondary"
                                                onClick={() => onWriteParamAllInstances(p.parameter_id, p.num_instances)}
                                                disabled={isWritingAllP || !ip || bulkVal === ''}
                                                tooltip="Write this value to all channel instances"
                                                icon={isWritingAllP ? <CircularProgress size={10} color="inherit" /> : undefined}
                                                sx={{ fontSize: '0.62rem', minWidth: 32, p: 0.3, whiteSpace: 'nowrap' }}
                                            >
                                                Write All
                                            </TooltipButton>
                                        </Stack>
                                    </Box>
                                )}
                                <Divider sx={{ mb: 1 }} />
                                <Table size="small">
                                    <TableBody>
                                        {Array.from({ length: p.num_instances }, (_, idx) => {
                                            const instanceIdx = p.first_index + idx
                                            const instKey = `${p.parameter_id}_${idx}`
                                            const val = paramValues[instKey] ?? ''
                                            const isReading = readingParams[instKey] === true
                                            const isWriting = writingParams[instKey] === true

                                            return (
                                                <TableRow key={instanceIdx} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                    <TableCell sx={{ py: 0.5, fontSize: '0.7rem', color: 'text.secondary' }}>
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
                                                        ) : p.data_type === 'BOOL' ? (
                                                            <Checkbox
                                                                size="small"
                                                                checked={val === 'true' || val === '1'}
                                                                onChange={e => onValueChange(instKey, e.target.checked ? 'true' : 'false')}
                                                                sx={{ p: 0 }}
                                                            />
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
}
