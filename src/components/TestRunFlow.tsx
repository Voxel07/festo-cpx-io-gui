import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, ButtonGroup, Stack, Tooltip, Typography, useTheme } from '@mui/material'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'

type ParticipantKind = 'client' | 'api' | 'planning' | 'execution' | 'hardware' | 'persistence'

const colors: Record<ParticipantKind, string> = {
    client: '#1976d2', api: '#8e24aa', planning: '#ef6c00', execution: '#2e7d32', hardware: '#546e7a', persistence: '#00838f',
}

const participants = [
    { id: 'initiator', title: 'UI / CI', subtitle: 'Run initiator', kind: 'client' },
    { id: 'api', title: 'FastAPI', subtitle: 'Validation, lock, status, SSE', kind: 'api' },
    { id: 'config', title: 'BenchConfig', subtitle: 'Types, instances, channels, wiring', kind: 'planning' },
    { id: 'resolver', title: 'TestResolver', subtitle: 'Capability and compatibility planner', kind: 'planning' },
    { id: 'tests', title: 'Test library', subtitle: 'TEST_DEFINITION(S) + run()', kind: 'execution' },
    { id: 'hardware', title: 'HAL / CPX-AP', subtitle: 'Lock, I/O, parameters, diagnoses', kind: 'hardware' },
    { id: 'pocketbase', title: 'PocketBase', subtitle: 'Runs, checkpoints, logs, realtime', kind: 'persistence' },
    { id: 'view', title: 'TestRunTab', subtitle: 'Progress, results and live log', kind: 'client' },
] as const

type ParticipantId = typeof participants[number]['id']
type SequenceMessage = {
    from: ParticipantId
    to: ParticipantId
    title: string
    detail?: string
    response?: boolean
    realtime?: boolean
    danger?: boolean
}

