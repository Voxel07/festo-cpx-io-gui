/**
 * Returns a displayable URL for the given SVG, with specified element IDs hidden.
 * When hiddenIds is empty the original URL is returned unchanged.
 * Uses DOMParser + XMLSerializer to produce a data URL so the img tag refreshes.
 */
import { useState, useEffect } from 'react'

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
    const [displayUrl, setDisplayUrl] = useState(svgUrl)
    const hiddenKey = hiddenIds.join('\u0000')

    useEffect(() => {
        if (hiddenIds.length === 0 && numValves === undefined) {
            setDisplayUrl(svgUrl)
            return
        }

        let cancelled = false
        const cacheKey = `${svgUrl}|${numValves ?? ''}|${hiddenKey}`
        const cached = dataUrlCache.get(cacheKey)
        if (cached) {
            setDisplayUrl(cached)
            return
        }

        const text = textCache.get(svgUrl)
        if (!text) {
            fetchSvgText(svgUrl).then(fetchedText => {
                if (fetchedText && !cancelled) {
                    textCache.set(svgUrl, fetchedText)
                    // Trigger next effect run by setting displayUrl to fallback, 
                    // or just let a re-render handle it if it was tied to state.
                    // Actually, setting displayUrl to fallback is fine, but we can also manually call the builder here.
                    void setTimeout(() => {
                        const next = buildDataUrl(fetchedText, hiddenIds, numValves)
                        dataUrlCache.set(cacheKey, next)
                        if (!cancelled) setDisplayUrl(next)
                    }, 0)
                }
            })
            return
        }

        // We have text, build async so we don't block the UI thread during React render
        const timer = setTimeout(() => {
            const next = buildDataUrl(text, hiddenIds, numValves)
            dataUrlCache.set(cacheKey, next)
            if (!cancelled) setDisplayUrl(next)
        }, 0)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [svgUrl, hiddenKey, hiddenIds.length, numValves])

    return displayUrl
}
