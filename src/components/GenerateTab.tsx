import { useState } from 'react'
import { Stack, TextField, Button, Alert, CircularProgress, Paper } from '@mui/material'
import type { Topology, DiffStatus, GenerateResult } from '../types'

interface Props {
    ip: string
    timeout: number
    onResult: (topo: Topology | null, status: DiffStatus | null) => void
}

export default function GenerateTab({ ip, timeout, onResult }: Props) {
    const [savePath, setSavePath] = useState('topology.jsonc')
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<GenerateResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function run() {
        setBusy(true); setError(null); setResult(null)
        try {
            const r = await fetch('/topology', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip_address: ip, timeout, save_path: savePath || null }),
            })
            const d: GenerateResult & { detail?: string } = await r.json()
            if (!r.ok) throw new Error(d.detail ?? 'Unknown error')
            setResult(d)
            onResult(d.topology, null)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Stack spacing={2} sx={{ p: 2, maxWidth: 860 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-end' }}>
                <TextField
                    label="Save to file (optional)"
                    value={savePath}
                    onChange={e => setSavePath(e.target.value)}
                    size="small"
                    placeholder="topology.jsonc"
                    sx={{ flex: 1 }}
                />
                <Button
                    variant="contained"
                    onClick={run}
                    disabled={busy}
                    sx={{ height: 40, whiteSpace: 'nowrap' }}
                >
                    {busy ? <CircularProgress size={20} color="inherit" /> : 'Read & Generate Topology'}
                </Button>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}
            {result?.saved_to && <Alert severity="success">Saved → {result.saved_to}</Alert>}

            {result?.topology && (
                <Paper variant="outlined" sx={{ p: 1.5, overflow: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.78rem' }}>
                        {JSON.stringify(result.topology, null, 2)}
                    </pre>
                </Paper>
            )}
        </Stack>
    )
}
