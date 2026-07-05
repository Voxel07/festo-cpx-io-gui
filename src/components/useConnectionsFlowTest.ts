import { useMemo } from 'react'
import type { Edge } from '@xyflow/react'
import type { Topology } from '../types'
import type { ConnectionsFlowAction } from './useConnectionsFlowState'

const isM12 = (name?: string) => !!(name ?? '').includes('M12')

function portId(handleId: string): string {
    const parts = handleId.split('-')
    const known = new Set(['in', 'out', 'inout'])
    return (known.has(parts[1]) ? parts.slice(2) : parts.slice(1)).join('-')
}

async function extractErrMsg(r: Response): Promise<string> {
    try {
        const text = await r.text()
        if (text.trim()) {
            try {
                const j = JSON.parse(text)
                if (j.detail) return String(j.detail)
            } catch { /* not JSON */ }
            return text.trim().slice(0, 300)
        }
    } catch { /* unreadable */ }
    return `HTTP ${r.status}`
}

export interface TestConn {
    id: string; srcAddr: number; srcCh: string
    tgtAddr: number; tgtCh: string; label: string
    srcCPP: number; tgtCPP: number
    srcSubchannel?: number; tgtSubchannel?: number
}

export function useConnectionsFlowTest(
    ip: string | undefined,
    topology: Topology | null,
    edges: Edge[],
    outputStates: Record<string, boolean>,
    testResults: Record<string, { values?: boolean[]; value: boolean | null; error?: string }>,
    dispatch: React.Dispatch<ConnectionsFlowAction>
) {
    const testConns: TestConn[] = useMemo(() => {
        return edges.reduce<TestConn[]>((acc, e) => {
            if ((e.data as Record<string, unknown>)?.kind === 'io') {
                const d = e.data as Record<string, unknown>
                const srcMod = topology?.Topology?.find(m => String(m.Adress) === String(e.source))
                const tgtMod = topology?.Topology?.find(m => String(m.Adress) === String(e.target))
                acc.push({
                    id: e.id,
                    srcAddr: parseInt(e.source),
                    srcCh: String(d.portSrc ?? portId(String(e.sourceHandle ?? ''))),
                    tgtAddr: parseInt(e.target),
                    tgtCh: String(d.portTgt ?? portId(String(e.targetHandle ?? ''))),
                    label: typeof e.label === 'string' ? e.label : `#${e.source} → #${e.target}`,
                    srcCPP: isM12(srcMod?.Name) ? 2 : 1,
                    tgtCPP: isM12(tgtMod?.Name) ? 2 : 1,
                    srcSubchannel: typeof d.subSrc === 'number' ? d.subSrc : undefined,
                    tgtSubchannel: typeof d.subTgt === 'number' ? d.subTgt : undefined,
                })
            }
            return acc
        }, [])
    }, [edges, topology])

    async function doReadInput(conn: TestConn) {
        if (!ip) return
        try {
            const url = new URL('/io/read-input', window.location.origin)
            url.searchParams.set('ip_address', ip)
            url.searchParams.set('module_addr', String(conn.tgtAddr))
            url.searchParams.set('channel', conn.tgtCh)
            url.searchParams.set('channels_per_port', String(conn.tgtCPP))
            if (conn.tgtSubchannel !== undefined) {
                url.searchParams.set('subchannel', String(conn.tgtSubchannel))
            }

            const r = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
            if (!r.ok) {
                const errMsg = await extractErrMsg(r)
                dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: errMsg } })
                return
            }
            const d = await r.json()
            const vals: boolean[] = Array.isArray(d.values) ? d.values.map(Boolean) : [Boolean(d.value)]
            dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { values: vals, value: vals.every(Boolean) } })
        } catch (e) {
            dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: (e as Error).message } })
        }
    }

    async function toggleOutput(conn: TestConn) {
        const newVal = !(outputStates[conn.id] ?? false)
        dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: true })
        try {
            const r = await fetch('/io/set-output', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip_address: ip ?? '',
                    module_addr: conn.srcAddr,
                    channel: conn.srcCh,
                    value: newVal,
                    channels_per_port: conn.srcCPP,
                    subchannel: conn.srcSubchannel
                }),
                signal: AbortSignal.timeout(8000),
            })
            if (!r.ok) {
                const errMsg = await extractErrMsg(r)
                dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: errMsg } })
                dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
                return
            }
            dispatch({ type: 'SET_OUTPUT_STATE', edgeId: conn.id, value: newVal })
            if (newVal) {
                await doReadInput(conn)
            } else {
                const nextResults = { ...testResults }
                delete nextResults[conn.id]
                dispatch({ type: 'SET_TEST_RESULTS', results: nextResults })
            }
            dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
        } catch (e) {
            dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: (e as Error).message } })
            dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
        }
    }

    async function testAll() {
        dispatch({ type: 'SET_TEST_ALL_BUSY', busy: true })
        try {
            for (const conn of testConns) {
                dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: true })
                try {
                    const rOn = await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ip_address: ip ?? '',
                            module_addr: conn.srcAddr,
                            channel: conn.srcCh,
                            value: true,
                            channels_per_port: conn.srcCPP,
                            subchannel: conn.srcSubchannel
                        }),
                        signal: AbortSignal.timeout(8000),
                    })
                    dispatch({ type: 'SET_OUTPUT_STATE', edgeId: conn.id, value: true })
                    if (rOn.ok) {
                        await new Promise(res => setTimeout(res, 300))
                        await doReadInput(conn)
                    } else {
                        const errMsg = await extractErrMsg(rOn)
                        dispatch({ type: 'SET_TEST_RESULT', edgeId: conn.id, result: { value: null, error: errMsg } })
                    }
                    await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ip_address: ip ?? '',
                            module_addr: conn.srcAddr,
                            channel: conn.srcCh,
                            value: false,
                            channels_per_port: conn.srcCPP,
                            subchannel: conn.srcSubchannel
                        }),
                        signal: AbortSignal.timeout(8000),
                    }).catch(() => {})
                    dispatch({ type: 'SET_OUTPUT_STATE', edgeId: conn.id, value: false })
                    dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
                } catch {
                    dispatch({ type: 'SET_TEST_BUSY', edgeId: conn.id, busy: false })
                }
            }
            dispatch({ type: 'SET_TEST_ALL_BUSY', busy: false })
        } catch {
            dispatch({ type: 'SET_TEST_ALL_BUSY', busy: false })
        }
    }

    async function clearAllOutputs() {
        for (const conn of testConns) {
            if (outputStates[conn.id]) {
                try {
                    await fetch('/io/set-output', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ip_address: ip ?? '',
                            module_addr: conn.srcAddr,
                            channel: conn.srcCh,
                            value: false,
                            channels_per_port: conn.srcCPP,
                            subchannel: conn.srcSubchannel
                        }),
                    })
                } catch { }
            }
        }
        dispatch({ type: 'SET_OUTPUT_STATES', states: {} })
        dispatch({ type: 'SET_TEST_RESULTS', results: {} })
    }

    return { testConns, doReadInput, toggleOutput, testAll, clearAllOutputs }
}
