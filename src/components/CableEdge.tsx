import { useEffect, useMemo } from 'react'
import { BaseEdge, EdgeLabelRenderer, Position, useEdges, useReactFlow, type EdgeProps, type Node } from '@xyflow/react'
import { findSmartPath, type RoutingPoint } from '../utils/routing'

const LABEL_BASE_STYLE: React.CSSProperties = {
    position: 'absolute',
    fontSize: 10,
    fontWeight: 700,
    color: '#1565c0',
    background: '#e3f2fd',
    padding: '1px 6px',
    borderRadius: 3,
    border: '1px solid #bbdefb',
    pointerEvents: 'none',
}

type CableData = {
    kind?: string
    routeOrder?: number
    routeKey?: string
    routedPoints?: RoutingPoint[]
}

type NodeRect = { left: number; right: number; top: number; bottom: number }

function nodeRect(nodeId: string, nodes: Node[]): NodeRect | null {
    const node = nodes.find(candidate => candidate.id === nodeId)
    if (!node) return null
    let left = node.position.x
    let top = node.position.y
    let parentId = node.parentId
    while (parentId) {
        const parent = nodes.find(candidate => candidate.id === parentId)
        if (!parent) break
        left += parent.position.x
        top += parent.position.y
        parentId = parent.parentId
    }
    const styledWidth = typeof node.style?.width === 'number'
        ? node.style.width : Number.parseFloat(String(node.style?.width ?? ''))
    const styledHeight = typeof node.style?.height === 'number'
        ? node.style.height : Number.parseFloat(String(node.style?.height ?? ''))
    const width = node.measured?.width ?? (Number.isFinite(styledWidth) ? styledWidth : 100)
    const height = node.measured?.height ?? (Number.isFinite(styledHeight) ? styledHeight : 100)
    return { left, right: left + width, top, bottom: top + height }
}

function escapePoint(
    point: RoutingPoint,
    position: Position,
    rect: NodeRect | null,
    otherRects: NodeRect[],
): RoutingPoint {
    if (!rect) return point
    const clearance = 18
    const obstaclePadding = 6
    if (position === Position.Left) {
        const neighbor = otherRects
            .filter(other => other.right <= rect.left && point.y >= other.top && point.y <= other.bottom)
            .sort((a, b) => b.right - a.right)[0]
        const preferred = rect.left - clearance
        const x = neighbor && preferred <= neighbor.right + obstaclePadding
            ? (neighbor.right + rect.left) / 2
            : preferred
        return { x, y: point.y }
    }
    if (position === Position.Right) {
        const neighbor = otherRects
            .filter(other => other.left >= rect.right && point.y >= other.top && point.y <= other.bottom)
            .sort((a, b) => a.left - b.left)[0]
        const preferred = rect.right + clearance
        const x = neighbor && preferred >= neighbor.left - obstaclePadding
            ? (rect.right + neighbor.left) / 2
            : preferred
        return { x, y: point.y }
    }
    if (position === Position.Top) return { x: point.x, y: rect.top - clearance }
    return { x: point.x, y: rect.bottom + clearance }
}

function directFacingRoute(
    sourcePoint: RoutingPoint,
    targetPoint: RoutingPoint,
    sourcePosition: Position,
    targetPosition: Position,
    sourceRect: NodeRect | null,
    targetRect: NodeRect | null,
): RoutingPoint[] | null {
    if (!sourceRect || !targetRect) return null
    if (sourcePosition === Position.Right && targetPosition === Position.Left
        && sourceRect.right <= targetRect.left) {
        const x = (sourceRect.right + targetRect.left) / 2
        return [{ x, y: sourcePoint.y }, { x, y: targetPoint.y }]
    }
    if (sourcePosition === Position.Left && targetPosition === Position.Right
        && targetRect.right <= sourceRect.left) {
        const x = (targetRect.right + sourceRect.left) / 2
        return [{ x, y: sourcePoint.y }, { x, y: targetPoint.y }]
    }
    if (sourcePosition === Position.Bottom && targetPosition === Position.Top
        && sourceRect.bottom <= targetRect.top) {
        const y = (sourceRect.bottom + targetRect.top) / 2
        return [{ x: sourcePoint.x, y }, { x: targetPoint.x, y }]
    }
    if (sourcePosition === Position.Top && targetPosition === Position.Bottom
        && targetRect.bottom <= sourceRect.top) {
        const y = (targetRect.bottom + sourceRect.top) / 2
        return [{ x: sourcePoint.x, y }, { x: targetPoint.x, y }]
    }
    return null
}

