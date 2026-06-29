import { Box, Stack, Typography, Chip, CircularProgress, Tooltip } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import BoltIcon from '@mui/icons-material/Bolt'
import RefreshIcon from '@mui/icons-material/Refresh'
import { TooltipButton, TooltipIconButton } from './TooltipButton'

interface TestConn {
    id: string
    srcAddr: number
    srcCh: string
    tgtAddr: number
    tgtCh: string
    label: string
    srcCPP: number
    tgtCPP: number
}

interface WiringTestPanelProps {
    ip?: string
    testAllBusy: boolean
    testConns: TestConn[]
    outputStates: Record<string, boolean>
    testBusy: Set<string>
    testResults: Record<string, { values?: boolean[]; value: boolean | null; error?: string }>
    onTestAll: () => void
    onClearAllOutputs: () => void
    onToggleOutput: (conn: TestConn) => void
    onReadInput: (conn: TestConn) => void
}

export default function WiringTestPanel({
    ip,
    testAllBusy,
    testConns,
    outputStates,
    testBusy,
    testResults,
    onTestAll,
    onClearAllOutputs,
    onToggleOutput,
    onReadInput,
}: WiringTestPanelProps) {
    return (
        <Box sx={{
            width: 360, flexShrink: 0,
            borderLeft: '1px solid #e0e0e0',
            display: 'flex', flexDirection: 'column',
            background: '#fafafa', overflow: 'hidden',
        }}>
            {/* Panel header */}
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #e0e0e0', background: '#fff', flexShrink: 0 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 0.75, alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', flex: 1 }}>
                        Wire Test
                    </Typography>
                    {ip
                        ? <Chip label={ip} size="small" color="info" sx={{ fontSize: '0.62rem', maxWidth: 140, overflow: 'hidden' }} />
                        : <Chip label="No IP set" size="small" color="warning" sx={{ fontSize: '0.65rem' }} />
                    }
                    {testAllBusy && <CircularProgress size={16} />}
                </Stack>
                <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.75, lineHeight: 1.3 }}>
                    Toggle output ON to light the physical indicator.<br />
                    Input is read automatically. Output stays on until toggled off.
                </Typography>
                <Stack direction="row" spacing={0.5}>
                    <TooltipButton
                        size="small" variant="contained" color="warning"
                        onClick={onTestAll}
                        disabled={testAllBusy || !ip || testConns.length === 0}
                        tooltip="Pulse each output HIGH, read input, and set LOW sequentially"
                        icon={<PlayArrowIcon />}
                        sx={{ fontSize: '0.7rem', py: 0.3 }}
                    >
                        Test All (pulse)
                    </TooltipButton>
                    <TooltipButton
                        size="small" variant="outlined" color="error"
                        onClick={onClearAllOutputs}
                        disabled={!Object.values(outputStates).some(v => v)}
                        tooltip="Turn off all outputs immediately"
                        icon={<BoltIcon />}
                        sx={{ fontSize: '0.7rem', py: 0.3 }}
                    >
                        All OFF
                    </TooltipButton>
                </Stack>
            </Box>

            {/* Connection list */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {testConns.length === 0 && (
                    <Typography variant="caption" color="text.secondary"
                        sx={{ p: 2, textAlign: 'center', display: 'block' }}>
                        No I/O wires drawn yet.
                    </Typography>
                )}
                {testConns.map(conn => {
                    const isOn = outputStates[conn.id] ?? false
                    const isBusy = testBusy.has(conn.id)
                    const result = testResults[conn.id]
                    return (
                        <Box key={conn.id} sx={{
                            px: 1.5, py: 0.75,
                            borderBottom: '1px solid #f0f0f0',
                            background: isOn ? '#fff8e1' : '#fff',
                            transition: 'background 0.2s',
                        }}>
                            {/* Connection label */}
                            <Typography sx={{
                                fontSize: '0.7rem', fontFamily: 'monospace',
                                color: '#333', mb: 0.5, wordBreak: 'break-all',
                            }}>
                                {conn.label}
                            </Typography>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                {/* Output toggle */}
                                <TooltipButton
                                    size="small"
                                    variant={isOn ? 'contained' : 'outlined'}
                                    color={isOn ? 'error' : 'inherit'}
                                    onClick={() => onToggleOutput(conn)}
                                    disabled={isBusy || testAllBusy || !ip}
                                    tooltip={isOn ? 'Turn output OFF' : 'Turn output ON'}
                                    sx={{
                                        fontSize: '0.68rem', py: 0.2, px: 0.75,
                                        minWidth: 64, fontWeight: isOn ? 700 : 400,
                                        color: isOn ? undefined : '#546e7a',
                                        borderColor: isOn ? undefined : '#546e7a',
                                    }}
                                >
                                    {isBusy
                                        ? <CircularProgress size={12} color="inherit" />
                                        : isOn ? 'ON' : 'OFF'}
                                </TooltipButton>

                                {/* Input reading result: per-channel chips for M12, single chip otherwise */}
                                {result && !result.error && result.values && result.values.length > 1
                                    ? result.values.map((v, i) => (
                                        <Tooltip key={`${conn.id}-ch${i}`} title={`#${conn.tgtAddr}:${conn.tgtCh} channel ${i}`}>
                                            <Chip
                                                size="small"
                                                label={v ? `CH${i} HIGH` : `CH${i} LOW`}
                                                color={v ? 'success' : 'error'}
                                                sx={{ fontSize: '0.65rem', height: 20, cursor: 'default' }}
                                            />
                                        </Tooltip>
                                    ))
                                    : result && (
                                        <Tooltip title={result.error ?? `#${conn.tgtAddr}:${conn.tgtCh}`}>
                                            <Chip
                                                size="small"
                                                label={result.error ? 'ERR' : result.value ? 'HIGH' : 'LOW'}
                                                color={(result.error ? 'default' : result.value ? 'success' : 'error') as 'default' | 'success' | 'error'}
                                                sx={{ fontSize: '0.65rem', height: 20, cursor: 'default' }}
                                            />
                                        </Tooltip>
                                    )
                                }

                                {/* Re-read button when output is live */}
                                {isOn && !isBusy && (
                                    <TooltipIconButton
                                        size="small"
                                        onClick={() => onReadInput(conn)}
                                        tooltip={`Read #${conn.tgtAddr}:${conn.tgtCh}`}
                                        icon={<RefreshIcon sx={{ fontSize: '0.9rem' }} />}
                                        sx={{ py: 0, px: 0.5 }}
                                    />
                                )}

                                <Typography variant="caption"
                                    sx={{ color: '#bbb', fontSize: '0.6rem', ml: 'auto', whiteSpace: 'nowrap' }}>
                                    #{conn.srcAddr}:{conn.srcCh}→#{conn.tgtAddr}:{conn.tgtCh}
                                </Typography>
                            </Stack>
                        </Box>
                    )
                })}
            </Box>
        </Box>
    )
}
