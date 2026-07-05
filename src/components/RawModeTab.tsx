import { Box, Typography, Alert, Paper } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ModuleActuatePanel from './ModuleActuatePanel'
import type { Topology } from '../types'
import ParametersTable from './ParametersTable'
import { useRawMode } from '../hooks/useRawModeState'

interface Props {
    topology: Topology | null
    ip: string
    selectedModuleAddr: number | null
    onSelectModuleAddr: (addr: number | null) => void
}

export default function RawModeTab({ topology, ip, selectedModuleAddr }: Props) {
    // Lookup selected module
    const selectedModule = topology?.Topology?.find(m => m.Adress === selectedModuleAddr) || null

    const {
        state,
        dispatch,
        handleReadParamInstance,
        handleReadParamAllInstances,
        handleReadAll,
        handleWriteParamInstance,
        handleWriteParamAllInstances,
        toggleExpand,
        onValueChange
    } = useRawMode(selectedModule, ip, selectedModuleAddr)

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
