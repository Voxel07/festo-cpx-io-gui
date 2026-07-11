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
        if (!pbUrl) return

        let alive = true
        let es: EventSource | null = null
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null

        function connect() {
            if (!alive) return
            es = new EventSource(`${pbUrl}/api/realtime`)

            // PocketBase sends this immediately after connection with the clientId
            es.addEventListener('PB_CONNECT', (e) => {
                if (!alive) return
                try {
                    const { clientId } = JSON.parse((e as MessageEvent).data) as { clientId: string }
                    fetch(`${pbUrl}/api/realtime`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            clientId,
                            subscriptions: ['festo_test_runs', 'festo_system_logs'],
                        }),
                    })
                        .then(() => { if (alive) setConnected(true) })
                        .catch(() => { /* subscribe failed — will retry on next connect */ })
                } catch { /* malformed PB_CONNECT */ }
            })

            // ── festo_test_runs events ────────────────────────────────────
            es.addEventListener('festo_test_runs', (e: Event) => {
                if (!alive) return
                try {
                    const { action, record } = JSON.parse((e as MessageEvent).data) as {
                        action: string
                        record: PBRunRecord
                    }
                    if (action === 'create' && record.status === 'running') {
                        onRunStartedRef.current?.(record.run_id, record.source ?? 'external')
                    } else if (
                        action === 'update' &&
                        (record.status === 'completed' || record.status === 'error')
                    ) {
                        onRunCompletedRef.current?.(record.run_id)
                    }
                } catch { /* ignore malformed event */ }
            })

            // ── festo_system_logs events ──────────────────────────────────
            es.addEventListener('festo_system_logs', (e: Event) => {
                if (!alive) return
                try {
                    const { action, record } = JSON.parse((e as MessageEvent).data) as {
                        action: string
                        record: PBLogRecord
                    }
                    if (action !== 'create') return
                    // Only forward logs that belong to the active run
                    if (activeRunIdRef.current && record.run_id !== activeRunIdRef.current) return
                    onLogRef.current?.({
                        level: record.level,
                        message: record.message,
                        timestamp: record.timestamp,
                    }, record.run_id)
                } catch { /* ignore malformed event */ }
            })

            es.onerror = () => {
                if (!alive) return
                setConnected(false)
                es?.close()
                es = null
                // Exponential back-off is handled by the browser for SSE; use a
                // manual reconnect only if the error is permanent (stream closed).
                reconnectTimer = setTimeout(connect, 8000)
            }
        }

        connect()

        return () => {
            alive = false
            if (reconnectTimer) clearTimeout(reconnectTimer)
            es?.close()
            setConnected(false)
        }
    }, [pbUrl])

    return { connected, pbUrl }
}
