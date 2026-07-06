/**
 * WireEdge – custom IO wiring edge with waypoint-based 90° corner routing.
 *
 * - Click on a segment (when selected) to insert a new corner waypoint.
 * - Drag any corner dot to re-route the cable.
 * - Right-click a corner dot to remove it.
 * - Click the ✕ button to delete the entire connection.
 *
 * The first interaction on an auto-routed cable snapshots the visual path
 * into manual waypoints so the user can freely edit without the cable
 * snapping back to the auto-generated path.
 *
 * Waypoints are stored in ``edge.data.waypoints`` and persisted to
 * connections.jsonc.
 */
import { useRef, useEffect, useMemo, useCallback, useContext } from 'react'
import { BaseEdge, useReactFlow, Position } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { AlertsContext } from '../utils/AlertsContext'
import { buildRoutedPath, readWaypoints, IO_COLOR, SEL_COLOR } from '../utils/wireEdgeHelpers'
import type { WireData } from '../utils/wireEdgeHelpers'
import { WireEdgeLabel } from './WireEdgeLabel'

export function WireEdge({
    id, source, target, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    selected, data, label,
}: EdgeProps) {
    const { setEdges, getZoom, getNodes, getEdges } = useReactFlow()
    const alerts = useContext(AlertsContext)
    const d = data as WireData | undefined

    const waypoints: Array<{ x: number; y: number }> = (d?.waypoints ?? []).filter(
        (w): w is { x: number; y: number } => w != null && typeof w.x === 'number',
    )
    const hasWaypoints = waypoints.length > 0

    const isStraightProp = d?.straight ?? false

    // Detect adjacent AP-A modules — these get straight lines with no stubs
    let hideLabel = false
    let isAdjacent = false
    const srcAddr = parseInt(source, 10)
    const tgtAddr = parseInt(target, 10)
    const nodes = getNodes()
    if (!isNaN(srcAddr) && !isNaN(tgtAddr)) {
        if (Math.abs(srcAddr - tgtAddr) === 1) {
            const srcNode = nodes.find(n => n.id === source)
            const tgtNode = nodes.find(n => n.id === target)
            if (srcNode && tgtNode) {
                const isSrcApa = (srcNode.data as any).mod?.Name?.startsWith('CPX-AP-A')
                const isTgtApa = (tgtNode.data as any).mod?.Name?.startsWith('CPX-AP-A')
                if (isSrcApa && isTgtApa) {
                    isAdjacent = true
                    hideLabel = true
                }
            }
        }
    }

    // ── Build the routed path ─────────────────────────────────────────────────
    const usesStubs = !isStraightProp && !isAdjacent
    const waypointsStr = JSON.stringify(waypoints)

    const { routedPoints } = useMemo(() => {
        if (!usesStubs) {
            return {
                routedPoints: buildRoutedPath(id, sourceX, sourceY, targetX, targetY, waypoints, nodes, isStraightProp || isAdjacent).points,
                stubStart: null,
                stubEnd: null,
            }
        }

        const STUB_DIST = 15
        const getStub = (x: number, y: number, pos?: Position) => {
            if (pos === Position.Right) return { x: x + STUB_DIST, y }
            if (pos === Position.Left) return { x: x - STUB_DIST, y }
            if (pos === Position.Top) return { x, y: y - STUB_DIST }
            if (pos === Position.Bottom) return { x, y: y + STUB_DIST }
            return { x, y }
        }
        const sStub = getStub(sourceX, sourceY, sourcePosition)
        const tStub = getStub(targetX, targetY, targetPosition)

        return {
            routedPoints: buildRoutedPath(id, sStub.x, sStub.y, tStub.x, tStub.y, waypoints, nodes, false).points,
            stubStart: sStub,
            stubEnd: tStub,
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, waypointsStr, isStraightProp, isAdjacent, usesStubs])

    // ── Parallel offset for sibling edges between same modules ────────────────
    const edges = getEdges()
    const siblingEdges = edges.filter(e => e.source === source && e.target === target && (e.data as any)?.kind === 'io')
    const myIndex = siblingEdges.findIndex(e => e.id === id)
    const offsetMag = Math.ceil(myIndex / 2) * 6
    const offsetSign = myIndex % 2 === 0 ? 1 : -1
    const offset = (myIndex <= 0 || hasWaypoints) ? 0 : offsetMag * offsetSign

    // Apply offset to intermediate routed points only (not first/last)
    const shiftedRouted = routedPoints.map((p, i) => {
        if (i === 0 || i === routedPoints.length - 1) return p
        return { x: p.x + offset, y: p.y + offset }
    })

    // Build the full visual path: stub → routed → stub
    const fullVisualPoints = usesStubs
        ? [{ x: sourceX, y: sourceY }, ...shiftedRouted, { x: targetX, y: targetY }]
        : shiftedRouted

    const svgPath = fullVisualPoints.map((p, i) =>
        i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`,
    ).join(' ')

    // ── Draggable corners ─────────────────────────────────────────────────────
    // Only the ROUTED intermediate points are draggable corners.
    // The stub start/end and the routed start/end are NOT user-editable.
    const routedCorners = shiftedRouted.slice(1, -1)

    // Ref for snapshotting on first interaction
    const cornersRef = useRef<Array<{ x: number; y: number }>>(routedCorners)
    useEffect(() => { cornersRef.current = routedCorners }, [routedCorners])

    // ── Visual properties ─────────────────────────────────────────────────────
    const color = d?.wireColor ?? IO_COLOR
    const strokeWidth = selected ? 3 : 1.25

    // ── Hit segments (for clicking to insert waypoints) ───────────────────────
    // Only the routed part of the path is clickable (not the stubs)
    const routedHitSegments = shiftedRouted.slice(0, -1).map((p1, i) => {
        const p2 = shiftedRouted[i + 1]
        return { d: `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`, index: i }
    })

    // ── Label position at the midpoint of total path length ───────────────────
    let totalLength = 0
    const pathSegments: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number }; len: number }> = []
    for (let i = 0; i < fullVisualPoints.length - 1; i++) {
        const p1 = fullVisualPoints[i]
        const p2 = fullVisualPoints[i + 1]
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y)
        pathSegments.push({ p1, p2, len })
        totalLength += len
    }
    const half = totalLength / 2
    let currentLength = 0
    let labelPos = { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 }
    for (const seg of pathSegments) {
        if (currentLength + seg.len >= half) {
            const remaining = half - currentLength
            const ratio = seg.len === 0 ? 0.5 : remaining / seg.len
            labelPos = {
                x: seg.p1.x + (seg.p2.x - seg.p1.x) * ratio,
                y: seg.p1.y + (seg.p2.y - seg.p1.y) * ratio
            }
            break
        }
        currentLength += seg.len
    }

    const labelOffset = d?.labelOffset ?? { x: 0, y: 0 }
    labelPos.x += labelOffset.x
    labelPos.y += labelOffset.y

    // ── Interaction Handlers ──────────────────────────────────────────────────
    // All handlers read FRESH state from edge data to avoid stale closures.

    /** Snapshot the current visual routed corners, or copy existing waypoints */
    const snapshotOrCopy = useCallback((): Array<{ x: number; y: number }> => {
        const allEdges = getEdges()
        const edge = allEdges.find(e => e.id === id)
        const existing = edge ? readWaypoints(edge.data) : []
        if (existing.length > 0) return existing.map(w => ({ ...w }))
        // Snapshot the auto-generated routed corners
        return cornersRef.current.map(c => ({ x: c.x, y: c.y }))
    }, [getEdges, id])

    /** Click a routed segment to insert a new corner at its midpoint */
    const onSegmentClick = useCallback((segIdx: number) => (e: React.MouseEvent) => {
        e.stopPropagation()
        const activeWps = snapshotOrCopy()

        const p1 = shiftedRouted[segIdx]
        const p2 = shiftedRouted[segIdx + 1]
        if (!p1 || !p2) {
            alerts?.showAlert('warning', 'Cannot insert waypoint on this segment')
            return
        }
        const mx = (p1.x + p2.x) / 2
        const my = (p1.y + p2.y) / 2

        // segIdx in shiftedRouted maps directly to waypoint insert position
        // (shiftedRouted[0] = route start, shiftedRouted[last] = route end,
        //  so segment 0 is between route start and corner 0 → insert at index 0)
        activeWps.splice(segIdx, 0, { x: mx, y: my })

        setEdges(eds => eds.map(edge => {
            if (edge.id !== id) return edge
            return { ...edge, data: { ...edge.data, waypoints: activeWps, straight: false } }
        }))
    }, [id, setEdges, snapshotOrCopy, shiftedRouted, alerts])

    /** Drag a corner waypoint to a new position */
    const onWaypointMD = useCallback((idx: number) => (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const cur = cornersRef.current[idx]
        if (!cur) {
            alerts?.showAlert('warning', `Cannot drag waypoint ${idx}: out of range`)
            return
        }
        const startPos = { x: cur.x, y: cur.y }
        const startClientX = e.clientX
        const startClientY = e.clientY

        // Snapshot at drag start — this is the array we'll mutate during dragging
        const activeWps = snapshotOrCopy()
        if (idx >= activeWps.length) {
            alerts?.showAlert('warning', `Waypoint index ${idx} exceeds available waypoints (${activeWps.length})`)
            return
        }

        const onMove = (ev: MouseEvent) => {
            const z = getZoom()
            const dx = (ev.clientX - startClientX) / z
            const dy = (ev.clientY - startClientY) / z
            activeWps[idx] = { x: startPos.x + dx, y: startPos.y + dy }
            setEdges(prev => prev.map(edge => {
                if (edge.id !== id) return edge
                return { ...edge, data: { ...edge.data, waypoints: [...activeWps] } }
            }))
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [id, setEdges, getZoom, snapshotOrCopy, alerts])

    /** Right-click a corner waypoint to remove it */
    const onWaypointCtx = useCallback((idx: number) => (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const activeWps = snapshotOrCopy()
        if (idx < 0 || idx >= activeWps.length) {
            alerts?.showAlert('warning', `Cannot remove waypoint ${idx}: out of range`)
            return
        }
        activeWps.splice(idx, 1)
        setEdges(prev => prev.map(edge => {
            if (edge.id !== id) return edge
            return { ...edge, data: { ...edge.data, waypoints: activeWps } }
        }))
    }, [id, setEdges, snapshotOrCopy, alerts])

    /** Drag the label to a new offset */
    const onLabelMD = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        
        const startClientX = e.clientX
        const startClientY = e.clientY
        const allEdges = getEdges()
        const edge = allEdges.find(e => e.id === id)
        const currentOffset = (edge?.data as WireData | undefined)?.labelOffset ?? { x: 0, y: 0 }

        const onMove = (ev: MouseEvent) => {
            const z = getZoom()
            const dx = (ev.clientX - startClientX) / z
            const dy = (ev.clientY - startClientY) / z
            setEdges(prev => prev.map(edge => {
                if (edge.id !== id) return edge
                return { ...edge, data: { ...edge.data, labelOffset: { x: currentOffset.x + dx, y: currentOffset.y + dy } } }
            }))
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [id, setEdges, getZoom, getEdges])

    /** Delete the entire edge */
    const onRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        setEdges(prev => prev.filter(edge => edge.id !== id))
        alerts?.showAlert('info', 'Connection removed')
    }, [id, setEdges, alerts])

    // ── Snapshot Auto-Routed Path ─────────────────────────────────────────────
    // If this edge was just created (has no waypoints) and uses the smart router,
    // we snapshot the generated path into explicit waypoints immediately.
    // This prevents the heavy A* pathfinding from running constantly while dragging.
    useEffect(() => {
        if (!hasWaypoints && usesStubs) {
            let corners = routedPoints.slice(1, -1)
            
            // If the router found a direct line (no corners), insert a midpoint
            // so we have at least one waypoint. This ensures hasWaypoints becomes true
            // and we don't infinitely recalculate.
            if (corners.length === 0) {
                const sStub = routedPoints[0]
                const tStub = routedPoints[routedPoints.length - 1]
                if (sStub && tStub) {
                    corners = [{ x: (sStub.x + tStub.x) / 2, y: (sStub.y + tStub.y) / 2 }]
                }
            }

            if (corners.length > 0) {
                setEdges(eds => eds.map(e => {
                    if (e.id === id) {
                        return { ...e, data: { ...e.data, waypoints: corners } }
                    }
                    return e
                }))
            }
        }
    }, [hasWaypoints, usesStubs, routedPoints, id, setEdges])

    return (
        <>
            <BaseEdge id={id} path={svgPath}
                style={{
                    stroke: selected ? SEL_COLOR : color,
                    strokeWidth,
                    strokeDasharray: isStraightProp ? 'none' : '6 6',
                    strokeLinejoin: 'round'
                }}
            />
            {/* Invisible wider hit areas ON TOP of the edge for clicking to insert corners */}
            {selected && routedHitSegments.map(seg => (
                <path key={`hit-${seg.index}`} d={seg.d}
                    stroke="transparent" strokeWidth={16} fill="none"
                    style={{ cursor: 'copy', pointerEvents: 'all' }}
                    onClick={onSegmentClick(seg.index)}
                />
            ))}
            <WireEdgeLabel
                label={label}
                selected={selected}
                hideLabel={hideLabel}
                color={color}
                labelPos={labelPos}
                routedCorners={routedCorners}
                onRemove={onRemove}
                onWaypointMD={onWaypointMD}
                onWaypointCtx={onWaypointCtx}
                onLabelMD={onLabelMD}
            />
        </>
    )
}
