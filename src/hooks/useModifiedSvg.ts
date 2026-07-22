/**
 * Returns a displayable URL for the given SVG, with specified element IDs hidden.
 * When hiddenIds is empty the original URL is returned unchanged.
 * Uses DOMParser + XMLSerializer to produce a data URL so the img tag refreshes.
 */
import { useState, useEffect } from 'react'

const textCache = new Map<string, string>()
const dataUrlCache = new Map<string, string>()
const textPromises = new Map<string, Promise<string>>()

export function getDynamicSvgWidth(svgUrl: string, numValves?: number): number | undefined {
    if (numValves === undefined) return undefined
    const upperUrl = svgUrl.toUpperCase()
    if (upperUrl.includes('VABX-A-P-EL-E12-API')) return 63 + numValves * 11
    if (upperUrl.includes('VMPAL')) return 33 + numValves * 10
    if (upperUrl.includes('VABA-S6-1-X5')) return 72 + numValves * 17
    if (upperUrl.includes('VABA')) return 45 + numValves * 17
    if (upperUrl.includes('VAEM')) return 55 + numValves * 10
    return undefined
}

function buildSvgText(text: string, hiddenIds: string[], numValves?: number, svgUrl?: string): string {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    
    // Dynamically rebuild SVG if requested
    if (numValves !== undefined) {
        let totalWidth = 0;
        let body2Width = 0;
        let pitch = 0;
        let isDynamic = false;
        let resizeBody = true;

        const isVMPAL = svgUrl?.includes('VMPAL') || doc.documentElement.id.includes('VMPAL')
        const isVABA_X5 = svgUrl?.includes('VABA-S6-1-X5')
        const isVABA = svgUrl?.includes('VABA') && !isVABA_X5
        const isVAEM = svgUrl?.includes('VAEM') || doc.documentElement.id.includes('VAEM')
        const isVabxParallelApi = svgUrl?.toUpperCase().includes('VABX-A-P-EL-E12-API')
            || doc.documentElement.id.toUpperCase().includes('VABX-A-P-EL-E12-API')

        if (isVabxParallelApi) {
            totalWidth = 63 + numValves * 11
            pitch = 11
            isDynamic = true
            resizeBody = false
        } else if (isVMPAL) {
            totalWidth = 33 + numValves * 10
            body2Width = 1 + numValves * 10
            pitch = 10
            isDynamic = true
        } else if (isVABA_X5) {
            totalWidth = 72 + numValves * 17
            pitch = 17
            isDynamic = true
            resizeBody = false // VABA-X5 body stays 72
        } else if (isVABA) {
            totalWidth = 45 + numValves * 17
            body2Width = numValves * 17
            pitch = 17
            isDynamic = true
        } else if (isVAEM) {
            totalWidth = 45 + numValves * 10 + 10
            body2Width = 1 + numValves * 10
            pitch = 10
            isDynamic = true
        }

        if (isDynamic) {
            const cutOut = doc.getElementById('Cut_out')
            if (cutOut) cutOut.remove()

            if (isVabxParallelApi) {
                const originalValveCount = 8
                const endplateOffset = (numValves - originalValveCount) * pitch
                const base = doc.getElementById('Base')
                base?.setAttribute('width', String(totalWidth))
                for (const id of ['Right_Endplate', 'Festo_Logo']) {
                    const element = doc.getElementById(id)
                    if (element) element.setAttribute('transform', `translate(${endplateOffset} 0)`)
                }

                const wrappers = Array.from(doc.querySelectorAll('g[id^="VTUX_Valves_Size_10"]'))
                const legacyValves = wrappers.flatMap(wrapper =>
                    Array.from(wrapper.children).filter(child => child.tagName.toLowerCase() === 'g'),
                )
                const minX = (group: Element) => Math.min(...Array.from(group.querySelectorAll('[x], [cx]')).map(element => {
                    const raw = element.getAttribute('x') ?? element.getAttribute('cx') ?? ''
                    const value = Number.parseFloat(raw)
                    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
                }))
                legacyValves.sort((a, b) => minX(a) - minX(b))
                const firstWrapper = wrappers[0]
                const template = legacyValves[0]
                if (firstWrapper?.parentNode && template) {
                    const valvesGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
                    valvesGroup.id = 'Valves'
                    const canonicalTemplate = template.cloneNode(true) as Element
                    canonicalTemplate.id = 'Valve'
                    valvesGroup.appendChild(canonicalTemplate)
                    firstWrapper.parentNode.insertBefore(valvesGroup, firstWrapper)
                    wrappers.forEach(wrapper => wrapper.remove())
                }
            }

            const svgEl = doc.documentElement
            const currentViewBox = svgEl.getAttribute('viewBox') || '0 0 100 100'
            const currentHeight = currentViewBox.split(' ')[3] || '100'
            svgEl.setAttribute('width', String(totalWidth))
            svgEl.setAttribute('viewBox', `0 0 ${totalWidth} ${currentHeight}`)

            if (resizeBody) {
                const body = doc.getElementById('Body')
                if (body) {
                    if (body.tagName.toLowerCase() === 'path') {
                        body.setAttribute('d', `M0,0H${totalWidth}V100H0Z`)
                    } else {
                        body.setAttribute('width', String(totalWidth))
                    }
                }

                const body2 = doc.getElementById('Body-2')
                if (body2) {
                    if (body2.tagName.toLowerCase() === 'path') {
                        body2.setAttribute('d', `M.088,0h${body2Width}V100h-${body2Width}Z`)
                    } else {
                        body2.setAttribute('width', String(body2Width))
                    }
                }
            }

            const valvesGroup = doc.getElementById('Valves')
            const template = doc.getElementById('Valve')
            if (valvesGroup && template) {
                valvesGroup.innerHTML = ''
                for (let i = 0; i < numValves; i++) {
                    const clone = template.cloneNode(true) as Element
                    clone.id = i === 0 ? 'Valve' : `Valve-${i + 1}`
                    const offsetX = i * pitch
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
    }

    hiddenIds.forEach(id => {
        const el = doc.getElementById(id)
        if (el) el.setAttribute('style', 'display:none')
    })
    return new XMLSerializer().serializeToString(doc.documentElement)
}

async function fetchSvgText(url: string): Promise<string> {
    const cached = textCache.get(url)
    if (cached) return cached
    const pending = textPromises.get(url)
    if (pending) return pending
    const request = (async () => {
    try {
        const r = await fetch(url)
        if (r.ok) {
            const text = await r.text()
            if (text) textCache.set(url, text)
            return text
        }
    } catch { /* ignore */ }
    return ''
    })().finally(() => textPromises.delete(url))
    textPromises.set(url, request)
    return request
}

export function useModifiedSvgText(svgUrl: string, hiddenIds: string[], numValves?: number): string {
    const [svgText, setSvgText] = useState<string>('')
    const hiddenKey = hiddenIds.join('\u0000')

    useEffect(() => {
        let cancelled = false
        const cleanup = () => {
            cancelled = true
        }
        if (!svgUrl) return cleanup
        const currentHiddenIds = hiddenKey ? hiddenKey.split('\u0000') : []
        if (currentHiddenIds.length === 0 && numValves === undefined) {
            // Just use the raw fetched text directly if no modifications are needed
            const cachedText = textCache.get(svgUrl)
            if (cachedText) {
                queueMicrotask(() => { if (!cancelled) setSvgText(cachedText) })
                return cleanup
            }
            fetchSvgText(svgUrl).then(fetchedText => {
                if (fetchedText) {
                    textCache.set(svgUrl, fetchedText)
                    if (!cancelled) setSvgText(fetchedText)
                }
            })
            return cleanup
        }

        const cacheKey = `${svgUrl}|${numValves ?? ''}|${hiddenKey}`
        const cached = dataUrlCache.get(cacheKey)
        if (cached) {
            queueMicrotask(() => { if (!cancelled) setSvgText(cached) })
            return cleanup
        }

        const text = textCache.get(svgUrl)
        if (!text) {
            fetchSvgText(svgUrl).then(fetchedText => {
                if (fetchedText && !cancelled) {
                    textCache.set(svgUrl, fetchedText)
                    const next = buildSvgText(fetchedText, currentHiddenIds, numValves, svgUrl)
                    dataUrlCache.set(cacheKey, next)
                    setSvgText(next)
                }
            })
            return cleanup
        }

        const next = buildSvgText(text, currentHiddenIds, numValves, svgUrl)
        dataUrlCache.set(cacheKey, next)
        queueMicrotask(() => { if (!cancelled) setSvgText(next) })

        return cleanup
    }, [svgUrl, hiddenKey, numValves])

    return svgText
}

export function useModifiedSvg(svgUrl: string, hiddenIds: string[], numValves?: number): string {
    const text = useModifiedSvgText(svgUrl, hiddenIds, numValves)
    if (!text) return ''
    try {
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`
    } catch {
        return ''
    }
}
