/**
 * Returns a displayable URL for the given SVG, with specified element IDs hidden.
 * When hiddenIds is empty the original URL is returned unchanged.
 * Uses DOMParser + XMLSerializer to produce a data URL so the img tag refreshes.
 */
import { useState, useEffect } from 'react'

const textCache = new Map<string, string>()

function buildDataUrl(text: string, hiddenIds: string[]): string {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    hiddenIds.forEach(id => {
        const el = doc.getElementById(id)
        if (el) el.setAttribute('style', 'display:none')
    })
    const modified = new XMLSerializer().serializeToString(doc.documentElement)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(modified)}`
}

async function fetchSvgText(url: string): Promise<string> {
    try {
        const r = await fetch(url)
        if (r.ok) return await r.text()
    } catch { /* ignore */ }
    return ''
}

export function useModifiedSvg(svgUrl: string, hiddenIds: string[]): string {
    const [, setTick] = useState(0)

    // Trigger async fetch on cache miss (only setState in the async callback)
    useEffect(() => {
        if (hiddenIds.length === 0) return
        if (textCache.has(svgUrl)) return
        fetchSvgText(svgUrl).then(text => {
            if (text) {
                textCache.set(svgUrl, text)
                setTick(t => t + 1)  // trigger re-render so cached text is picked up below
            }
        })
    }, [svgUrl, hiddenIds])

    // Derive display URL from cache during render — React Compiler can optimise this
    if (hiddenIds.length === 0) return svgUrl
    const text = textCache.get(svgUrl)
    if (!text) return svgUrl
    return buildDataUrl(text, hiddenIds)
}
