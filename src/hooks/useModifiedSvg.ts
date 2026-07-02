/**
 * Returns a displayable URL for the given SVG, with specified element IDs hidden.
 * When hiddenIds is empty the original URL is returned unchanged.
 * Uses DOMParser + XMLSerializer to produce a data URL so the img tag refreshes.
 */
import { useState, useEffect, useMemo } from 'react'

const textCache = new Map<string, string>()
const dataUrlCache = new Map<string, string>()

function buildDataUrl(text: string, hiddenIds: string[], numValves?: number): string {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    
    // Dynamically rebuild VMPAL SVG if requested
    if (numValves !== undefined && doc.documentElement.id.includes('VMPAL')) {
        const cutOut = doc.getElementById('Cut_out')
        if (cutOut) cutOut.remove()

        const totalWidth = 33 + numValves * 10
        const body2Width = 1 + numValves * 10

        const svgEl = doc.documentElement
        svgEl.setAttribute('width', String(totalWidth))
        svgEl.setAttribute('viewBox', `0 0 ${totalWidth} 109`)

        const body = doc.getElementById('Body')
        if (body) body.setAttribute('width', String(totalWidth))

        const body2 = doc.getElementById('Body-2')
        if (body2) body2.setAttribute('width', String(body2Width))

        const valvesGroup = doc.getElementById('Valves')
        const template = doc.getElementById('Valve')
        if (valvesGroup && template) {
            valvesGroup.innerHTML = ''
            for (let i = 0; i < numValves; i++) {
                const clone = template.cloneNode(true) as Element
                clone.id = i === 0 ? 'Valve' : `Valve-${i + 1}`
                const offsetX = i * 10
                clone.querySelectorAll('*').forEach((child, j) => {
                    if (child.id) child.id = `${child.id.split('-')[0]}-${i + 1}-${j}`
                    if (child.hasAttribute('x')) {
                        child.setAttribute('x', String(parseFloat(child.getAttribute('x')!) + offsetX))
                    }
                    if (child.hasAttribute('cx')) {
                        child.setAttribute('cx', String(parseFloat(child.getAttribute('cx')!) + offsetX))
                    }
                })
                valvesGroup.appendChild(clone)
            }
        }
    }

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

export function useModifiedSvg(svgUrl: string, hiddenIds: string[], numValves?: number): string {
    const [tick, setTick] = useState(0)
    const hiddenKey = hiddenIds.join('\u0000')

    // Trigger async fetch on cache miss (only setState in the async callback)
    useEffect(() => {
        if (hiddenIds.length === 0 && numValves === undefined) return
        if (textCache.has(svgUrl)) return
        fetchSvgText(svgUrl).then(text => {
            if (text) {
                textCache.set(svgUrl, text)
                setTick(t => t + 1)  // trigger re-render so cached text is picked up below
            }
        })
    }, [svgUrl, hiddenKey, hiddenIds.length, numValves])

    return useMemo(() => {
        // Derive display URL from cache during render — React Compiler can optimise this
        if (hiddenIds.length === 0 && numValves === undefined) return svgUrl
        const text = textCache.get(svgUrl)
        if (!text) return svgUrl

        const cacheKey = `${svgUrl}|${numValves ?? ''}|${hiddenKey}`
        const cached = dataUrlCache.get(cacheKey)
        if (cached) return cached

        const next = buildDataUrl(text, hiddenIds, numValves)
        dataUrlCache.set(cacheKey, next)
        return next
    }, [svgUrl, hiddenKey, hiddenIds, hiddenIds.length, numValves, tick])
}
