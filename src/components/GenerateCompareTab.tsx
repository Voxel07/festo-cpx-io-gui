import { useState } from 'react'
import {
    Stack, Button, Alert, CircularProgress, TextField,
    Typography, Box, Divider, Chip,
} from '@mui/material'
import SplitDiff from './SplitDiff'
import type { Topology, TopologyModule, DiffStatus, CompareResult, BenchConfig } from '../types'
import { configToTopology } from '../utils/configMapper'

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
                {/* File path */}
                <TextField
                    label="Configuration file"
                    value={filePath}
                    onChange={e => setFilePath(e.target.value)}
                    size="small"
                    placeholder="bench_config.json"
                    sx={{ width: 220 }}
                />

                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

                {/* Step 1 */}
                <Button
                    variant="contained" color="primary"
                    onClick={readLive} disabled={readBusy}
                    startIcon={readBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{ height: 36, whiteSpace: 'nowrap' }}
                >
                    {readBusy ? 'Reading…' : '1 · Read Live Config'}
                </Button>
                {liveTopology && !readBusy && (
                    <Chip label={`${liveTopology.Topology.length} modules`} size="small" color="primary" variant="outlined" />
                )}

                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

                {/* Step 2 */}
                <Button
                    variant="contained" color="secondary"
                    onClick={compare} disabled={cmpBusy || !liveTopology}
                    startIcon={cmpBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{ height: 36, whiteSpace: 'nowrap' }}
                >
                    {cmpBusy ? 'Comparing…' : '2 · Compare with File'}
                </Button>
                {cmpData && !cmpBusy && (
                    <Chip
                        label={cmpData.has_diff ? `${cmpData.changes.length} diff(s)` : 'Matches'}
                        size="small"
                        color={cmpData.has_diff ? 'warning' : 'success'}
                    />
                )}

                <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

                {/* Step 3 */}
                <Button
                    variant="contained" color="success"
                    onClick={writeToFile} disabled={writeBusy || !liveTopology}
                    startIcon={writeBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{ height: 36, whiteSpace: 'nowrap' }}
                >
                    {writeBusy ? 'Saving…' : '3 · Write to File'}
                </Button>
                {savedTo && !writeBusy && (
                    <Chip label="Saved ✓" size="small" color="success" />
                )}
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

                {/* ── Alerts row (always full-width within center column) ── */}
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
                    <Box sx={{ width: '60%', border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
                        <Box sx={{
                            background: '#f5f5f5', color: '#1565c0',
                            px: 1.5, py: 0.75, borderBottom: '1px solid #e0e0e0',
                            fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: 1,
                        }}>
                            <span>⚡ Live · {liveTopology.Name}</span>
                            <Chip label={`${liveTopology.Topology.length} modules`} size="small"
                                sx={{ height: 18, fontSize: '0.62rem' }} />
                        </Box>
                        <Box sx={{ overflow: 'auto', background: '#fafafa', p: 1.5 }}>
                            <pre style={{ margin: 0, fontSize: '0.72rem', color: '#333', fontFamily: 'monospace', lineHeight: 1.5 }}>
                                {JSON.stringify(liveTopology, null, 2)}
                            </pre>
                        </Box>
                    </Box>
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
