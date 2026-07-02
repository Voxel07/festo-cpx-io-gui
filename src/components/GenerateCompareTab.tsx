import { useContext, useReducer } from 'react'
import {
    Stack, Button, Alert, CircularProgress, TextField,
    Typography, Box, Divider, Chip,
} from '@mui/material'
import SplitDiff from './SplitDiff'
import type { Topology, TopologyModule, DiffStatus, CompareResult, BenchConfig } from '../types'
import { configToTopology } from '../App'
import { AlertsContext } from '../utils/AlertsManager'

// ── Sub-components ────────────────────────────────────────────────────────────

// ConfigFileInput removed, using global configPath from AppHeader

interface ReadLiveStepProps {
    busy: boolean
    result: Topology | null
    onRead: () => void
}
function ReadLiveStep({ busy, result, onRead }: ReadLiveStepProps) {
    return (
        <>
            <Button
                variant="contained" color="primary"
                onClick={onRead} disabled={busy}
                startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                sx={{ height: 36, whiteSpace: 'nowrap' }}
            >
                {busy ? 'Reading…' : '1 · Read Live Config'}
            </Button>
            {result && !busy && (
                <Chip label={`${result.Topology.length} modules`} size="small" color="primary" variant="outlined" />
            )}
        </>
    )
}

interface CompareStepProps {
    busy: boolean
    result: CompareResult | null
    disabled: boolean
    onCompare: () => void
}
function CompareStep({ busy, result, disabled, onCompare }: CompareStepProps) {
    return (
        <>
            <Button
                variant="contained" color="secondary"
                onClick={onCompare} disabled={busy || disabled}
                startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                sx={{ height: 36, whiteSpace: 'nowrap' }}
            >
                {busy ? 'Comparing…' : '2 · Compare with File'}
            </Button>
            {result && !busy && (
                <Chip
                    label={result.has_diff ? `${result.changes.length} diff(s)` : 'Matches'}
                    size="small"
                    color={result.has_diff ? 'warning' : 'success'}
                />
            )}
        </>
    )
}

interface WriteStepProps {
    busy: boolean
    savedTo: string | null
    disabled: boolean
    onWrite: () => void
}
function WriteStep({ busy, savedTo, disabled, onWrite }: WriteStepProps) {
    return (
        <>
            <Button
                variant="contained" color="success"
                onClick={onWrite} disabled={busy || disabled}
                startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
                sx={{ height: 36, whiteSpace: 'nowrap' }}
            >
                {busy ? 'Saving…' : '3 · Write to File'}
            </Button>
            {savedTo && !busy && (
                <Chip label="Saved ✓" size="small" color="success" />
            )}
        </>
    )
}

