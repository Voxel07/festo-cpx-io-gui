/**
 * WireEdge – custom IO wiring edge with waypoint-based 90° corner routing.
 *
 * Click on a segment to insert a 90° corner; drag any corner to re-route;
 * right-click a corner to remove it.  Redundant corners (same position as
 * neighbor) are automatically cleaned up.
 *
 * Waypoints are stored in ``edge.data.waypoints`` and persisted to
 * connections.jsonc.
 */
import { useCallback, useMemo, useRef, Fragment } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

const IO_COLOR = '#e65100'
const SEL_COLOR = '#ff6d00'
const WP_RADIUS = 6
const WP_HIT = 12

export type WireData = {
    kind: 'io'
    portSrc?: string
    portTgt?: string
    wireColor?: string
    waypoints?: Array<{ x: number; y: number }>
    cpOffsetX?: number
    cpOffsetY?: number
}

function buildRoutedPath(
    sx: number, sy: number,
    tx: number, ty: number,
    waypoints: Array<{ x: number; y: number }>,
): { path: string; points: Array<{ x: number; y: number }> } {
    const clean = waypoints.filter(w => w != null && typeof w.x === 'number')
    const pts: Array<{ x: number; y: number }> = [{ x: sx, y: sy }]

    if (clean.length === 0) {
        const mx = (sx + tx) / 2
        pts.push({ x: mx, y: sy })
        pts.push({ x: mx, y: ty })
    } else {
        let cx = sx, cy = sy
        for (const wp of clean) {
            if (Math.abs(wp.x - cx) > 0.5) pts.push({ x: wp.x, y: cy })
            if (Math.abs(wp.y - cy) > 0.5) pts.push({ x: wp.x, y: wp.y })
            cx = wp.x
            cy = wp.y
        }
        if (Math.abs(tx - cx) > 0.5) pts.push({ x: tx, y: cy })
    }
    pts.push({ x: tx, y: ty })

    // Dedup consecutive identical points
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

export function WireEdge({
    id, sourceX, sourceY, targetX, targetY,
    style, selected, data, label,
}: EdgeProps) {
    const { setEdges, getZoom } = useReactFlow()
    const d = data as WireData | undefined

    const cornersRef = useRef<Array<{ x: number; y: number }>>([])
    const dragIdxRef = useRef(-1)
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

    const waypoints: Array<{ x: number; y: number }> = (d?.waypoints ?? []).filter(
        w => w != null && typeof w.x === 'number',
    )

    const { path, points } = useMemo(
        () => buildRoutedPath(sourceX, sourceY, targetX, targetY, waypoints),
        [sourceX, sourceY, targetX, targetY, waypoints],
    )

    cornersRef.current = points.slice(1, -1)
    const corners = cornersRef.current

    const color = selected ? SEL_COLOR
        : (d?.wireColor ?? (typeof style?.stroke === 'string' ? (style.stroke as string) : IO_COLOR))
    const strokeWidth = selected ? 3
        : (typeof style?.strokeWidth === 'number' ? style.strokeWidth : 2)

    const onWaypointMD = useCallback((idx: number) => (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault()
        const cur = cornersRef.current[idx]
        if (!cur) return
        dragIdxRef.current = idx
        dragStartRef.current = { x: cur.x, y: cur.y }
        const sx = e.clientX, sy = e.clientY
        const onMove = (ev: MouseEvent) => {
            const z = getZoom()
            const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z
            const di = dragIdxRef.current, sp = dragStartRef.current
            setEdges(prev => prev.map(edge => {
                if (edge.id !== id) return edge
                const curWps = ((edge.data as WireData)?.waypoints ?? []).filter(
                    (w: unknown) => w != null && typeof (w as Record<string, unknown>).x === 'number',
                ) as Array<{ x: number; y: number }>
                let wps = curWps.length === 0
                    ? cornersRef.current.map(c => ({ x: c.x, y: c.y }))
                    : [...curWps]
                if (di >= 0 && di < wps.length) wps[di] = { x: sp.x + dx, y: sp.y + dy }
                return { ...edge, data: { ...edge.data, waypoints: wps } }
            }))
        }
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [id, setEdges, getZoom])

    const onWaypointCtx = useCallback((idx: number) => (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault()
        setEdges(prev => prev.map(edge => {
            if (edge.id !== id) return edge
            const wps = ((edge.data as WireData)?.waypoints ?? []).filter(
                (w: unknown) => w != null && typeof (w as Record<string, unknown>).x === 'number',
            ) as Array<{ x: number; y: number }>
            wps.splice(idx, 1)
            return { ...edge, data: { ...edge.data, waypoints: wps } }
        }))
    }, [id, setEdges])

    const onSegmentClick = useCallback((segIdx: number) => () => {
        const p1 = points[segIdx], p2 = points[segIdx + 1]
        if (!p1 || !p2) return
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
        setEdges(prev => prev.map(edge => {
            if (edge.id !== id) return edge
            const wps = ((edge.data as WireData)?.waypoints ?? []).filter(
                (w: unknown) => w != null && typeof (w as Record<string, unknown>).x === 'number',
            ) as Array<{ x: number; y: number }>
            wps.splice(segIdx, 0, { x: mx, y: my })
            return { ...edge, data: { ...edge.data, waypoints: wps } }
        }))
    }, [id, points, setEdges])

    const hitSegments = useMemo(() =>
        points.slice(0, -1).map((p1, i) => {
            const p2 = points[i + 1]
            return { d: `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`, index: i }
        }),
    [points])

    return (
        <>
            {selected && hitSegments.map(seg => (
                <path key={`hit-${seg.index}`} d={seg.d}
                    stroke="transparent" strokeWidth={16} fill="none"
                    style={{ cursor: 'copy', pointerEvents: 'all' }}
                    onClick={onSegmentClick(seg.index)}
                />
            ))}
            <BaseEdge id={id} path={path}
                style={{ stroke: color, strokeWidth, strokeLinejoin: 'round' }}
            />
            <EdgeLabelRenderer>
                {label && (
                    <div style={{
                        position: 'absolute',
                        transform: `translate(-50%, calc(-100% - 4px)) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`,
                        fontSize: 9, color: '#888', whiteSpace: 'nowrap',
                        pointerEvents: 'none', background: 'rgba(255,255,255,0.85)',
                        padding: '1px 4px', borderRadius: 3,
                    }}>
                        {label}
                    </div>
                )}
                {corners.map((wp, i) => (
                    <Fragment key={`wp-${i}`}>
                        <div onMouseDown={onWaypointMD(i)} onContextMenu={onWaypointCtx(i)}
                            title="Drag to move · Right-click to remove"
                            style={{
                                position: 'absolute',
                                transform: `translate(-50%,-50%) translate(${wp.x}px,${wp.y}px)`,
                                width: WP_HIT * 2, height: WP_HIT * 2,
                                cursor: 'grab', zIndex: 2000, pointerEvents: 'all',
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            transform: `translate(-50%,-50%) translate(${wp.x}px,${wp.y}px)`,
                            width: WP_RADIUS * 2, height: WP_RADIUS * 2,
                            borderRadius: '50%',
                            background: selected ? SEL_COLOR : color,
                            border: '2px solid #fff',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                            pointerEvents: 'none', zIndex: 2001,
                        }} />
                    </Fragment>
                ))}
            </EdgeLabelRenderer>
        </>
    )
}
