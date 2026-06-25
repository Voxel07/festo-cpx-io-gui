/**
 * WireEdge – custom IO wiring edge with a draggable midpoint control handle.
 *
 * Renders as a quadratic bezier.  The orange midpoint dot can be dragged to
 * re-route the wire.  When selected the stroke brightens.
 */
import { useCallback } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

const IO_COLOR = '#e65100'
const SEL_COLOR = '#ff6d00'

export type WireData = {
    kind: 'io'
    portSrc?: string
    portTgt?: string
    /** Stored wire colour (green=out→in, blue=in→out, orange=inout) */
    wireColor?: string
    /** Offset of the bezier control-point from the geometric midpoint (canvas px) */
    cpOffsetX?: number
    cpOffsetY?: number
}

export function WireEdge({
    id,
    sourceX, sourceY,
    targetX, targetY,
    style,
    markerEnd,
    selected,
    data,
    label,
}: EdgeProps) {
    const { setEdges, getZoom } = useReactFlow()
    const d = data as WireData | undefined

    const cpOffX = d?.cpOffsetX ?? 0
    const cpOffY = d?.cpOffsetY ?? 0

    // Control-point = midpoint + user offset
    const cpX = (sourceX + targetX) / 2 + cpOffX
    const cpY = (sourceY + targetY) / 2 + cpOffY

    // Quadratic bezier path: source → control → target
    const path = `M ${sourceX},${sourceY} Q ${cpX},${cpY} ${targetX},${targetY}`

    const color = selected
        ? SEL_COLOR
        : (d?.wireColor ?? (typeof style?.stroke === 'string' ? style.stroke : IO_COLOR))
    const strokeWidth = selected ? 3 : (typeof style?.strokeWidth === 'number' ? style.strokeWidth : 2)

    // ── Drag the control-point handle ───────────────────────
    const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        const startMouseX = e.clientX
        const startMouseY = e.clientY
        const startCpX = cpOffX
        const startCpY = cpOffY

        const onMove = (ev: MouseEvent) => {
            const zoom = getZoom()
            setEdges(prev => prev.map(edge =>
                edge.id === id
                    ? {
                        ...edge,
                        data: {
                            ...edge.data,
                            cpOffsetX: startCpX + (ev.clientX - startMouseX) / zoom,
                            cpOffsetY: startCpY + (ev.clientY - startMouseY) / zoom,
                        },
                    }
                    : edge,
            ))
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [id, cpOffX, cpOffY, setEdges, getZoom])

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                style={{ stroke: color, strokeWidth }}
            /* no markerEnd – flow direction shown by animation only */
            />
            <EdgeLabelRenderer>
                {/* Route-handle dot at the control point */}
                <div
                    onMouseDown={onHandleMouseDown}
                    title="Drag to re-route wire"
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${cpX}px, ${cpY}px)`,
                        width: 10,
                        height: 10,
                        background: color,
                        border: '2px solid #fff',
                        borderRadius: '50%',
                        cursor: 'move',
                        zIndex: 1010,
                        pointerEvents: 'all',
                        boxShadow: selected ? `0 0 0 2px ${SEL_COLOR}` : 'none',
                    }}
                    className="nodrag nopan"
                />
                {/* Edge label above the control point */}
                {label && (
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, calc(-100% - 5px)) translate(${cpX}px, ${cpY}px)`,
                            fontSize: 9,
                            color: IO_COLOR,
                            fontWeight: 600,
                            background: 'rgba(255,243,224,0.92)',
                            padding: '1px 4px',
                            borderRadius: 3,
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {label}
                    </div>
                )}
            </EdgeLabelRenderer>
        </>
    )
}
