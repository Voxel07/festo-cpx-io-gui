import { useEffect, useRef } from 'react'
import { Box, Paper, Stack, Typography } from '@mui/material'
import type { LogEntry } from './TestRunTab'

interface TestLiveLogProps {
    displayLogs: LogEntry[]
    sseLogsActive: boolean
    hasLogs: boolean
}

export default function TestLiveLog({ displayLogs, sseLogsActive, hasLogs }: TestLiveLogProps) {
    const logsContainerRef = useRef<HTMLDivElement>(null)

    // Auto-scroll: always scroll to bottom when new entries arrive,
    // unless the user has scrolled up to read earlier entries (threshold check).
    useEffect(() => {
        const container = logsContainerRef.current
        if (!container || displayLogs.length === 0) return
        const threshold = 80 // px from bottom
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        if (distFromBottom < threshold) {
            // Use rAF to ensure DOM has rendered the new entries before scrolling
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight
            })
        }
    }, [displayLogs])

    return (
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Paper variant="outlined" sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5, flexShrink: 0 }} spacing={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                        Live Log
                    </Typography>
                    {hasLogs && (
                        <Typography variant="caption" color="text.secondary">
                            {displayLogs.length} entries{sseLogsActive ? ' (live)' : ''}
                        </Typography>
                    )}
                </Stack>
                <Box ref={logsContainerRef} sx={{
                    flex: 1,
                    overflow: 'auto',
                    background: '#1e1e1e', color: '#d4d4d4',
                    borderRadius: 1, p: 1, fontFamily: 'monospace',
                    fontSize: '0.75rem', lineHeight: 1.6,
                }}>
                    {displayLogs.length === 0 && (
                        <Box sx={{ color: '#555', fontStyle: 'italic', mt: 1 }}>
                            No log entries yet. Start a test run to see output here.
                        </Box>
                    )}
                    {displayLogs.map((entry, i) => (
                        <div key={i} style={{
                            color: entry.level === 'error' ? '#f44747' :
                                entry.level === 'warning' ? '#cca700' : '#d4d4d4',
                        }}>
                            <span style={{ color: '#608b4e', userSelect: 'none' }}>
                                [{entry.timestamp?.slice(11, 19) ?? '--:--:--'}]
                            </span>{' '}
                            {entry.message}
                        </div>
                    ))}
                </Box>
            </Paper>
        </Box>
    )
}
