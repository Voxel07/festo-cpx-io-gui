/**
 * Returns the list of valve-slot group IDs found inside the SVG's
 * top-level <g id="Valves"> container (e.g. ["Valves-2","Valves-3",...]).
 *
 * Cached per URL so repeated calls are free.
 */
import { useState, useEffect } from 'react'

const cache = new Map<string, string[]>()

async function fetchAndParseValveGroups(
    svgUrl: string, 
    onSuccess: (found: string[]) => void
) {
    try {
        const r = await fetch(svgUrl)
        if (!r.ok) return
        const text = await r.text()
        if (!text) return
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        const container = doc.querySelector('g[id="Valves"]')
        if (!container) {
            onSuccess([])
            return
        }
        const found: string[] = []
        container.querySelectorAll(':scope > g[id]').forEach(g => {
            if (g.id) found.push(g.id)
        })
        onSuccess(found)
    } catch {
        // ignore
    }
}

export function useValveGroups(svgUrl: string, overrideCount?: number): string[] {
    const [, setTick] = useState(0)

    // Trigger async fetch on cache miss (only setState in the async callback)
    useEffect(() => {
        if (!svgUrl || cache.has(svgUrl)) return
        fetchAndParseValveGroups(svgUrl, (found) => {
            cache.set(svgUrl, found)
            setTick(t => t + 1)  // trigger re-render so cached groups are picked up below
        })
    }, [svgUrl])

    if (overrideCount !== undefined) {
        return Array.from({ length: overrideCount }, (_, i) => i === 0 ? 'Valve' : `Valve-${i + 1}`)
    }

    // Derive from cache during render — React Compiler can optimise this
    return svgUrl ? (cache.get(svgUrl) ?? []) : []
}
