import { useState } from 'react'
import {
    Stack, Button, Alert, CircularProgress, TextField,
    Typography, Box, Divider, Chip,
} from '@mui/material'
import SplitDiff from './SplitDiff'
import type { Topology, TopologyModule, DiffStatus, CompareResult, BenchConfig } from '../types'
import { configToTopology } from '../utils/configMapper'

// ── Sub-components ────────────────────────────────────────────────────────────

interface ConfigFileInputProps {
    value: string
    onChange: (v: string) => void
}
function ConfigFileInput({ value, onChange }: ConfigFileInputProps) {
    return (
        <TextField
            label="Configuration file"
            value={value}
            onChange={e => onChange(e.target.value)}
            size="small"
            placeholder="bench_config.json"
            sx={{ width: 220 }}
        />
    )
}

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
}

export default function GenerateCompareTab({ ip, timeout, onResult }: Props) {
    const [filePath, setFilePath] = useState('bench_config.json')

    // Stage 1 – Read live
    const [liveConfig, setLiveConfig] = useState<BenchConfig | null>(null)
    const [liveTopology, setLiveTopology] = useState<Topology | null>(null)
    const [readBusy, setReadBusy] = useState(false)
    const [readError, setReadError] = useState<string | null>(null)

    // Stage 2 – Compare
    const [cmpData, setCmpData] = useState<CompareResult | null>(null)
    const [cmpBusy, setCmpBusy] = useState(false)
    const [cmpError, setCmpError] = useState<string | null>(null)

    // Stage 3 – Write
    const [writeBusy, setWriteBusy] = useState(false)
    const [writeError, setWriteError] = useState<string | null>(null)
    const [savedTo, setSavedTo] = useState<string | null>(null)

    async function readLive() {
        setReadBusy(true); setReadError(null); setCmpData(null); setSavedTo(null)
        try {
            const r = await fetch('/config/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip_address: ip, timeout, save_path: filePath }),
            })
            const d = await r.json()
            if (!r.ok) throw new Error(d.detail ?? 'Unknown error')
            const config: BenchConfig = d.config
            const topo = configToTopology(config)
            setLiveConfig(config)
            setLiveTopology(topo)
            onResult(topo, null, [], config)
        } catch (e) {
            setReadError((e as Error).message)
        } finally {
            setReadBusy(false)
        }
    }

    async function compare() {
        if (!filePath) { setCmpError('Enter a configuration file path.'); return }
        setCmpBusy(true); setCmpError(null)
        try {
            const r = await fetch('/config/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip_address: ip, timeout, config_path: filePath }),
            })
            const d: CompareResult & { detail?: string } = await r.json()
            if (!r.ok) throw new Error(d.detail ?? 'Unknown error')
            setCmpData(d)
            const ds: DiffStatus = {}
            for (const m of (d.live?.Topology ?? [])) ds[m.Adress] = 'unchanged'
            for (const c of d.changes) ds[c.address] = 'changed'
            for (const m of d.added) ds[m.Adress] = 'added'
            for (const m of d.removed) ds[m.Adress] = 'removed'
            onResult(d.live, ds, d.removed)
        } catch (e) {
            setCmpError((e as Error).message)
        } finally {
            setCmpBusy(false)
        }
    }

    async function writeToFile() {
        if (!liveConfig) { setWriteError('Read live config first.'); return }
        setWriteBusy(true); setWriteError(null); setSavedTo(null)
        try {
            const r = await fetch('/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: liveConfig, save_path: filePath }),
            })
            const d: { saved_to?: string; detail?: string } = await r.json()
            if (!r.ok) throw new Error(d.detail ?? 'Unknown error')
            setSavedTo(d.saved_to ?? filePath)
        } catch (e) {
            setWriteError((e as Error).message)
        } finally {
            setWriteBusy(false)
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
                <ConfigFileInput value={filePath} onChange={setFilePath} />

                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
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

                {/* ── Alerts row ── */}
                {(readError || cmpError || writeError || savedTo) && (
                    <Stack spacing={1} sx={{ width: '100%', maxWidth: '70%', mb: 2 }}>
                        {readError && <Alert severity="error">{readError}</Alert>}
                        {cmpError && <Alert severity="error">{cmpError}</Alert>}
                        {writeError && <Alert severity="error">{writeError}</Alert>}
                        {savedTo && <Alert severity="success">Saved → {savedTo}</Alert>}
                    </Stack>
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
