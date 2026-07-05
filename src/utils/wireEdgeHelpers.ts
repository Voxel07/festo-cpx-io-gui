import type { Node } from '@xyflow/react'
import { findSmartPath } from './routing'

export const IO_COLOR = '#e65100'
export const SEL_COLOR = '#ff6d00'
export const WP_RADIUS = 5
export const WP_HIT = 12

export const LABEL_TEXT_BASE: React.CSSProperties = {
    fontSize: 9,
    whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.9)',
    padding: '2px 6px',
    borderRadius: 4,
}

export const BUTTON_STYLE: React.CSSProperties = {
    pointerEvents: 'all',
    background: '#d84315',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    transition: 'all 0.2s ease',
    padding: 0,
}

export const WP_BASE_STYLE: React.CSSProperties = {
    position: 'absolute',
    width: WP_RADIUS * 2,
    height: WP_RADIUS * 2,
    borderRadius: '50%',
    border: '2px solid #fff',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
    zIndex: 2001,
}

export type WireData = {
    kind: 'io'
    portSrc?: string
    portTgt?: string
    wireColor?: string
    waypoints?: Array<{ x: number; y: number }>
    straight?: boolean
    cpOffsetX?: number
    cpOffsetY?: number
}

export function buildRoutedPath(
    _id: string,
    sx: number, sy: number,
    tx: number, ty: number,
    waypoints: Array<{ x: number; y: number }>,
    nodes: Node[],
    straight: boolean = false,
): { path: string; points: Array<{ x: number; y: number }> } {
    const clean = waypoints.filter(w => w != null && typeof w.x === 'number')
    const pts: Array<{ x: number; y: number }> = [{ x: sx, y: sy }]

    if (straight) {
        pts.push({ x: tx, y: ty })
    } else if (clean.length === 0) {
        const smartPoints = findSmartPath(sx, sy, tx, ty, nodes)
        for (let i = 1; i < smartPoints.length; i++) {
            pts.push(smartPoints[i])
        }
    } else {
        // Manual waypoints are literal corner positions — use them directly.
        // This guarantees a 1:1 mapping between visual corners and waypoint indices.
        for (const wp of clean) {
            pts.push({ x: wp.x, y: wp.y })
        }
        pts.push({ x: tx, y: ty })
    }

    const deduped: Array<{ x: number; y: number }> = []
    for (const p of pts) {
        const last = deduped[deduped.length - 1]
        if (!last || Math.abs(p.x - last.x) > 0.5 || Math.abs(p.y - last.y) > 0.5) {
            deduped.push(p)
        }
    }
    if (deduped.length < 2) deduped.push({ x: tx, y: ty })

    const path = deduped.map((p, i) =>
        i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`,
    ).join(' ')

    return { path, points: deduped }
}

/** Read fresh waypoints from edge state - avoids stale closures */
export function readWaypoints(edgeData: unknown): Array<{ x: number; y: number }> {
    const d = edgeData as Record<string, unknown> | undefined
    const raw = (d?.waypoints ?? []) as Array<unknown>
    return raw.filter(
        (w): w is { x: number; y: number } => w != null && typeof (w as any).x === 'number',
    )
}
