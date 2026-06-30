import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'

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

// ── Custom cable edge: 6-segment orthogonal route or straight line ─────────
export function CableEdge({ sourceX, sourceY, targetX, targetY, label, style, markerEnd, data }: EdgeProps) {
    const isExitRight = (data as Record<string, unknown>)?.exitRight === true
    const isStraight = (data as Record<string, unknown>)?.straight === true

    let path = ''
    let labelX = 0
    let labelY = 0

    if (isStraight) {
        path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`
        labelX = (sourceX + targetX) / 2
        labelY = (sourceY + targetY) / 2
    } else {
        const STUB = 50   // horizontal stub before going vertical
        const aboveY = Math.min(sourceY, targetY) - 80
        const x1 = isExitRight ? sourceX + STUB : sourceX - STUB   // exit source going left/right
        const x2 = targetX - STUB   // approach target from the left
        path = [
            `M ${sourceX},${sourceY}`,
            `L ${x1},${sourceY}`,     // go left/right from source
            `L ${x1},${aboveY}`,      // go up
            `L ${x2},${aboveY}`,      // run horizontal
            `L ${x2},${targetY}`,     // go down to target level
            `L ${targetX},${targetY}`,// connect to target
        ].join(' ')
        labelX = (x1 + x2) / 2
        labelY = aboveY - 8
    }

    return (
        <>
            <BaseEdge path={path} style={style} markerEnd={markerEnd} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        className="nodrag nopan"
                        style={{
                            ...LABEL_BASE_STYLE,
                            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
                        }}
                    >
                        {String(label)}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
}
