import {
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
    Stack, Box, Typography, CircularProgress
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { TooltipButton } from './TooltipButton'
import ParameterRow from './ParameterRow'

export interface ParameterMetadata {
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
    writingAllParams: Record<string, boolean>
    expandedParams: Record<number, boolean>
    readingAll: boolean
    ip: string
    selectedModule: TopologyModule
    onReadParamInstance: (paramId: number, instanceIdx: number) => void
    onReadParamAllInstances: (paramId: number, numInstances: number) => void
    onWriteParamInstance: (paramId: number, instanceIdx: number) => void
    onWriteParamAllInstances: (paramId: number, numInstances: number) => void
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
    writingAllParams,
    expandedParams,
    readingAll,
    ip,
    onReadParamInstance,
    onReadParamAllInstances,
    onWriteParamInstance,
    onWriteParamAllInstances,
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
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Parameter Name</TableCell>
                                <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Value</TableCell>
                                <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {parameters.map(p => (
                                <ParameterRow
                                    key={p.parameter_id}
                                    p={p}
                                    paramValues={paramValues}
                                    readingParams={readingParams}
                                    writingParams={writingParams}
                                    writingAllParams={writingAllParams}
                                    isExpanded={!!expandedParams[p.parameter_id]}
                                    ip={ip}
                                    onReadParamInstance={onReadParamInstance}
                                    onReadParamAllInstances={onReadParamAllInstances}
                                    onWriteParamInstance={onWriteParamInstance}
                                    onWriteParamAllInstances={onWriteParamAllInstances}
                                    onToggleExpand={onToggleExpand}
                                    onValueChange={onValueChange}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </>
    )
}