function segmentTouchesRect(a: RoutingPoint, b: RoutingPoint, rect: NodeRect, padding = 6) {
    const left = rect.left - padding
    const right = rect.right + padding
    const top = rect.top - padding
    const bottom = rect.bottom + padding
    if (a.x === b.x) {
        return a.x >= left && a.x <= right
            && Math.max(Math.min(a.y, b.y), top) <= Math.min(Math.max(a.y, b.y), bottom)
    }
    return a.y >= top && a.y <= bottom
        && Math.max(Math.min(a.x, b.x), left) <= Math.min(Math.max(a.x, b.x), right)
}

/** Prefer a compact two-bend path when two ports face the same side and it is obstacle-free. */
function directSameSideRoute(
    sourceStub: RoutingPoint,
    targetStub: RoutingPoint,
    sourcePosition: Position,
    targetPosition: Position,
    obstacles: NodeRect[],
): RoutingPoint[] | null {
    if (sourcePosition !== targetPosition
        || (sourcePosition !== Position.Left && sourcePosition !== Position.Right)) return null

    const candidates = [
        [sourceStub, { x: sourceStub.x, y: targetStub.y }, targetStub],
        [sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub],
    ]
    return candidates.find(points => points.slice(0, -1).every((point, index) =>
        obstacles.every(rect => !segmentTouchesRect(point, points[index + 1], rect)),
    )) ?? null
}

function midpoint(points: RoutingPoint[]): RoutingPoint {
    const lengths = points.slice(0, -1).map((point, index) =>
        Math.abs(points[index + 1].x - point.x) + Math.abs(points[index + 1].y - point.y),
    )
    const halfway = lengths.reduce((sum, length) => sum + length, 0) / 2
    let travelled = 0
    for (let index = 0; index < lengths.length; index++) {
        const length = lengths[index]
        if (travelled + length >= halfway) {
            const start = points[index]
            const end = points[index + 1]
            const ratio = length === 0 ? 0 : (halfway - travelled) / length
            return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
        }
        travelled += length
    }
    return points[Math.floor(points.length / 2)]
}

function orthogonalize(
    points: RoutingPoint[],
    sourcePosition: Position,
    targetPosition: Position,
): RoutingPoint[] {
    const result: RoutingPoint[] = [points[0]]
    for (let index = 1; index < points.length; index++) {
        const previous = result[result.length - 1]
        const next = points[index]
        if (previous.x !== next.x && previous.y !== next.y) {
            const isTargetApproach = index === points.length - 1
            const targetIsHorizontal = targetPosition === Position.Left || targetPosition === Position.Right
            const sourceIsHorizontal = sourcePosition === Position.Left || sourcePosition === Position.Right
            result.push(isTargetApproach && targetIsHorizontal
                ? { x: previous.x, y: next.y }
                : sourceIsHorizontal
                    ? { x: next.x, y: previous.y }
                    : { x: previous.x, y: next.y })
        }
        result.push(next)
    }
    const deduped = result.filter((point, index) => index === 0
        || Math.abs(point.x - result[index - 1].x) > 0.5
        || Math.abs(point.y - result[index - 1].y) > 0.5)
    return deduped.filter((point, index) => {
        if (index === 0 || index === deduped.length - 1) return true
        const previous = deduped[index - 1]
        const next = deduped[index + 1]
        const vertical = Math.abs(previous.x - point.x) <= 0.5 && Math.abs(point.x - next.x) <= 0.5
        const horizontal = Math.abs(previous.y - point.y) <= 0.5 && Math.abs(point.y - next.y) <= 0.5
        return !vertical && !horizontal
    })
}

