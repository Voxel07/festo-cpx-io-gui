/**
 * useSvgPorts.ts
 *
 * This hook fetches and parses module SVG files to extract the physical locations (cx, cy)
 * of connector ports (identified by 'X0', 'X1', etc.). It then derives the logical port kind
 * (input, output, or inout) based on the module's channel counts, properly mapping mixed
 * modules (like 4DI4DO) where outputs are on the bottom connectors and inputs on the top.
 */
import { useState, useEffect, useMemo } from 'react'
import { Position } from '@xyflow/react'

export type PortKind = 'in' | 'out' | 'inout' | 'ap-in' | 'ap-out'

export interface SvgPort {
    id: string         // 'X0', 'X1', ...
    cx: number         // 0-1 fraction of viewBox width
    cy: number         // 0-1 fraction of viewBox height
    /** Which side the port is on – drives edge routing direction */
    side: Position
    kind: PortKind
}

export interface PortCounts {
    numIn:    number
    numOut:   number
    numInOut: number
}

/**
 * Derive a per-port kind array from the module's channel counts
 * (NumOfOutputs, NumOfInputs, NumOfInOuts from topology.jsonc).
 *
 * Convention (matches Festo connector numbering):
 *   - Pure input module  → all ports 'in'
 *   - Pure output module → all ports 'out'
 *   - inout module       → all ports 'inout'
 *   - Mixed (DI+DO)      → first numOut ports are 'out', next numIn are 'in'
 *     (DO connectors are physically at the bottom in Festo convention)
 *
 * SVG data-kind attributes override this if present.
 */
function deriveKind(portIndex: number, svgKind: PortKind | null, counts: PortCounts, numConnectors: number): PortKind {
    // Explicit SVG annotation wins
    if (svgKind !== null) return svgKind

    const { numIn, numOut, numInOut } = counts
    const total = numIn + numOut + numInOut

    if (numInOut > 0 && numIn === 0 && numOut === 0) return 'inout'
    if (numOut === 0 && numInOut === 0) return 'in'
    if (numIn === 0 && numInOut === 0) return 'out'

    // Mixed: assign kinds by count, spread evenly across total connectors
    // Each M12-5P connector carries 2 channels; we assign by sorted port index.
    const inFraction  = numIn  / total
    // Ports are sorted X0…XN; outputs take the last slots (bottom connectors)
    const outStart = Math.round(inFraction * numConnectors)
    if (portIndex >= outStart) return 'out'
    return 'in'
}

// URL-keyed geometry cache (kind is NOT cached – depends on module counts)
const geoCache   = new Map<string, Array<{ id: string; cx: number; cy: number; svgKind: PortKind | null }>>()
const pending    = new Set<string>()
const subscribers = new Map<string, Set<() => void>>()
const EMPTY_GEO: Array<{ id: string; cx: number; cy: number; svgKind: PortKind | null }> = []

