import { Box, Typography, Chip, Divider, Stack, TextField } from '@mui/material'
import CableIcon from '@mui/icons-material/Cable'
import TimelineIcon from '@mui/icons-material/Timeline'
import PowerIcon from '@mui/icons-material/Power'
import SaveIcon from '@mui/icons-material/Save'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent'
import BugReportIcon from '@mui/icons-material/BugReport'
import { TooltipButton } from './TooltipButton'

interface ConnectionsToolbarProps {
    ioCount: number
    showCables: boolean
    onToggleCables: () => void
    showWires: boolean
    onToggleWires: () => void
    connectionMode: 'port' | 'channel'
    onConnectionModeChange: (mode: 'port' | 'channel') => void
    showPsConfig: boolean
    onTogglePsConfig: () => void
    onSave: () => void
    onLoad: () => void
    onClear: () => void
    showTestPanel: boolean
    onToggleTestPanel: () => void
    psComPort: string
    onPsComPortChange: (v: string) => void
    psIpAddr: string
    onPsIpAddrChange: (v: string) => void
    psPlChannel: string
    onPsPlChannelChange: (v: string) => void
    psPsChannel: string
    onPsPsChannelChange: (v: string) => void
    showDebug: boolean
    onToggleDebug: () => void
}

export default function ConnectionsToolbar({
    ioCount,
    showCables,
    onToggleCables,
    showWires,
    onToggleWires,
    connectionMode,
    onConnectionModeChange,
    showPsConfig,
    onTogglePsConfig,
    onSave,
    onLoad,
    onClear,
    showTestPanel,
    onToggleTestPanel,
    psComPort,
    onPsComPortChange,
    psIpAddr,
    onPsIpAddrChange,
    psPlChannel,
    onPsPlChannelChange,
    psPsChannel,
    onPsPsChannelChange,
    showDebug,
    onToggleDebug,
}: ConnectionsToolbarProps) {
    return (
        <>
            {/* ── Top Controls Bar ─────────────────────────────────── */}
            <Box sx={{
                bgcolor: 'background.paper',
                borderBottom: 1, borderColor: 'divider',
                px: 2, py: 0.75,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                flexShrink: 0,
            }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    I/O Connection Editor
                </Typography>

                {ioCount > 0 && (
                    <Chip
                        label={`${ioCount} wire${ioCount !== 1 ? 's' : ''}`}
                        size="small" color="warning"
                        sx={{ height: 22, fontSize: '0.72rem' }}
                    />
                )}

                <Divider orientation="vertical" flexItem />

                {/* Cable visibility toggle */}
                <TooltipButton
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={onToggleCables}
                    tooltip={showCables ? 'Hide backplane connections and AP cables' : 'Show backplane connections and AP cables'}
                    icon={<CableIcon />}
                    sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                >
                    {showCables ? 'Hide AP Cables' : 'Show AP Cables'}
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Wiring display mode selection */}
                <TooltipButton
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={onToggleWires}
                    tooltip={showWires ? 'Hide I/O wiring lines' : 'Show I/O wiring lines'}
                    icon={<TimelineIcon />}
                    sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                >
                    {showWires ? 'Hide I/O Wires' : 'Show I/O Wires'}
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Connection Mode toggle */}
                <TooltipButton
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={() => onConnectionModeChange(connectionMode === 'port' ? 'channel' : 'port')}
                    tooltip={connectionMode === 'channel' ? 'Channel Mode: connect specific channels within a port' : 'Port Mode: connect all channels on a port simultaneously'}
                    icon={<SettingsInputComponentIcon />}
                    sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                >
                    {connectionMode === 'channel' ? 'Mode: Channel' : 'Mode: Port'}
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Power Supply toggle */}
                <TooltipButton
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={onTogglePsConfig}
                    tooltip={showPsConfig ? 'Hide power supply configuration panel' : 'Show power supply configuration panel'}
                    icon={<PowerIcon />}
                    sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                >
                    Power Supply
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Load / Save */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <TooltipButton
                        size="small"
                        variant="text"
                        color="inherit"
                        onClick={onLoad}
                        tooltip="Load wiring and configuration from the JSON file"
                        icon={<FolderOpenIcon />}
                        sx={{ fontSize: '0.72rem', py: 0.4, minWidth: 56, whiteSpace: 'nowrap' }}
                    >
                        Load
                    </TooltipButton>
                    <TooltipButton
                        size="small"
                        variant="text"
                        color="inherit"
                        onClick={onSave}
                        tooltip="Save wiring and configuration to the JSON file"
                        icon={<SaveIcon color="success" />}
                        sx={{ fontSize: '0.72rem', py: 0.4, minWidth: 56, whiteSpace: 'nowrap' }}
                    >
                        Save
                    </TooltipButton>
                </Stack>

                {/* Clear */}
                {ioCount > 0 && (
                    <TooltipButton
                        size="small"
                        variant="text"
                        color="inherit"
                        onClick={onClear}
                        tooltip="Delete all drawn I/O wires"
                        icon={<DeleteIcon color="error" />}
                        sx={{ fontSize: '0.72rem', py: 0.4, whiteSpace: 'nowrap' }}
                    >
                        Clear
                    </TooltipButton>
                )}

                {/* Test Wiring toggle */}
                {ioCount > 0 && (
                    <>
                        <Divider orientation="vertical" flexItem />
                        <TooltipButton
                            size="small"
                            variant="text"
                            color="inherit"
                            onClick={onToggleTestPanel}
                            tooltip={showTestPanel ? 'Hide interactive wire test panel' : 'Open interactive wire test panel'}
                            icon={<PlayArrowIcon />}
                            sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                        >
                            Test Wiring
                        </TooltipButton>
                    </>
                )}

                <Divider orientation="vertical" flexItem />
                
                {/* Debug toggle */}
                <TooltipButton
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={onToggleDebug}
                    tooltip={showDebug ? 'Hide debug panel' : 'Show debug panel'}
                    icon={<BugReportIcon />}
                    sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                >
                    Debug
                </TooltipButton>

                {/* Status message component removed, centralized through AlertsManager */}
            </Box>

            {showPsConfig && (
                <Box sx={{
                    bgcolor: 'action.hover',
                    borderBottom: 1, borderColor: 'divider',
                    px: 3, py: 1.5,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'text.primary' }}>
                        <PowerIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> Power Supply Configuration:
                    </Typography>
                    <TextField
                        label="COM Port"
                        size="small"
                        value={psComPort}
                        onChange={e => onPsComPortChange(e.target.value)}
                        placeholder="e.g. COM3"
                        disabled={psIpAddr.trim().length > 0}
                        sx={{ width: 120 }}
                        slotProps={{ inputLabel: { sx: { fontSize: '0.75rem' } } }}
                    />
                    <TextField
                        label="IP Address"
                        size="small"
                        value={psIpAddr}
                        onChange={e => onPsIpAddrChange(e.target.value)}
                        placeholder="e.g. 192.168.0.20"
                        disabled={psComPort.trim().length > 0}
                        sx={{ width: 150 }}
                        slotProps={{ inputLabel: { sx: { fontSize: '0.75rem' } } }}
                    />
                    <TextField
                        label="PL Channel"
                        size="small"
                        type="number"
                        value={psPlChannel}
                        onChange={e => onPsPlChannelChange(e.target.value)}
                        placeholder="1"
                        sx={{ width: 100 }}
                        slotProps={{ inputLabel: { sx: { fontSize: '0.75rem' } } }}
                    />
                    <TextField
                        label="PS Channel"
                        size="small"
                        type="number"
                        value={psPsChannel}
                        onChange={e => onPsPsChannelChange(e.target.value)}
                        placeholder="2"
                        sx={{ width: 100 }}
                        slotProps={{ inputLabel: { sx: { fontSize: '0.75rem' } } }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        (Only ComPort or IP addr should be populated to connect)
                    </Typography>
                </Box>
            )}

            {/* ── Legend Bar ───────────────────────────────────────── */}
            <Box sx={{
                bgcolor: 'action.hover',
                borderBottom: 1, borderColor: 'divider',
                px: 2, py: 0.5,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2.5,
                flexWrap: 'wrap',
                flexShrink: 0,
            }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap' }}>
                    Ports:
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'primary.main', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Input
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'success.main', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Output
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'warning.main', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Bidirectional
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    Drag port to connect · Drag wire endpoint to reconnect
                </Typography>
            </Box>
        </>
    )
}
