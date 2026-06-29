import { Drawer, Stack, Typography, Chip, Divider, Box } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { TooltipIconButton } from './TooltipButton'

interface LogEntry {
    level: string
    message: string
    timestamp: string
}

interface RunRecord {
    id: string
    run_id: string
    source: string
    ip_address: string
    status: string
    tests: string | string[]
    results: string | unknown[]
    started_at: string
    completed_at: string
    created: string
    checkpoints?: Array<{
        test: string
        status: string
        error?: string
        timestamp: string
    }>
    logs?: LogEntry[]
}

interface HistoryDetailDrawerProps {
    selectedRun: RunRecord | null
    onClose: () => void
    statusChipColor: (s: string) => "success" | "error" | "info" | "default"
    formatTime: (iso: string) => string
    parseTests: (raw: string | string[] | null | undefined) => string[]
}

export default function HistoryDetailDrawer({
    selectedRun,
    onClose,
    statusChipColor,
    formatTime,
    parseTests,
}: HistoryDetailDrawerProps) {
    return (
        <Drawer
            anchor="right"
            open={!!selectedRun}
            onClose={onClose}
            slotProps={{ paper: { sx: { width: 480, p: 2 } } }}
        >
            {selectedRun && (
                <Stack spacing={2}>
                    <Stack direction="row" sx={{ alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
                            {selectedRun.run_id}
                        </Typography>
                        <TooltipIconButton
                            onClick={onClose}
                            size="small"
                            tooltip="Close detail drawer"
                            icon={<CloseIcon />}
                        />
                    </Stack>

                    <Stack direction="row" spacing={2}>
                        <Chip label={`Source: ${selectedRun.source}`} size="small" variant="outlined" />
                        <Chip
                            label={selectedRun.status}
                            size="small"
                            color={statusChipColor(selectedRun.status)}
                        />
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                        IP: {selectedRun.ip_address} ·
                        Started: {formatTime(selectedRun.started_at)} ·
                        Completed: {formatTime(selectedRun.completed_at)}
                    </Typography>

                    <Divider />

                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Tests ({parseTests(selectedRun.tests).length})
                    </Typography>
                    {parseTests(selectedRun.tests).map(testId => {
                        const cp = (selectedRun.checkpoints ?? []).find(c => c.test === testId)
                        const color =
                            cp?.status === 'passed' ? 'success' :
                                cp?.status === 'failed' ? 'error' :
                                    cp?.status === 'running' ? 'info' : 'default'
                        return (
                            <Stack key={testId} direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                                <Chip label={testId} size="small" color={color} />
                                {cp?.error && (
                                    <Typography variant="caption" color="error">
                                        {cp.error}
                                    </Typography>
                                )}
                            </Stack>
                        )
                    })}

                    <Divider />

                    {/* ── Log output (in-memory runs have full logs) ── */}
                    {selectedRun.logs && selectedRun.logs.length > 0 && (
                        <>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                Log ({selectedRun.logs.length} entries)
                            </Typography>
                            <Box sx={{
                                background: '#1e1e1e', color: '#d4d4d4',
                                borderRadius: 1, p: 1,
                                maxHeight: 300, overflow: 'auto',
                                fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.6,
                            }}>
                                {selectedRun.logs.map((entry, i) => (
                                    <div key={`${entry.timestamp}-${i}`} style={{
                                        color: entry.level === 'error' ? '#f44747'
                                            : entry.level === 'warning' ? '#cca700'
                                                : '#d4d4d4',
                                    }}>
                                        <span style={{ color: '#608b4e', userSelect: 'none' }}>
                                            [{entry.timestamp?.slice(11, 19) ?? '--:--:--'}]
                                        </span>{' '}
                                        {entry.message}
                                    </div>
                                ))}
                            </Box>
                            <Divider />
                        </>
                    )}

                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Raw Results
                    </Typography>
                    <Box sx={{
                        background: '#f5f5f5', borderRadius: 1, p: 1.5,
                        maxHeight: 300, overflow: 'auto', fontSize: '0.7rem',
                        fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                    }}>
                        {(() => {
                            try {
                                const raw = selectedRun.results
                                if (raw == null) return 'null'
                                if (Array.isArray(raw)) return JSON.stringify(raw, null, 2)
                                const parsed = JSON.parse(raw as string)
                                return JSON.stringify(parsed ?? raw, null, 2)
                            }
                            catch { return String(selectedRun.results ?? 'null') }
                        })()}
                    </Box>
                </Stack>
            )}
        </Drawer>
    )
}