interface LiveConfigPreviewProps {
    topology: Topology
}
function LiveConfigPreview({ topology }: LiveConfigPreviewProps) {
    return (
        <Box sx={{ width: '60%', border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
            <Box sx={{
                background: '#f5f5f5', color: '#1565c0',
                px: 1.5, py: 0.75, borderBottom: '1px solid #e0e0e0',
                fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 1,
            }}>
                <span>Live · {topology.Name}</span>
                <Chip label={`${topology.Topology.length} modules`} size="small"
                    sx={{ height: 18, fontSize: '0.62rem' }} />
            </Box>
            <Box sx={{ overflow: 'auto', maxHeight: '60vh', background: '#fafafa', p: 1.5 }}>
                <pre style={{ margin: 0, fontSize: '0.72rem', color: '#333', fontFamily: 'monospace', lineHeight: 1.5 }}>
                    {JSON.stringify(topology, null, 2)}
                </pre>
            </Box>
        </Box>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
    ip: string
    timeout: number
    onResult: (topo: Topology | null, status: DiffStatus | null, removed?: TopologyModule[], rawConfig?: BenchConfig) => void
    configPath: string
}

interface TabState {
    liveConfig: BenchConfig | null
    liveTopology: Topology | null
    readBusy: boolean
    readError: string | null
    cmpData: CompareResult | null
    cmpBusy: boolean
    cmpError: string | null
    writeBusy: boolean
    writeError: string | null
    savedTo: string | null
}

const initialTabState: TabState = {
    liveConfig: null,
    liveTopology: null,
    readBusy: false,
    readError: null,
    cmpData: null,
    cmpBusy: false,
    cmpError: null,
    writeBusy: false,
    writeError: null,
    savedTo: null,
}

type TabAction =
    | { type: 'READ_START' }
    | { type: 'READ_SUCCESS'; config: BenchConfig; topology: Topology }
    | { type: 'READ_FAIL'; error: string }
    | { type: 'COMPARE_START' }
    | { type: 'COMPARE_SUCCESS'; data: CompareResult }
    | { type: 'COMPARE_FAIL'; error: string }
    | { type: 'WRITE_START' }
    | { type: 'WRITE_SUCCESS'; savedTo: string }
    | { type: 'WRITE_FAIL'; error: string }
    | { type: 'RESET_SAVED' }

function tabReducer(state: TabState, action: TabAction): TabState {
    switch (action.type) {
        case 'READ_START':
            return { ...state, readBusy: true, readError: null, cmpData: null, savedTo: null }
        case 'READ_SUCCESS':
            return { ...state, readBusy: false, liveConfig: action.config, liveTopology: action.topology }
        case 'READ_FAIL':
            return { ...state, readBusy: false, readError: action.error }
        case 'COMPARE_START':
            return { ...state, cmpBusy: true, cmpError: null }
        case 'COMPARE_SUCCESS':
            return { ...state, cmpBusy: false, cmpData: action.data }
        case 'COMPARE_FAIL':
            return { ...state, cmpBusy: false, cmpError: action.error }
        case 'WRITE_START':
            return { ...state, writeBusy: true, writeError: null, savedTo: null }
        case 'WRITE_SUCCESS':
            return { ...state, writeBusy: false, savedTo: action.savedTo }
        case 'WRITE_FAIL':
            return { ...state, writeBusy: false, writeError: action.error }
        case 'RESET_SAVED':
            return { ...state, savedTo: null }
        default:
            return state
    }
}

export default function GenerateCompareTab({ ip, timeout, onResult, configPath }: Props) {
    const [state, dispatch] = useReducer(tabReducer, initialTabState)
    const alerts = useContext(AlertsContext)
    const {
        liveConfig,
        liveTopology,
        readBusy,
        readError,
        cmpData,
        cmpBusy,
        cmpError,
        writeBusy,
        writeError,
        savedTo,
    } = state

    async function readLive() {
        dispatch({ type: 'READ_START' })
        try {
            const r = await fetch('/config/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip_address: ip, timeout }),
            })
            const d = await r.json()
            if (!r.ok) {
                dispatch({ type: 'READ_FAIL', error: d.detail ?? 'Unknown error' })
                return
            }
            const config: BenchConfig = d.config
            const topo = configToTopology(config)
            dispatch({ type: 'READ_SUCCESS', config, topology: topo })
            onResult(topo, null, [], config)
        } catch (e) {
            dispatch({ type: 'READ_FAIL', error: (e as Error).message })
        }
    }

    async function compare() {
        if (!configPath) {
            const error = 'Enter a configuration file path.'
            dispatch({ type: 'COMPARE_FAIL', error })
            alerts?.showAlert('error', error)
            return
        }
        dispatch({ type: 'COMPARE_START' })
        try {
            const r = await fetch('/config/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip_address: ip, timeout, config_path: configPath }),
            })
            const d: CompareResult & { detail?: string } = await r.json()
            if (!r.ok) {
                dispatch({ type: 'COMPARE_FAIL', error: d.detail ?? 'Unknown error' })
                alerts?.showAlert('error', d.detail ?? 'Unknown error')
                return
            }
            dispatch({ type: 'COMPARE_SUCCESS', data: d })
            alerts?.showAlert(
                d.has_diff ? 'warning' : 'success',
                d.has_diff
                    ? `${d.changes.length} field change(s) · ${d.added.length} module(s) added · ${d.removed.length} module(s) removed`
                    : 'Topology matches — no differences detected',
            )
            const ds: DiffStatus = {}
            for (const m of (d.live?.Topology ?? [])) ds[m.Adress] = 'unchanged'
            for (const c of d.changes) ds[c.address] = 'changed'
            for (const m of d.added) ds[m.Adress] = 'added'
            for (const m of d.removed) ds[m.Adress] = 'removed'
            onResult(d.live, ds, d.removed)
        } catch (e) {
            dispatch({ type: 'COMPARE_FAIL', error: (e as Error).message })
            alerts?.showAlert('error', (e as Error).message)
        }
    }

    async function writeToFile() {
        if (!liveConfig) {
            const error = 'Read live config first.'
            dispatch({ type: 'WRITE_FAIL', error })
            alerts?.showAlert('error', error)
            return
        }
        dispatch({ type: 'WRITE_START' })
        try {
            const r = await fetch('/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: liveConfig, save_path: configPath }),
            })
            const d: { saved_to?: string; detail?: string } = await r.json()
            if (!r.ok) {
                dispatch({ type: 'WRITE_FAIL', error: d.detail ?? 'Unknown error' })
                alerts?.showAlert('error', d.detail ?? 'Unknown error')
                return
            }
            const savedToPath = d.saved_to ?? configPath
            dispatch({ type: 'WRITE_SUCCESS', savedTo: savedToPath })
            alerts?.showAlert('success', `Saved → ${savedToPath}`)
        } catch (e) {
            dispatch({ type: 'WRITE_FAIL', error: (e as Error).message })
            alerts?.showAlert('error', (e as Error).message)
        }
    }

    const hasContent = readError || liveConfig || cmpError || cmpData || writeError || savedTo

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* ── Action toolbar ─────────────────────────────────── */}
            <Box sx={{
                background: '#fff',
                borderBottom: '1px solid #e0e0e0',
                px: 2.5, py: 1.25,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                flexShrink: 0,
            }}>
                <ReadLiveStep busy={readBusy} result={liveTopology} onRead={readLive} />

                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
                <CompareStep busy={cmpBusy} result={cmpData} disabled={!liveTopology} onCompare={compare} />

                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
                <WriteStep busy={writeBusy} savedTo={savedTo} disabled={!liveTopology} onWrite={writeToFile} />
            </Box>

            {/* ── Results area ──────────────────────────────────── */}
            <Box sx={{
                flex: 1, overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pt: hasContent ? 2 : 0,
                px: 2, pb: 3,
            }}>
                {!hasContent && (
                    <Box sx={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        height: '100%', gap: 1, color: 'text.secondary',
                    }}>
                        <Typography variant="body2">
                            Use the buttons above to read the live config, compare it with a file, or save it.
                        </Typography>
                    </Box>
                )}

                {/* ── Step 1: Live JSON preview (only when no compare yet) ── */}
                {liveTopology && !cmpData && (
                    <LiveConfigPreview topology={liveTopology} />
                )}

                {/* ── Step 2: Side-by-side diff (replaces preview after compare) ── */}
                {cmpData && (
                    <Box sx={{ width: '95%' }}>
                        <Alert severity={cmpData.has_diff ? 'warning' : 'success'} sx={{ mb: 1 }}>
                            {cmpData.has_diff
                                ? `${cmpData.changes.length} field change(s) · ${cmpData.added.length} module(s) added · ${cmpData.removed.length} module(s) removed`
                                : 'Topology matches — no differences detected'}
                        </Alert>
                        <SplitDiff cmpData={cmpData} />
                    </Box>
                )}
            </Box>
        </Box>
    )
}
