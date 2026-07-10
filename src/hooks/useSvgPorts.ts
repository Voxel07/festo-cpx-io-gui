/**
 * useSvgPorts.ts
 *
 * This hook fetches and parses module SVG files to extract the physical locations (cx, cy)
 * of connector ports (identified by 'X0', 'X1', etc.). It then derives the logical port kind
 * (input, output, or inout) based on the module's channel counts, properly mapping mixed
 * modules (like 4DI4DO) where outputs are on the bottom connectors and inputs on the top.
 */
import { useState, useEffect } from 'react'
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

            doc.querySelectorAll('g[data-name]').forEach(g => {
                const dn = g.getAttribute('data-name') ?? ''
                if (!/^X\d+$/.test(dn)) return

                // Skip groups whose immediate parent <g> has a "-" suffix (e.g. "Top_Right-2").
                // Only check the first ancestor <g>, not the root — root group IDs like
                // "CPX-AP-L-16NDI-PI" also contain hyphens but are not secondary views.
                const parent = g.parentElement
                if (parent && parent.tagName.toLowerCase() === 'g') {
                    const pid = parent.getAttribute('id') ?? ''
                    if (/-/.test(pid)) return  // skip secondary view groups
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

            // Convert to array, sort by y then x, assign sequential X0..XN
            const entries = [...gathered.entries()]
            entries.sort((a, b) => {
                const dy = a[1].cy - b[1].cy
                if (Math.abs(dy) > 0.01) return dy
                return a[1].cx - b[1].cx
            })

            entries.forEach(([dn, pos]) => {
                // Preserve the original data-name as the port id so CSS selectors
                // (#X0, #X1, …) in ModuleNode correctly target the matching SVG elements.
                // deriveKind later uses the sorted position (ioIndex), not the id,
                // so input/output assignment remains correct.
                found.push({ id: dn, cx: pos.cx, cy: pos.cy, svgKind: null })
            })
        }

        // Also search for AP cable connectors (XF10 = ap-in, XF20 = ap-out)
        doc.querySelectorAll('g[id^="XF"]').forEach(g => {
            const id = g.id
            if (id === 'XF10' || id === 'XF20') {
                const circle = g.querySelector('circle')
                if (circle) {
                    const cx = parseFloat(circle.getAttribute('cx') ?? '0') / vbW
                    const cy = parseFloat(circle.getAttribute('cy') ?? '0') / vbH
                    found.push({ id, cx, cy, svgKind: id === 'XF10' ? 'ap-in' : 'ap-out' })
                }
            }
        })
        
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
        if (!svgUrl || svgUrl.includes('Generic') || geoCache.has(svgUrl) || pending.has(svgUrl)) return
        pending.add(svgUrl)
        fetchAndParseSvg(
            svgUrl,
            (found) => {
                geoCache.set(svgUrl, found)
                setTick(t => t + 1)  // trigger re-render so cached geometry is picked up below
            },
            () => {
                if (!geoCache.has(svgUrl)) geoCache.set(svgUrl, [])
                pending.delete(svgUrl)
            }
        )
    }, [svgUrl])

    // Derive from cache during render — React Compiler can optimise this
    const raw = svgUrl ? (geoCache.get(svgUrl) ?? []) : []
    const defaultCounts: PortCounts = counts ?? { numIn: 0, numOut: 0, numInOut: 0 }
    
    let ioIndex = 0
    const numIoConnectors = raw.filter(p => p.svgKind !== 'ap-in' && p.svgKind !== 'ap-out').length
    
    return raw.map((p) => {
        let kind: PortKind
        if (p.svgKind === 'ap-in' || p.svgKind === 'ap-out') {
            kind = p.svgKind
        } else {
            kind = deriveKind(ioIndex++, p.svgKind, defaultCounts, numIoConnectors)
        }
        return {
            id:   p.id,
            cx:   p.cx,
            cy:   p.cy,
            side: p.cx < 0.5 ? Position.Left : Position.Right,
            kind,
        }
    })
}

