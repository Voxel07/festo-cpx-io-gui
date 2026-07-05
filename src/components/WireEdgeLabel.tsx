import { Fragment } from 'react'
import { EdgeLabelRenderer } from '@xyflow/react'
import { LABEL_TEXT_BASE, BUTTON_STYLE, WP_BASE_STYLE, WP_HIT, SEL_COLOR } from '../utils/wireEdgeHelpers'

interface Props {
    label?: string | React.ReactNode
    selected?: boolean
    hideLabel: boolean
    color: string
    labelPos: { x: number; y: number }
    routedCorners: Array<{ x: number; y: number }>
    onRemove: (e: React.MouseEvent) => void
    onWaypointMD: (idx: number) => (e: React.MouseEvent) => void
    onWaypointCtx: (idx: number) => (e: React.MouseEvent) => void
}

export function WireEdgeLabel({
    label, selected, hideLabel, color, labelPos,
    routedCorners, onRemove, onWaypointMD, onWaypointCtx
}: Props) {
    return (
        <EdgeLabelRenderer>
            {(label || selected) && (
                <div style={{
                    position: 'absolute',
                    transform: `translate(-50%, calc(-100% - 4px)) translate(${labelPos.x}px, ${labelPos.y}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    pointerEvents: 'none',
                    zIndex: 1001,
                }}>
                    {(!hideLabel && label) && (
                        <div style={{
                            ...LABEL_TEXT_BASE,
                            color: color,
                            fontWeight: 600,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            border: `1px solid ${color}`,
                        }}>
                            {label}
                        </div>
                    )}
                    {selected && (
                        <button
                            onClick={onRemove}
                            title="Remove connection"
                            style={BUTTON_STYLE}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#bf360c'
                                e.currentTarget.style.transform = 'scale(1.15)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#d84315'
                                e.currentTarget.style.transform = 'scale(1)'
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}
            {/* Draggable waypoint dots — only on routed corners, NOT stubs */}
            {selected && routedCorners.map((wp, i) => (
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
                        ...WP_BASE_STYLE,
                        transform: `translate(-50%,-50%) translate(${wp.x}px,${wp.y}px)`,
                        background: SEL_COLOR,
                    }} />
                </Fragment>
            ))}
        </EdgeLabelRenderer>
    )
}
