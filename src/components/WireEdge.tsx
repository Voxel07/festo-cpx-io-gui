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
import type { EdgeProps, Node } from '@xyflow/react'

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

function getDeterministicOffset(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    return (Math.abs(hash) % 7) * 6 - 18
}

function mergeIntervals(intervals: Array<{ left: number; right: number }>) {
    if (intervals.length === 0) return []
    const sorted = [...intervals].sort((a, b) => a.left - b.left)
    const merged = [sorted[0]]
    for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i]
        const last = merged[merged.length - 1]
        if (cur.left <= last.right + 2) {
            last.right = Math.max(last.right, cur.right)
        } else {
            merged.push(cur)
        }
    }
    return merged
}

function getObstacles(nodes: Node[]) {
    const obstacles: Array<{ left: number; right: number }> = []

    for (const node of nodes) {
        if (node.type === 'backplane') {
            const left = node.position.x
            const width = typeof node.style?.width === 'number'
                ? node.style.width
                : parseFloat(String(node.style?.width || 0)) || node.measured?.width || 0
            if (width > 0) {
                obstacles.push({ left, right: left + width })
            }
        } else if (node.type === 'mod' && !node.parentId) {
            const left = node.position.x
            const width = node.measured?.width || 75
            obstacles.push({ left, right: left + width })
        }
    }

    return mergeIntervals(obstacles)
}

function buildOrthPath(
    sx: number, sy: number,
    tx: number, ty: number,
    mx: number,
    Y_UP: number,
    Y_DOWN: number,
): { path: string; points: Array<{ x: number; y: number }> } {
    const pts: Array<{ x: number; y: number }> = [{ x: sx, y: sy }]

    if (sy < 150 && ty < 150) {
        pts.push({ x: sx, y: Y_UP })
        pts.push({ x: tx, y: Y_UP })
    } else if (sy >= 150 && ty >= 150) {
        pts.push({ x: sx, y: Y_DOWN })
        pts.push({ x: tx, y: Y_DOWN })
    } else if (sy < 150 && ty >= 150) {
        pts.push({ x: sx, y: Y_UP })
        pts.push({ x: mx, y: Y_UP })
        pts.push({ x: mx, y: Y_DOWN })
        pts.push({ x: tx, y: Y_DOWN })
    } else {
        pts.push({ x: sx, y: Y_DOWN })
        pts.push({ x: mx, y: Y_DOWN })
        pts.push({ x: mx, y: Y_UP })
        pts.push({ x: tx, y: Y_UP })
    }
    pts.push({ x: tx, y: ty })

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

function buildRoutedPath(
    id: string,
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
        const offset = getDeterministicOffset(id)
        const Y_UP = 20 + offset
        const Y_DOWN = 275 + offset

        const obstacles = getObstacles(nodes)

        if (obstacles.length === 0) {
            const mx = (sx + tx) / 2
            return buildOrthPath(sx, sy, tx, ty, mx, Y_UP, Y_DOWN)
        }

        const minObsX = Math.min(...obstacles.map(o => o.left))
        const maxObsX = Math.max(...obstacles.map(o => o.right))
        
        const outerLeft = minObsX - 40
        const outerRight = maxObsX + 40

        const corridors: Array<{ left: number; right: number }> = []
        corridors.push({ left: outerLeft, right: minObsX })

        for (let i = 0; i < obstacles.length - 1; i++) {
            const left = obstacles[i].right
            const right = obstacles[i + 1].left
            if (right - left >= 15) {
                corridors.push({ left, right })
            }
        }

        corridors.push({ left: maxObsX, right: outerRight })

        const idealMx = (sx + tx) / 2
        const minST = Math.min(sx, tx)
        const maxST = Math.max(sx, tx)

        let bestMx = idealMx
        let bestCost = Infinity

        for (const corridor of corridors) {
            const center = (corridor.left + corridor.right) / 2
            
            let distOutside = 0
            if (center < minST) {
                distOutside = minST - center
            } else if (center > maxST) {
                distOutside = center - maxST
            }

            const cost = Math.abs(center - idealMx) + 2 * distOutside

            if (cost < bestCost) {
                bestCost = cost
                bestMx = Math.max(corridor.left + 5, Math.min(corridor.right - 5, center + offset))
            }
        }

        const mx = bestMx
        return buildOrthPath(sx, sy, tx, ty, mx, Y_UP, Y_DOWN)
    } else {
        let cx = sx, cy = sy
        for (const wp of clean) {
            if (Math.abs(wp.x - cx) > 0.5) pts.push({ x: wp.x, y: cy })
            if (Math.abs(wp.y - cy) > 0.5) pts.push({ x: wp.x, y: wp.y })
            cx = wp.x
            cy = wp.y
        }
        if (Math.abs(tx - cx) > 0.5) pts.push({ x: tx, y: cy })
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

export function WireEdge({
    id, sourceX, sourceY, targetX, targetY,
    style, selected, data, label,
}: EdgeProps) {
    const { setEdges, getZoom, getNodes } = useReactFlow()
    const d = data as WireData | undefined

    const cornersRef = useRef<Array<{ x: number; y: number }>>([])
    const dragIdxRef = useRef(-1)
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

    const waypoints: Array<{ x: number; y: number }> = (d?.waypoints ?? []).filter(
        w => w != null && typeof w.x === 'number',
    )

    const isStraight = d?.straight ?? false
    const nodes = getNodes()

    const { path, points } = useMemo(
        () => buildRoutedPath(id, sourceX, sourceY, targetX, targetY, waypoints, nodes, isStraight),
        [id, sourceX, sourceY, targetX, targetY, waypoints, nodes, isStraight],
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
                {selected && corners.map((wp, i) => (
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
