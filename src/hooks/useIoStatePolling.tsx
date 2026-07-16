import { useEffect, useState } from 'react'
import { IoStateContext } from './ioStateContext'
import type { AllIoStates, ModuleIoState } from './ioStateContext'

interface Props {
    children: React.ReactNode
    ipAddress?: string | null
    intervalMs?: number
    isConnected?: boolean
    paused?: boolean
}

export function IoStateProvider({ children, ipAddress, intervalMs = 500, isConnected = false, paused = false }: Props) {
    const [states, setStates] = useState<AllIoStates>({})

    useEffect(() => {
        if (!ipAddress || !isConnected || paused) {
            setStates({})
            return
        }

        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | null = null
        let controller: AbortController | null = null
        const poll = async () => {
            if (cancelled) return
            controller = new AbortController()
            try {
                const r = await fetch(`/io/read-all?ip_address=${encodeURIComponent(ipAddress)}`, { signal: controller.signal })
                if (r.ok) {
                    const data = await r.json()
                    // API returns JSON with string keys (e.g. "0", "1") since
                    // Python dicts with int keys become string-keyed in JSON.
                    // Convert to numeric keys so liveState[mod.Adress] works.
                    const parsed: AllIoStates = {}
                    for (const [k, v] of Object.entries(data)) {
                        parsed[Number(k)] = v as ModuleIoState
                    }
                    if (!cancelled) setStates(parsed)
                }
            } catch {
                // ignore network errors during polling
            }
            if (!cancelled) {
                timer = setTimeout(poll, intervalMs)
            }
        }

        poll()

        return () => {
            cancelled = true
            controller?.abort()
            if (timer) clearTimeout(timer)
        }
    }, [ipAddress, intervalMs, isConnected, paused])

    return (
        <IoStateContext.Provider value={states}>
            {children}
        </IoStateContext.Provider>
    )
}