const messages: SequenceMessage[] = [
    { from: 'initiator', to: 'api', title: 'POST /test-run/start', detail: '{ ip_address, config_path, tests[], source }' },
    { from: 'api', to: 'api', title: 'Validate request', detail: 'non-empty tests • known IDs • source allow-list • allowed_in_ci' },
    { from: 'api', to: 'config', title: 'Resolve safe path and load JSON', detail: 'allowed config roots → BenchConfig.model_validate_json()' },
    { from: 'config', to: 'api', title: 'Validated BenchConfig', detail: 'test_bench • module_types • module_instances • wiring • overrides', response: true },
    { from: 'api', to: 'api', title: 'Acquire in-process run lock', detail: 'create run_id and initial running state' },

    { from: 'api', to: 'resolver', title: 'resolve(config, TestFilter(test_id))', detail: 'one resolution request per selected test ID' },
    { from: 'resolver', to: 'tests', title: 'Load test requirements', detail: 'TEST_DEFINITION(S): required_capabilities, categories, patterns, wiring, safety, CI' },
    { from: 'tests', to: 'resolver', title: 'TestDefinition[]', detail: 'config.test_definitions takes precedence; imported metadata is cached', response: true },
    { from: 'resolver', to: 'config', title: 'Look up candidate module', detail: 'module_instance.category + module_type_ref + explicit overrides' },
    { from: 'config', to: 'resolver', title: 'Module capabilities', detail: 'module_types[type_ref].capabilities; otherwise infer from display_name/category', response: true },
    { from: 'resolver', to: 'resolver', title: 'Compatibility gates', detail: 'category → capability superset → glob pattern → include/exclude → override' },
    { from: 'resolver', to: 'config', title: 'Match required wiring', detail: 'connection_type + source/target instance + channel IDs' },
    { from: 'config', to: 'resolver', title: 'Matching wiring instances', detail: 'physical/logical connection bindings', response: true },
    { from: 'resolver', to: 'api', title: 'ExecutionPlan', detail: 'deduplicated ResolvedTestInstance: test + module + channel/wire + parameters', response: true },

    { from: 'api', to: 'pocketbase', title: 'Create festo_test_runs record', detail: 'run_id • source • IP • tests • bench/commit/CI IDs • status=running' },
    { from: 'pocketbase', to: 'view', title: 'Realtime run create event', detail: '{ run_id, status, source, ip_address, tests }', realtime: true },
    { from: 'api', to: 'initiator', title: '202 started', detail: '{ run_id, status: "started" }', response: true },

    { from: 'initiator', to: 'api', title: 'Another POST /test-run/start', detail: 'arrives while _test_run_lock is locked', danger: true },
    { from: 'api', to: 'initiator', title: '409 Conflict — rejected', detail: '"Another test run is in progress (source: web/ci)"; active run is not disturbed', response: true, danger: true },

    { from: 'api', to: 'hardware', title: 'CrossProcessLock.acquire(60 s)', detail: 'prevents another API/CI process from using the same bench' },
    { from: 'api', to: 'tests', title: 'Execute resolved instances sequentially', detail: '[loop] sorted by test_id and module_address; abort checked before each instance' },
    { from: 'tests', to: 'hardware', title: 'run(hw, config_path, module_address, log)', detail: 'read topology/I/O/parameters/diagnoses • write outputs/parameters • power-cycle if required' },
    { from: 'hardware', to: 'tests', title: 'Device values or exception', detail: 'measurements, booleans, diagnosis data, durations, error details', response: true },
    { from: 'tests', to: 'api', title: 'Normalized TestResult', detail: '{ test_id, passed, duration_ms, results[{ module/address, passed, error, … }] }', response: true },
    { from: 'api', to: 'api', title: 'Update live state', detail: 'progress.completed/total/current_test/current_module • merge per-module results' },
    { from: 'api', to: 'pocketbase', title: 'Persist checkpoint', detail: 'festo_checkpoints: run_id • test • running/passed/failed/skipped • error • timestamp' },
    { from: 'api', to: 'pocketbase', title: 'Persist log record', detail: 'festo_system_logs: run_id • level • message • details • timestamp' },
    { from: 'api', to: 'view', title: 'Local SSE /stream', detail: 'LogEntry { level, message, timestamp }; final { type: "done" }', realtime: true },
    { from: 'pocketbase', to: 'view', title: 'Realtime log fallback', detail: 'used for external runs or until the local SSE connection is healthy', realtime: true },
    { from: 'view', to: 'api', title: 'GET /test-run/status every 2 s', detail: 'full run snapshot; idle polling uses 5 s', realtime: true },
    { from: 'api', to: 'view', title: 'Current TestRunState', detail: 'status • progress • tests • results • checkpoints • buffered logs • error', response: true, realtime: true },

    { from: 'api', to: 'hardware', title: 'finally: reset_all_outputs()', detail: 'always drive outputs LOW, even after failure or abort' },
    { from: 'api', to: 'hardware', title: 'Release cross-process lock', response: true },
    { from: 'api', to: 'api', title: 'Finalize status and release run lock', detail: 'completed only if fully passing; otherwise failed/error' },
    { from: 'api', to: 'pocketbase', title: 'Update final run record', detail: 'status • results[] • completed_at (history also keeps checkpoints and logs)' },
    { from: 'pocketbase', to: 'view', title: 'Realtime completion event', detail: 'completed / failed / error triggers final detail refresh', realtime: true },
    { from: 'view', to: 'api', title: 'GET /test-run/{run_id}', detail: 'reconcile final record for UI- or CI-started runs' },
    { from: 'api', to: 'view', title: 'Final normalized result', detail: 'render progress, module results, checkpoint status and combined live log', response: true },
]

const canvasWidth = 1900
const actorY = 18
const actorWidth = 196
const actorHeight = 68
const firstX = 120
const spacing = 235
const firstMessageY = 142
const rowHeight = 72
const canvasHeight = firstMessageY + messages.length * rowHeight + 80
const xById = Object.fromEntries(participants.map((participant, index) => [participant.id, firstX + index * spacing])) as Record<ParticipantId, number>

const phases = [
    { label: 'START + VALIDATE', start: 0, end: 4, color: '#1565c0' },
    { label: 'RESOLVE REQUIREMENTS', start: 5, end: 13, color: '#ef6c00' },
    { label: 'PUBLISH START', start: 14, end: 16, color: '#00838f' },
    { label: 'ALT: RUN ALREADY ACTIVE', start: 17, end: 18, color: '#d32f2f' },
    { label: 'LOOP: EACH RESOLVED INSTANCE', start: 19, end: 30, color: '#2e7d32' },
    { label: 'FINALLY + COMPLETE', start: 31, end: 37, color: '#6a1b9a' },
]

