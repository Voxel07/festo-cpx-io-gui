import { useEffect, useRef } from 'react'
import { Box, Paper, Typography, Chip } from '@mui/material'

interface TestResultsProps {
    status: 'idle' | 'starting' | 'running' | 'completed' | 'error'
    results?: Array<{ test_id?: string; passed?: boolean; error?: string; duration_ms?: number;[k: string]: unknown }>
    /** Currently executing module address (from progressDetail.current_module). */
    currentModule?: string | null
}

/** Determine per-module status for the progress list. */
function modStatus(mr: Record<string, unknown>, isCurrent: boolean): 'running' | 'passed' | 'failed' | 'pending' {
    const p = mr.passed
    // If the module already has a definitive result, never override to "running"
    // — the backend may not clear current_module after the last module finishes.
    if (p === true || mr.duration_ms != null) return 'passed'
    if (p === false) return 'failed'
    if (isCurrent) return 'running'
    return 'pending'
}

const MOD_ICON: Record<string, string> = {
    running: '⏳',
    passed: '✓',
    failed: '✗',
    pending: '○',
}

const MOD_COLOR: Record<string, string> = {
    running: '#0288d1',
    passed: '#2e7d32',
    failed: '#d32f2f',
    pending: '#999',
}

export default function TestResults({ status, results = [], currentModule }: TestResultsProps) {
    const isRunning = status === 'running'
    const containerRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when new results arrive during a running test
    useEffect(() => {
        const container = containerRef.current
        if (!container || !isRunning || results.length === 0) return
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight
        })
    }, [results, isRunning])

    return (
        <Paper ref={containerRef} variant="outlined" sx={{ p: 1.5, overflow: 'auto', maxHeight: 400 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                {isRunning ? 'Live Results' : 'Detailed Results'}
            </Typography>
            {results.map((r, ri) => {
                const subResults = r.results as Array<Record<string, unknown>> | undefined
                const testId = String(r.test_id ?? `Test ${ri + 1}`)
                const passed = r.passed
                const dur = r.duration_ms
                return (
                    <Box key={ri} sx={{ mb: 1, borderBottom: '1px solid #eee', pb: 1 }}>
                        {/* Test header with duration */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, flex: 1 }}>
                                {testId}
                            </Typography>
                            {dur !== undefined && dur !== null && (
                                <Chip
                                    label={`${dur}ms`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                            )}
                            <span style={{
                                fontWeight: 700, fontSize: '0.85rem',
                                color: passed ? '#2e7d32' : passed === false ? '#d32f2f' : '#888',
                            }}>
                                {passed ? '✓' : passed === false ? '✗' : '○'}
                            </span>
                        </Box>

                        {/* Module progress list — all compatible modules with live status */}
                        {subResults && Array.isArray(subResults) && subResults.length > 0 && (
                            <Box sx={{ pl: 1, mt: 0.25 }}>
                                {subResults.map((sr, si) => {
                                    const isCurrent = currentModule != null && String(sr.address) === String(currentModule)
                                    const ms = modStatus(sr, isCurrent)
                                    const srErr = sr.error as string | undefined
                                    const channels = sr.channels as Array<Record<string, unknown>> | undefined

                                    return (
                                                        <Box key={si}>
                                                            <Typography variant="caption" sx={{
                                                                display: 'block',
                                                                fontSize: '0.62rem',
                                                                color: MOD_COLOR[ms] as string,
                                                            }}>
                                                                {MOD_ICON[ms]} #{String(sr.address ?? '?')}{' '}
                                                                {String(sr.module_name || sr.module || sr.connection || '')}
                                                                {sr.passed_channels !== undefined ? ` · ${sr.passed_channels}/${sr.total_channels} ch` : ''}
                                                                {sr.duration_ms !== undefined ? ` · ${sr.duration_ms}ms` : ''}
                                                            </Typography>
                                                            {srErr && (
                                                                <Typography variant="caption" sx={{ display: 'block', color: '#d32f2f', fontSize: '0.6rem', pl: 1 }}>
                                                                    {srErr}
                                                                </Typography>
                                                            )}
                                                            {/* Per-channel errors */}
                                                            {channels && channels.filter(c => !c.passed).map((c, ci) => (
                                                                <Typography key={ci} variant="caption" sx={{ display: 'block', color: '#d32f2f', fontSize: '0.58rem', pl: 2 }}>
                                                                    ch {String(c.channel as string | number)}: {String((c.error as string) ?? 'readback LOW')} · {String(c.duration_ms as string | number)}ms
                                                                </Typography>
                                                            ))}
                                                        </Box>
                                    )
                                })}
                            </Box>
                        )}

                        {/* Fallback for results without sub-structure */}
                        {(!subResults || subResults.length === 0) && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#777', fontSize: '0.62rem', pl: 1 }}>
                                {String(r.error ?? (passed ? 'no differences' : 'differences found'))}
                            </Typography>
                        )}

                        {r.error && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', fontSize: '0.62rem' }}>
                                {String(r.error)}
                            </Typography>
                        )}
                    </Box>
                )
            })}
        </Paper>
    )
}
