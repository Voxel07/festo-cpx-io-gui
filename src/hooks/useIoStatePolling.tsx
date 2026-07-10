import { createContext, useContext, useEffect, useState } from 'react'

export interface ModuleIoState {
    inputs: boolean[]
    outputs: boolean[]
    inouts: boolean[]
}

export type AllIoStates = Record<number, ModuleIoState>

const IoStateContext = createContext<AllIoStates>({})

export function useLiveIoState() {
    return useContext(IoStateContext)
}

interface Props {
    children: React.ReactNode
    ipAddress?: string | null
    intervalMs?: number
    isConnected?: boolean
}

export function IoStateProvider({ children, ipAddress, intervalMs = 500, isConnected = false }: Props) {
    const [states, setStates] = useState<AllIoStates>({})

    useEffect(() => {
        if (!ipAddress || !isConnected) {
            setStates({})
            return
        }

        let cancelled = false
        const poll = async () => {
            if (cancelled) return
            try {
                const r = await fetch(`/io/read-all?ip_address=${encodeURIComponent(ipAddress)}`)
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
                setTimeout(poll, intervalMs)
            }
        }

        poll()

        return () => {
            cancelled = true
        }
    }, [ipAddress, intervalMs, isConnected])

    return (
        <IoStateContext.Provider value={states}>
            {children}
        </IoStateContext.Provider>
    )
}