function MessageLabel({ message, index, x1, x2, y }: { message: SequenceMessage; index: number; x1: number; x2: number; y: number }) {
    const width = message.from === message.to ? 310 : Math.min(Math.max(Math.abs(x2 - x1) - 24, 185), 430)
    const left = message.from === message.to ? x1 + 24 : (x1 + x2) / 2 - width / 2
    const accent = message.danger ? '#d32f2f' : message.realtime ? '#00838f' : undefined
    return (
        <Box sx={{ position: 'absolute', left, top: y - 43, width, minHeight: 38, px: 0.7, py: 0.3, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 0.5, border: accent ? `1px solid ${accent}` : '1px solid transparent', zIndex: 4, pointerEvents: 'none' }}>
            <Typography component="div" sx={{ fontSize: 10.5, lineHeight: 1.15, fontWeight: 700, color: accent ?? 'text.primary' }}>{index + 1}. {message.title}</Typography>
            {message.detail && <Typography component="div" sx={{ mt: 0.2, fontSize: 9, lineHeight: 1.12, color: 'text.secondary' }}>{message.detail}</Typography>}
        </Box>
    )
}

export default function TestRunFlow() {
    const theme = useTheme()
    const dark = theme.palette.mode === 'dark'
    const arrowColor = theme.palette.text.secondary
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const hasInitiallyFitted = useRef(false)
    const [zoom, setZoom] = useState(1)
    const sequenceRows = useMemo(() => messages.map((message, index) => ({ message, index, y: firstMessageY + index * rowHeight })), [])

    const applyZoom = useCallback((nextZoom: number) => {
        const viewport = viewportRef.current
        const bounded = Math.min(1.75, Math.max(0.35, nextZoom))
        if (!viewport) {
            setZoom(bounded)
            return
        }
        const logicalCenterX = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom
        const logicalCenterY = (viewport.scrollTop + viewport.clientHeight / 2) / zoom
        setZoom(bounded)
        requestAnimationFrame(() => {
            viewport.scrollTo({
                left: Math.max(0, logicalCenterX * bounded - viewport.clientWidth / 2),
                top: Math.max(0, logicalCenterY * bounded - viewport.clientHeight / 2),
            })
        })
    }, [zoom])

    const fitWidth = useCallback(() => {
        const viewport = viewportRef.current
        if (!viewport) return
        const fitted = Math.min(1, Math.max(0.35, (viewport.clientWidth - 32) / canvasWidth))
        setZoom(fitted)
        requestAnimationFrame(() => viewport.scrollTo({ left: 0, top: 0 }))
    }, [])

    const focusPhase = useCallback((phase: typeof phases[number]) => {
        const viewport = viewportRef.current
        if (!viewport) return
        const focusedZoom = Math.max(zoom, 0.85)
        const phaseTop = firstMessageY + phase.start * rowHeight - 64
        setZoom(focusedZoom)
        requestAnimationFrame(() => {
            viewport.scrollTo({
                left: Math.max(0, canvasWidth * focusedZoom / 2 - viewport.clientWidth / 2),
                top: Math.max(0, phaseTop * focusedZoom),
                behavior: 'smooth',
            })
        })
    }, [zoom])

    useEffect(() => {
        if (hasInitiallyFitted.current) return
        hasInitiallyFitted.current = true
        requestAnimationFrame(fitWidth)
    }, [fitWidth])

    return (
        <Box sx={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0, px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', overflowX: 'auto' }}>
                <ButtonGroup size="small" variant="outlined" aria-label="Sequence diagram zoom controls">
                    <Tooltip title="Zoom out"><Button aria-label="Zoom out" onClick={() => applyZoom(zoom - 0.15)} disabled={zoom <= 0.35}><ZoomOutIcon fontSize="small" /></Button></Tooltip>
                    <Button onClick={() => applyZoom(1)} sx={{ minWidth: 62 }} aria-label={`Zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</Button>
                    <Tooltip title="Zoom in"><Button aria-label="Zoom in" onClick={() => applyZoom(zoom + 0.15)} disabled={zoom >= 1.75}><ZoomInIcon fontSize="small" /></Button></Tooltip>
                    <Tooltip title="Fit diagram width"><Button aria-label="Fit diagram width" onClick={fitWidth}><FitScreenIcon fontSize="small" /></Button></Tooltip>
                </ButtonGroup>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Focus:</Typography>
                {phases.map(phase => (
                    <Button key={phase.label} size="small" variant="text" startIcon={<CenterFocusStrongIcon sx={{ color: phase.color }} />} onClick={() => focusPhase(phase)} sx={{ whiteSpace: 'nowrap', fontSize: '0.68rem' }}>
                        {phase.label.replace('LOOP: ', '').replace('ALT: ', '')}
                    </Button>
                ))}
            </Stack>
            <Box
                ref={viewportRef}
                sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}
                onWheel={event => {
                    if (!event.ctrlKey) return
                    event.preventDefault()
                    applyZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1))
                }}
            >
                <Box sx={{ position: 'relative', width: canvasWidth * zoom, height: canvasHeight * zoom, mx: 'auto' }}>
                    <Box sx={{ position: 'absolute', left: 0, top: 0, width: canvasWidth, height: canvasHeight, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                <svg width={canvasWidth} height={canvasHeight} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
                    <defs>
                        <marker id="seq-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={arrowColor} /></marker>
                        <marker id="seq-arrow-live" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#00838f" /></marker>
                        <marker id="seq-arrow-danger" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#d32f2f" /></marker>
                    </defs>

                    {phases.map(phase => {
                        const top = firstMessageY + phase.start * rowHeight - 52
                        const height = (phase.end - phase.start + 1) * rowHeight
                        return <g key={phase.label}>
                            <rect x="8" y={top} width={canvasWidth - 16} height={height} rx="8" fill={phase.color} fillOpacity={dark ? 0.055 : 0.035} stroke={phase.color} strokeOpacity="0.3" strokeDasharray="7 5" />
                            <text x="18" y={top + 17} fill={phase.color} fontSize="10" fontWeight="700">{phase.label}</text>
                        </g>
                    })}

                    {participants.map(participant => <line key={participant.id} x1={xById[participant.id]} y1={actorY + actorHeight} x2={xById[participant.id]} y2={canvasHeight - 24} stroke={colors[participant.kind]} strokeWidth="2" strokeDasharray="7 6" opacity="0.6" />)}

                    <rect x={xById.api - 5} y={firstMessageY - 8} width="10" height={(messages.length - 1) * rowHeight + 20} rx="4" fill={colors.api} opacity="0.24" />
                    <rect x={xById.tests - 5} y={firstMessageY + 20 * rowHeight - 8} width="10" height={11 * rowHeight} rx="4" fill={colors.execution} opacity="0.3" />

                    {sequenceRows.map(({ message, index, y }) => {
                        const x1 = xById[message.from]
                        const x2 = xById[message.to]
                        const stroke = message.danger ? '#d32f2f' : message.realtime ? '#00838f' : arrowColor
                        const marker = message.danger ? 'url(#seq-arrow-danger)' : message.realtime ? 'url(#seq-arrow-live)' : 'url(#seq-arrow)'
                        if (message.from === message.to) {
                            return <path key={index} d={`M ${x1} ${y} h 72 v 28 h -72`} fill="none" stroke={stroke} strokeWidth="1.6" strokeDasharray={message.response ? '6 4' : undefined} markerEnd={marker} />
                        }
                        const pad = x2 > x1 ? 7 : -7
                        return <line key={index} x1={x1} y1={y} x2={x2 - pad} y2={y} stroke={stroke} strokeWidth="1.6" strokeDasharray={message.response ? '6 4' : undefined} markerEnd={marker} />
                    })}
                </svg>

                {participants.map(participant => (
                    <Box key={participant.id} sx={{ position: 'absolute', left: xById[participant.id] - actorWidth / 2, top: actorY, width: actorWidth, height: actorHeight, px: 1, py: 0.8, textAlign: 'center', border: `2px solid ${colors[participant.kind]}`, borderTop: `6px solid ${colors[participant.kind]}`, borderRadius: 1, bgcolor: 'background.paper', boxShadow: 2, zIndex: 6 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{participant.title}</Typography>
                        <Typography sx={{ mt: 0.5, fontSize: 9.5, color: colors[participant.kind], lineHeight: 1.15 }}>{participant.subtitle}</Typography>
                    </Box>
                ))}

                {sequenceRows.map(({ message, index, y }) => <MessageLabel key={index} message={message} index={index} x1={xById[message.from]} x2={xById[message.to]} y={y} />)}

                    </Box>
                </Box>
            </Box>
        </Box>
    )
}
