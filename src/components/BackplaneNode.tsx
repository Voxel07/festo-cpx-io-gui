import { memo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'

export type BackplaneNodeData = { label?: string }
export type BackplaneNodeType = Node<BackplaneNodeData, 'backplane'>

function BackplaneNode({ data, selected }: NodeProps<BackplaneNodeType>) {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            border: selected ? '2px solid #1976d2' : '1.5px solid #bbdefb',
            borderRadius: 6,
            background: selected ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.05)',
            boxSizing: 'border-box',
            overflow: 'visible',
            cursor: 'grab',
        }}>
            {data.label && (
                <span style={{
                    position: 'absolute',
                    top: -13,
                    left: 6,
                    fontSize: 9,
                    color: '#1565c0',
                    fontWeight: 600,
                    background: '#f5f9ff',
                    padding: '0 4px',
                    borderRadius: 3,
                    whiteSpace: 'nowrap',
                    lineHeight: '13px',
                    border: '1px solid #bbdefb',
                    userSelect: 'none',
                }}>
                    {data.label}
                </span>
            )}
        </div>
    )
}

export default memo(BackplaneNode)
