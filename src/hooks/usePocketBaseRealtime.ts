/**
 * usePocketBaseRealtime – subscribe to PocketBase's built-in SSE realtime API.
 *
 * Connects to `{pbUrl}/api/realtime`, subscribes to `festo_test_runs` and
 * `festo_system_logs`, and fires callbacks when records are created/updated.
 *
 * Protocol (no SDK needed):
 *   1. Open EventSource → receive PB_CONNECT event with { clientId }
 *   2. POST /api/realtime with { clientId, subscriptions }
 *   3. Receive events named after the subscribed collection
 */
import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../components/TestRunTab'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PBRunRecord {
    run_id: string
    status: string
    source: string
    ip_address: string
    tests: string | string[]
}

interface PBLogRecord {
    run_id: string
    level: string
    message: string
    timestamp: string
}

export interface UsePocketBaseRealtimeOptions {
    /** run_id of the currently active test run — used to filter log events. */
    activeRunId: string | null | undefined
    /**
     * Called when PocketBase reports a new test run has started.
     * May be from this UI or an external caller (CI, another session).
     */
    onRunStarted?: (runId: string, source: string) => void
    /**
     * Called when PocketBase reports the active run completed/errored.
     * Use to trigger a final status refresh.
     */
    onRunCompleted?: (runId: string) => void
    /**
     * Called for every new log entry that matches `activeRunId`.
     * Use this when the SSE stream from the API is not yet open (external runs).
     */
    onLog?: (entry: LogEntry, runId: string) => void
}

export interface PocketBaseRealtimeState {
    connected: boolean
    pbUrl: string | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePocketBaseRealtime({
    activeRunId,
    onRunStarted,
    onRunCompleted,
    onLog,
}: UsePocketBaseRealtimeOptions): PocketBaseRealtimeState {
    const [pbUrl, setPbUrl] = useState<string | null>(null)
    const [connected, setConnected] = useState(false)

    // Keep callbacks in refs so the realtime effect doesn't re-connect on
    // every render — the EventSource is expensive to reconnect.
    const onRunStartedRef = useRef(onRunStarted)
    const onRunCompletedRef = useRef(onRunCompleted)
    const onLogRef = useRef(onLog)
    const activeRunIdRef = useRef(activeRunId)

    useEffect(() => { onRunStartedRef.current = onRunStarted }, [onRunStarted])
    useEffect(() => { onRunCompletedRef.current = onRunCompleted }, [onRunCompleted])
    useEffect(() => { onLogRef.current = onLog }, [onLog])
    useEffect(() => { activeRunIdRef.current = activeRunId }, [activeRunId])

    // ── Step 1: resolve the PocketBase URL via the API health endpoint ──
    useEffect(() => {
        let cancelled = false
        fetch('/pocketbase/health')
            .then(r => r.json())
            .then((d: { status: string; url?: string }) => {
                if (!cancelled && d.status === 'ok' && d.url) {
                    setPbUrl(d.url)
                }
            })
            .catch(() => { /* PocketBase not configured — hook stays dormant */ })
        return () => { cancelled = true }
    }, [])

    // ── Step 2: open EventSource, subscribe, handle events ──
    useEffect(() => {
        if (!pbUrl) return () => undefined
        let alive = true
        const eventSource = new EventSource(`${pbUrl}/api/realtime`)

        const handleConnect = (event: Event) => {
            if (!alive) return
            try {
                const { clientId } = JSON.parse((event as MessageEvent).data) as { clientId: string }
                fetch(`${pbUrl}/api/realtime`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientId,
                        subscriptions: ['festo_test_runs/*', 'festo_system_logs/*'],
                    }),
                })
                    .then(response => {
                        if (!response.ok) throw new Error(`PocketBase subscription failed: ${response.status}`)
                        if (alive) setConnected(true)
                    })
                    .catch(() => { if (alive) setConnected(false) })
            } catch { /* malformed PB_CONNECT */ }
        }

        const handleTestRun = (event: Event) => {
            if (!alive) return
            try {
                const { action, record } = JSON.parse((event as MessageEvent).data) as {
                    action: string
                    record: PBRunRecord
                }
                if (action === 'create' && record.status === 'running') {
                    onRunStartedRef.current?.(record.run_id, record.source ?? 'external')
                } else if (
                    action === 'update' &&
                    (record.status === 'completed' || record.status === 'error' || record.status === 'failed')
                ) {
                    onRunCompletedRef.current?.(record.run_id)
                }
            } catch { /* ignore malformed event */ }
        }

        const handleSystemLog = (event: Event) => {
            if (!alive) return
            try {
                const { action, record } = JSON.parse((event as MessageEvent).data) as {
                    action: string
                    record: PBLogRecord
                }
                if (action !== 'create') return
                if (activeRunIdRef.current && record.run_id !== activeRunIdRef.current) return
                onLogRef.current?.({
                    level: record.level,
                    message: record.message,
                    timestamp: record.timestamp,
                }, record.run_id)
            } catch { /* ignore malformed event */ }
        }

        eventSource.addEventListener('PB_CONNECT', handleConnect)
        eventSource.addEventListener('festo_test_runs', handleTestRun)
        eventSource.addEventListener('festo_system_logs', handleSystemLog)

        eventSource.onerror = () => {
            if (alive) setConnected(false)
            // Native EventSource reconnects automatically with server backoff.
        }

        return () => {
            alive = false
            eventSource.removeEventListener('PB_CONNECT', handleConnect)
            eventSource.removeEventListener('festo_test_runs', handleTestRun)
            eventSource.removeEventListener('festo_system_logs', handleSystemLog)
            eventSource.close()
        }
    }, [pbUrl])

    return { connected, pbUrl }
}
