/**
 * Returns the list of valve-slot group IDs found inside the SVG's
 * top-level <g id="Valves"> container (e.g. ["Valves-2","Valves-3",...]).
 *
 * Cached per URL so repeated calls are free.
 */
import { useState, useEffect, useMemo } from 'react'

const cache = new Map<string, string[]>()
const pending = new Map<string, Promise<string[]>>()

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

function loadValveGroups(svgUrl: string): Promise<string[]> {
    const cached = cache.get(svgUrl)
    if (cached) return Promise.resolve(cached)
    const active = pending.get(svgUrl)
    if (active) return active
    const request = new Promise<string[]>(resolve => {
        fetchAndParseValveGroups(svgUrl, found => resolve(found)).then(() => resolve([]))
    }).then(found => {
        cache.set(svgUrl, found)
        pending.delete(svgUrl)
        return found
    })
    pending.set(svgUrl, request)
    return request
}

export function useValveGroups(svgUrl: string, overrideCount?: number): string[] {
    const [groups, setGroups] = useState<string[]>(() => cache.get(svgUrl) ?? [])

    // Trigger async fetch on cache miss (only setState in the async callback)
    useEffect(() => {
        if (!svgUrl) {
            setGroups([])
            return
        }
        const cached = cache.get(svgUrl)
        if (cached) {
            setGroups(cached)
            return
        }
        let cancelled = false
        void loadValveGroups(svgUrl).then(found => { if (!cancelled) setGroups(found) })
        return () => { cancelled = true }
    }, [svgUrl])

    return useMemo(() => {
        if (overrideCount !== undefined) {
            return Array.from({ length: overrideCount }, (_, i) => i === 0 ? 'Valve' : `Valve-${i + 1}`)
        }

        // Derive from cache during render — React Compiler can optimise this
        return groups
    }, [groups, overrideCount])
}