/** AP cable route. A* is run once when the edge is created, then persisted in edge data. */
export function CableEdge({
    id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    label, style, markerEnd, data,
}: EdgeProps) {
    const { getNodes, setEdges } = useReactFlow()
    const allEdges = useEdges()
    const cableData = data as CableData | undefined
    const order = cableData?.routeOrder ?? 0
    const savedPoints = cableData?.routedPoints
    const previousCableRoutes = useMemo(() => allEdges
        .filter(edge => {
            const edgeData = edge.data as CableData | undefined
            const sharesEndpoint = edge.source === source || edge.target === source
                || edge.source === target || edge.target === target
            return edge.id !== id && !sharesEndpoint && edgeData?.kind === 'cable'
                && (edgeData.routeOrder ?? 0) < order
                && (edgeData.routedPoints?.length ?? 0) >= 2
        })
        .map(edge => (edge.data as CableData).routedPoints!), [allEdges, id, order, source, target])
    const previousRoutesReady = allEdges.every(edge => {
        const edgeData = edge.data as CableData | undefined
        return edgeData?.kind !== 'cable' || (edgeData.routeOrder ?? 0) >= order
            || (edgeData.routedPoints?.length ?? 0) >= 2
    })
    const nodes = getNodes()
    const sourcePoint = { x: sourceX, y: sourceY }
    const targetPoint = { x: targetX, y: targetY }
    const sourceBounds = nodeRect(source, nodes)
    const targetBounds = nodeRect(target, nodes)
    const otherBounds = nodes
        .filter(node => node.type === 'mod' && node.id !== source && node.id !== target)
        .map(node => nodeRect(node.id, nodes))
        .filter((rect): rect is NodeRect => rect !== null)
    const facingRoute = directFacingRoute(
        sourcePoint, targetPoint, sourcePosition, targetPosition, sourceBounds, targetBounds,
    )
    const sourceStub = escapePoint(
        sourcePoint, sourcePosition, sourceBounds,
        targetBounds ? [...otherBounds, targetBounds] : otherBounds,
    )
    const targetStub = escapePoint(
        targetPoint, targetPosition, targetBounds,
        sourceBounds ? [...otherBounds, sourceBounds] : otherBounds,
    )
    const sameSideRoute = directSameSideRoute(
        sourceStub, targetStub, sourcePosition, targetPosition,
        [sourceBounds, targetBounds, ...otherBounds].filter((rect): rect is NodeRect => rect !== null),
    )

    useEffect(() => {
        if ((savedPoints?.length ?? 0) >= 2 || !previousRoutesReady) return
        const routedPoints = facingRoute ?? sameSideRoute ?? findSmartPath(
            sourceStub.x, sourceStub.y, targetStub.x, targetStub.y, nodes,
            { avoidPaths: previousCableRoutes, padding: 6, gridSize: 8 },
        )
        setEdges(edges => edges.map(edge => edge.id === id
            ? { ...edge, data: { ...edge.data, routedPoints } }
            : edge))
    }, [facingRoute, id, nodes, previousCableRoutes, previousRoutesReady, sameSideRoute, savedPoints, setEdges, sourceStub.x, sourceStub.y, targetStub.x, targetStub.y])

    const rawPoints = (savedPoints?.length ?? 0) >= 2
        ? [{ x: sourceX, y: sourceY }, ...savedPoints!, { x: targetX, y: targetY }]
        : [sourcePoint, ...(facingRoute ?? sameSideRoute ?? [sourceStub, targetStub]), targetPoint]
    const points = orthogonalize(rawPoints, sourcePosition, targetPosition)
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ')
    const labelPoint = midpoint(points)

    return (
        <>
            <BaseEdge path={path} style={style} markerEnd={markerEnd} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        className="nodrag nopan"
                        style={{
                            ...LABEL_BASE_STYLE,
                            transform: `translate(-50%,-50%) translate(${labelPoint.x}px,${labelPoint.y - 8}px)`,
                        }}
                    >
                        {String(label)}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
}
