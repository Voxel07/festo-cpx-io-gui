import { Box, Typography, Chip, Divider, Stack, TextField, Alert } from '@mui/material'
import CableIcon from '@mui/icons-material/Cable'
import TimelineIcon from '@mui/icons-material/Timeline'
import PowerIcon from '@mui/icons-material/Power'
import SaveIcon from '@mui/icons-material/Save'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent'
import { TooltipButton } from './TooltipButton'

interface ConnectionsToolbarProps {
    ioCount: number
    showCables: boolean
    onToggleCables: () => void
    wiringDisplay: 'all' | 'selected' | 'none'
    onWiringDisplayChange: (display: 'all' | 'selected' | 'none') => void
    straightWires: boolean
    onToggleStraightWires: () => void
    showPsConfig: boolean
    onTogglePsConfig: () => void
    savePath: string
    onSavePathChange: (path: string) => void
    onSave: () => void
    loadPath: string
    onLoadPathChange: (path: string) => void
    onLoad: () => void
    onClear: () => void
    showTestPanel: boolean
    onToggleTestPanel: () => void
    statusMsg: { text: string; severity: 'success' | 'error' } | null
    onStatusMsgClose: () => void
    psComPort: string
    onPsComPortChange: (v: string) => void
    psIpAddr: string
    onPsIpAddrChange: (v: string) => void
    psPlChannel: string
    onPsPlChannelChange: (v: string) => void
    psPsChannel: string
    onPsPsChannelChange: (v: string) => void
}

