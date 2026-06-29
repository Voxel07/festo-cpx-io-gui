import { useState, useEffect } from 'react'
import { Position } from '@xyflow/react'

export type PortKind = 'in' | 'out' | 'inout'

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
function deriveKind(portIndex: number, svgKind: PortKind | null, counts: PortCounts): PortKind {
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
    const outStart = Math.round(inFraction * total)
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
    return raw.map((p, i) => ({
        id:   p.id,
        cx:   p.cx,
        cy:   p.cy,
        side: p.cx < 0.5 ? Position.Left : Position.Right,
        kind: deriveKind(i, p.svgKind, defaultCounts),
    }))
}

