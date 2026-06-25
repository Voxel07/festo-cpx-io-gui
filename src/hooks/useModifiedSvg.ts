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

export function useModifiedSvg(svgUrl: string, hiddenIds: string[]): string {
    const [displayUrl, setDisplayUrl] = useState(svgUrl)

    const key = svgUrl + '|' + hiddenIds.join(',')

    useEffect(() => {
        if (hiddenIds.length === 0) { setDisplayUrl(svgUrl); return }

        const apply = (text: string) => setDisplayUrl(buildDataUrl(text, hiddenIds))

        const cached = textCache.get(svgUrl)
        if (cached) { apply(cached); return }

        fetch(svgUrl)
            .then(r => (r.ok ? r.text() : ''))
            .then(text => {
                if (text) { textCache.set(svgUrl, text); apply(text) }
            })
            .catch(() => {/* keep original URL */})
    }, [key])   // eslint-disable-line react-hooks/exhaustive-deps

    return displayUrl
}