export default function ConnectionsToolbar({
    ioCount,
    showCables,
    onToggleCables,
    wiringDisplay,
    onWiringDisplayChange,
    straightWires,
    onToggleStraightWires,
    showPsConfig,
    onTogglePsConfig,
    savePath,
    onSavePathChange,
    onSave,
    loadPath,
    onLoadPathChange,
    onLoad,
    onClear,
    showTestPanel,
    onToggleTestPanel,
    statusMsg,
    onStatusMsgClose,
    psComPort,
    onPsComPortChange,
    psIpAddr,
    onPsIpAddrChange,
    psPlChannel,
    onPsPlChannelChange,
    psPsChannel,
    onPsPsChannelChange,
}: ConnectionsToolbarProps) {
    return (
        <>
            {/* ── Top Controls Bar ─────────────────────────────────── */}
            <Box sx={{
                background: '#fff',
                borderBottom: '1px solid #e0e0e0',
                px: 2, py: 0.75,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                flexShrink: 0,
            }}>
                <Typography sx={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#e65100', whiteSpace: 'nowrap' }}>
                    <SettingsInputComponentIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> I/O Connection Editor
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
                    variant={showCables ? 'contained' : 'outlined'}
                    color="inherit"
                    onClick={onToggleCables}
                    tooltip={showCables ? 'Hide backplane connections and AP cables' : 'Show backplane connections and AP cables'}
                    icon={<CableIcon />}
                    sx={{
                        fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap',
                        color: showCables ? '#fff' : '#546e7a',
                        background: showCables ? '#546e7a' : 'transparent',
                        borderColor: '#546e7a',
                        '&:hover': { borderColor: '#455a64', background: showCables ? '#455a64' : 'rgba(84,110,122,0.08)' },
                    }}
                >
                    {showCables ? 'Hide AP Cables' : 'Show AP Cables'}
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Wiring display mode selection */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                        Wiring View:
                    </Typography>
                    <TooltipButton
                        size="small"
                        variant={wiringDisplay === 'all' ? 'contained' : 'outlined'}
                        onClick={() => onWiringDisplayChange('all')}
                        tooltip="Show all I/O wiring lines"
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 1, minWidth: 40 }}
                    >
                        All
                    </TooltipButton>
                    <TooltipButton
                        size="small"
                        variant={wiringDisplay === 'selected' ? 'contained' : 'outlined'}
                        color="warning"
                        onClick={() => onWiringDisplayChange('selected')}
                        tooltip="Only show wiring connected to the currently selected module"
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 1, minWidth: 80 }}
                    >
                        Selected Only
                    </TooltipButton>
                    <TooltipButton
                        size="small"
                        variant={wiringDisplay === 'none' ? 'contained' : 'outlined'}
                        onClick={() => onWiringDisplayChange('none')}
                        tooltip="Hide all I/O wiring lines"
                        sx={{ fontSize: '0.68rem', py: 0.2, px: 1, minWidth: 50 }}
                    >
                        Hidden
                    </TooltipButton>
                </Stack>

                <Divider orientation="vertical" flexItem />

                {/* Wire routing style */}
                <TooltipButton
                    size="small"
                    variant={straightWires ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={onToggleStraightWires}
                    tooltip={straightWires ? 'Use smart right-angle routing' : 'Use point-to-point straight line routing'}
                    icon={<TimelineIcon />}
                    sx={{ fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap' }}
                >
                    {straightWires ? 'Straight Wires' : 'Smart Stepped Wires'}
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Power Supply toggle */}
                <TooltipButton
                    size="small"
                    variant={showPsConfig ? 'contained' : 'outlined'}
                    onClick={onTogglePsConfig}
                    tooltip={showPsConfig ? 'Hide power supply configuration panel' : 'Show power supply configuration panel'}
                    icon={<PowerIcon />}
                    sx={{
                        fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap',
                        color: showPsConfig ? '#fff' : '#673ab7',
                        background: showPsConfig ? '#673ab7' : 'transparent',
                        borderColor: '#673ab7',
                        '&:hover': { borderColor: '#5e35b1', background: showPsConfig ? '#5e35b1' : 'rgba(103,58,183,0.08)' },
                    }}
                >
                    Power Supply
                </TooltipButton>

                <Divider orientation="vertical" flexItem />

                {/* Save */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                        Save:
                    </Typography>
                    <TextField
                        size="small" value={savePath}
                        onChange={e => onSavePathChange(e.target.value)}
                        placeholder="connections.jsonc"
                        sx={{ width: 180 }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.72rem', padding: '4px 8px' } } }}
                    />
                    <TooltipButton
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={onSave}
                        tooltip="Save wiring and configuration to the JSON file"
                        icon={<SaveIcon />}
                        sx={{ fontSize: '0.72rem', py: 0.4, minWidth: 56, whiteSpace: 'nowrap' }}
                    >
                        Save
                    </TooltipButton>
                </Stack>

                {/* Load */}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                        Load:
                    </Typography>
                    <TextField
                        size="small" value={loadPath}
                        onChange={e => onLoadPathChange(e.target.value)}
                        placeholder="connections.jsonc"
                        sx={{ width: 180 }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.72rem', padding: '4px 8px' } } }}
                    />
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={onLoad}
                        tooltip="Load wiring and configuration from the JSON file"
                        icon={<FolderOpenIcon />}
                        sx={{ fontSize: '0.72rem', py: 0.4, minWidth: 56, whiteSpace: 'nowrap' }}
                    >
                        Load
                    </TooltipButton>
                </Stack>

                {/* Clear */}
                {ioCount > 0 && (
                    <TooltipButton
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={onClear}
                        tooltip="Delete all drawn I/O wires"
                        icon={<DeleteIcon />}
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
                            variant={showTestPanel ? 'contained' : 'outlined'}
                            color={showTestPanel ? 'warning' : 'inherit'}
                            onClick={onToggleTestPanel}
                            tooltip={showTestPanel ? 'Hide interactive wire test panel' : 'Open interactive wire test panel'}
                            icon={<PlayArrowIcon />}
                            sx={{
                                fontSize: '0.72rem', py: 0.3, px: 1, whiteSpace: 'nowrap',
                                ...(showTestPanel ? {} : { color: '#546e7a', borderColor: '#546e7a' }),
                            }}
                        >
                            Test Wiring
                        </TooltipButton>
                    </>
                )}

                {/* Status message */}
                {statusMsg && (
                    <Alert
                        severity={statusMsg.severity}
                        onClose={onStatusMsgClose}
                        sx={{ py: 0, fontSize: '0.72rem', '& .MuiAlert-message': { wordBreak: 'break-all' } }}
                    >
                        {statusMsg.text}
                    </Alert>
                )}
            </Box>

            {showPsConfig && (
                <Box sx={{
                    background: '#f9f9f9',
                    borderBottom: '1px solid #e0e0e0',
                    px: 3, py: 1.5,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#333' }}>
                        <PowerIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> Power Supply Configuration:
                    </Typography>
                    <TextField
                        label="COM Port"
                        size="small"
                        value={psComPort}
                        onChange={e => onPsComPortChange(e.target.value)}
                        placeholder="e.g. COM3"
                        sx={{ width: 120, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <TextField
                        label="IP Address"
                        size="small"
                        value={psIpAddr}
                        onChange={e => onPsIpAddrChange(e.target.value)}
                        placeholder="e.g. 192.168.0.20"
                        sx={{ width: 150, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <TextField
                        label="PL Channel"
                        size="small"
                        type="number"
                        value={psPlChannel}
                        onChange={e => onPsPlChannelChange(e.target.value)}
                        placeholder="1"
                        sx={{ width: 100, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <TextField
                        label="PS Channel"
                        size="small"
                        type="number"
                        value={psPsChannel}
                        onChange={e => onPsPsChannelChange(e.target.value)}
                        placeholder="2"
                        sx={{ width: 100, background: '#fff' }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.75rem', padding: '6px 10px' } } }}
                        InputLabelProps={{ style: { fontSize: '0.75rem' } }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        (Only ComPort or IP addr should be populated to connect)
                    </Typography>
                </Box>
            )}

            {/* ── Legend Bar ───────────────────────────────────────── */}
            <Box sx={{
                background: '#f8f9fa',
                borderBottom: '1px solid #e0e0e0',
                px: 2, py: 0.5,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2.5,
                flexWrap: 'wrap',
                flexShrink: 0,
            }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
                    Ports:
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#1565c0', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Input (blue)
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#2e7d32', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Output (green)
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#ff9800', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Bidirectional (orange)
                </Typography>
                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>
                    Drag port to connect · Drag wire endpoint to reconnect
                </Typography>
            </Box>
        </>
    )
}
