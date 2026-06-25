/**
 * Returns the list of valve-slot group IDs found inside the SVG's
 * top-level <g id="Valves"> container (e.g. ["Valves-2","Valves-3",...]).
 *
 * Cached per URL so repeated calls are free.
 */
import { useState, useEffect } from 'react'

const cache = new Map<string, string[]>()

export function useValveGroups(svgUrl: string): string[] {
    const [groups, setGroups] = useState<string[]>(() => cache.get(svgUrl) ?? [])

    useEffect(() => {
        if (!svgUrl) return
        const cached = cache.get(svgUrl)
        if (cached) { setGroups(cached); return }

        fetch(svgUrl)
            .then(r => (r.ok ? r.text() : ''))
            .then(text => {
                if (!text) return
                const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
                const container = doc.querySelector('g[id="Valves"]')
                if (!container) { cache.set(svgUrl, []); return }
                const found: string[] = []
                container.querySelectorAll(':scope > g[id]').forEach(g => {
                    if (g.id) found.push(g.id)
                })
                cache.set(svgUrl, found)
                setGroups(found)
            })
            .catch(() => cache.set(svgUrl, []))
    }, [svgUrl])

    return groups
}