async function fetchAndParseSvg(
    svgUrl: string, 
    onSuccess: (found: Array<{ id: string; cx: number; cy: number; svgKind: PortKind | null }>) => void,
    onFinish: () => void
) {
    try {
        const r = await fetch(svgUrl)
        if (!r.ok) {
            onFinish()
            return
        }
        const text = await r.text()
        if (!text) {
            onFinish()
            return
        }
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        const svgEl = doc.querySelector('svg')
        if (!svgEl) {
            onFinish()
            return
        }

        const vb = (svgEl.getAttribute('viewBox') ?? '0 0 50 107')
            .split(/[\s,]+/).map(Number)
        const vbW = vb[2] || 50
        const vbH = vb[3] || 107

        const found: Array<{ id: string; cx: number; cy: number; svgKind: PortKind | null }> = []

        // ── A-series / circle-based connectors (X0, X1, ... as <circle> elements) ──
        doc.querySelectorAll('circle[id]').forEach(c => {
            if (/^X\d+$/.test(c.id)) {
                const cx = parseFloat(c.getAttribute('cx') ?? '0') / vbW
                const cy = parseFloat(c.getAttribute('cy') ?? '0') / vbH
                const raw = c.getAttribute('data-kind')
                const svgKind: PortKind | null =
                    raw === 'out' ? 'out' :
                    raw === 'in'  ? 'in'  :
                    raw === 'inout' ? 'inout' : null
                found.push({ id: c.id, cx, cy, svgKind })
            }
        })

        // ── L-series / rect-based connectors (X0, X1, ... as <g> elements with <rect>) ──
        // Only collect from primary connector groups (parents whose IDs don't have "-" suffix)
        // to avoid collecting duplicate representations of the same connectors.
        if (found.length === 0) {
            const gathered: Map<string, { cx: number; cy: number; parentY: number }> = new Map()

            const isApL = svgUrl.includes('AP-L')
            doc.querySelectorAll('g[data-name]').forEach(g => {
                const dn = g.getAttribute('data-name') ?? ''
                
                // For AP-L modules, the IO connectors are specifically Xn-3, Xn-5, Xn-7, Xn-9
                if (isApL) {
                    if (!/^X\d+-(3|5|7|9)$/.test(dn)) return
                } else {
                    if (!/^X\d+$/.test(dn)) return
                }

                // Skip groups whose immediate parent <g> has a "-" suffix (e.g. "Top_Right-2").
                // Only check the first ancestor <g>, not the root — root group IDs like
                // "CPX-AP-L-16NDI-PI" also contain hyphens but are not secondary views.
                if (!isApL) {
                    const parent = g.parentElement
                    if (parent && parent.tagName.toLowerCase() === 'g') {
                        const pid = parent.getAttribute('id') ?? ''
                        if (/-/.test(pid)) return  // skip secondary view groups
                    }
                }

                const rect = g.querySelector('rect[stroke="none"]') ?? g.querySelector('rect')
                if (!rect) return

                const rx = parseFloat(rect.getAttribute('x') ?? '0')
                const ry = parseFloat(rect.getAttribute('y') ?? '0')
                const rw = parseFloat(rect.getAttribute('width') ?? '3')
                const rh = parseFloat(rect.getAttribute('height') ?? '6')
                const cx = (rx + rw / 2) / vbW
                const cy = (ry + rh / 2) / vbH

                gathered.set(dn, { cx, cy, parentY: ry })
            })

            // Convert to array, sort by y then x
            const entries = [...gathered.entries()]
            entries.sort((a, b) => {
                const dy = a[1].cy - b[1].cy
                if (Math.abs(dy) > 0.01) return dy
                return a[1].cx - b[1].cx
            })

            entries.forEach(([dn, pos]) => {
                // Preserve the original data-name as the port id so CSS selectors
                // (#X0, #X0-3, …) in ModuleNode correctly target the matching SVG elements.
                let explicitKind: PortKind | null = null
                if (svgUrl.includes('16NDI8NDO')) {
                    if (dn.endsWith('-9') || dn.endsWith('-7')) explicitKind = 'out'
                    else if (dn.endsWith('-5')) explicitKind = 'in'
                }
                found.push({ id: dn, cx: pos.cx, cy: pos.cy, svgKind: explicitKind })
            })
        }

        // Also search for AP cable connectors (XF10/X10 = ap-in, XF20/X20 = ap-out)
        // Skip for VMPAL since its SVG width is dynamically resized in the UI.
        if (!svgUrl.includes('VMPAL')) {
            doc.querySelectorAll('g[id^="XF"], g[id="X10"], g[id="X20"]').forEach(g => {
                const id = g.id
                const isL = svgUrl.includes('AP-L')
                if (id === 'XF10' || id === 'XF20' || (isL && (id === 'X10' || id === 'X20'))) {
                    const isApIn = id === 'XF10' || id === 'X10'
                    const circle = g.querySelector('circle')
                    const rect = g.querySelector('rect')
                    if (circle) {
                        const cx = parseFloat(circle.getAttribute('cx') ?? '0') / vbW
                        const cy = parseFloat(circle.getAttribute('cy') ?? '0') / vbH
                        found.push({ id, cx, cy, svgKind: isApIn ? 'ap-in' : 'ap-out' })
                    } else if (rect) {
                        const rx = parseFloat(rect.getAttribute('x') ?? '0')
                        const ry = parseFloat(rect.getAttribute('y') ?? '0')
                        const rw = parseFloat(rect.getAttribute('width') ?? '0')
                        const rh = parseFloat(rect.getAttribute('height') ?? '0')
                        const cx = (rx + rw / 2) / vbW
                        const cy = (ry + rh / 2) / vbH
                        found.push({ id, cx, cy, svgKind: isApIn ? 'ap-in' : 'ap-out' })
                    }
                }
            })
        }
        
        // Sort top-to-bottom so portIndex 0 is the physically highest connector
        found.sort((a, b) => a.cy - b.cy)
        onSuccess(found)
    } catch {
        // keep empty
    }
    onFinish()
}

export function useSvgPorts(svgUrl: string, counts?: PortCounts): SvgPort[] {
    const [, setTick] = useState(0)

    // Trigger async fetch on cache miss (only setState in the async callback)
    useEffect(() => {
        if (!svgUrl || svgUrl.includes('Generic')) return
        const notify = () => setTick(t => t + 1)
        const listeners = subscribers.get(svgUrl) ?? new Set<() => void>()
        listeners.add(notify)
        subscribers.set(svgUrl, listeners)

        if (!geoCache.has(svgUrl) && !pending.has(svgUrl)) {
            pending.add(svgUrl)
            fetchAndParseSvg(
                svgUrl,
                found => { geoCache.set(svgUrl, found) },
                () => {
                    if (!geoCache.has(svgUrl)) geoCache.set(svgUrl, [])
                    pending.delete(svgUrl)
                    subscribers.get(svgUrl)?.forEach(listener => listener())
                },
            )
        }
        return () => {
            const current = subscribers.get(svgUrl)
            current?.delete(notify)
            if (current?.size === 0) subscribers.delete(svgUrl)
        }
    }, [svgUrl])

    // Derive from cache during render — React Compiler can optimise this
    const raw = svgUrl ? (geoCache.get(svgUrl) ?? EMPTY_GEO) : EMPTY_GEO
    const numIn = counts?.numIn ?? 0
    const numOut = counts?.numOut ?? 0
    const numInOut = counts?.numInOut ?? 0

    return useMemo(() => {
        let ioIndex = 0
        const numIoConnectors = raw.filter(p => p.svgKind !== 'ap-in' && p.svgKind !== 'ap-out').length

        return raw.map((p) => {
            let kind: PortKind
            if (p.svgKind === 'ap-in' || p.svgKind === 'ap-out') {
                kind = p.svgKind
            } else {
                kind = deriveKind(ioIndex++, p.svgKind, { numIn, numOut, numInOut }, numIoConnectors)
            }
            return {
                id: p.id,
                cx: p.cx,
                cy: p.cy,
                side: p.cx < 0.5 ? Position.Left : Position.Right,
                kind,
            }
        })
    }, [raw, numIn, numOut, numInOut])
}

