import { useState } from 'react'
import { Stack, TextField, Button, Alert, CircularProgress } from '@mui/material'
import SplitDiff from './SplitDiff'
import type { Topology, DiffStatus, CompareResult } from '../types'

interface Props {
    ip: string
    timeout: number
    onResult: (topo: Topology | null, status: DiffStatus | null) => void
}

export default function CompareTab({ ip, timeout, onResult }: Props) {
    const [storedPath, setStoredPath] = useState('')
    const [busy, setBusy] = useState(false)
    const [cmpData, setCmpData] = useState<CompareResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function run() {
        if (!storedPath) { setError('Enter a stored topology file path.'); return }
        setBusy(true); setError(null); setCmpData(null)
        try {
            const r = await fetch('/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip_address: ip, timeout, stored_path: storedPath }),
            })
            const d: CompareResult & { detail?: string } = await r.json()
            if (!r.ok) throw new Error(d.detail ?? 'Unknown error')
            setCmpData(d)

            const ds: DiffStatus = {}
            for (const m of (d.live?.Topology ?? [])) ds[m.Adress] = 'unchanged'
            for (const c of d.changes) ds[c.address] = 'changed'
            for (const m of d.added) ds[m.Adress] = 'added'
            for (const m of d.removed) ds[m.Adress] = 'removed'
            onResult(d.live, ds)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setBusy(false)
        }
    }

    const summary = cmpData
        ? `${cmpData.changes.length} field change(s) · ${cmpData.added.length} module(s) added · ${cmpData.removed.length} module(s) removed`
        : null

    return (
        <Stack spacing={2} sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="flex-end" sx={{ maxWidth: 860 }}>
                <TextField
                    label="Stored topology file"
                    value={storedPath}
                    onChange={e => setStoredPath(e.target.value)}
                    size="small"
                    placeholder="topology.jsonc"
                    sx={{ flex: 1 }}
                />
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={run}
                    disabled={busy}
                    sx={{ height: 40, whiteSpace: 'nowrap' }}
                >
                    {busy ? <CircularProgress size={20} color="inherit" /> : 'Compare with Live'}
                </Button>
            </Stack>

            {error && <Alert severity="error" sx={{ maxWidth: 860 }}>{error}</Alert>}

            {cmpData && (
                <>
                    <Alert severity={cmpData.has_diff ? 'warning' : 'success'} sx={{ maxWidth: 860 }}>
                        {cmpData.has_diff ? summary : 'Topology matches — no differences detected'}
                    </Alert>
                    <SplitDiff cmpData={cmpData} />
                </>
            )}
        </Stack>
    )
}
