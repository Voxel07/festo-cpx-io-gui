import { memo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { useTheme } from '@mui/material'

import TopologyNodeWrapper from './TopologyNodeWrapper'
import type { DiffStatusKind } from '../types'

export type BackplaneNodeData = {
    label?: string
    status?: DiffStatusKind
    compareActive?: boolean
}
export type BackplaneNodeType = Node<BackplaneNodeData, 'backplane'>

function BackplaneNode({ data, selected }: NodeProps<BackplaneNodeType>) {
    const theme = useTheme()
    return (
        <TopologyNodeWrapper 
            selected={selected}
            status={data.status}
            compareActive={data.compareActive}
        >
            {data.label && (
                <span style={{
                    position: 'absolute',
                    top: -13,
                    left: 6,
                    fontSize: 9,
                    color: theme.palette.mode === 'dark' ? theme.palette.primary.light : '#1565c0',
                    fontWeight: 600,
                    background: theme.palette.background.paper,
                    padding: '0 4px',
                    borderRadius: 3,
                    whiteSpace: 'nowrap',
                    lineHeight: '13px',
                    border: `1px solid ${theme.palette.divider}`,
                    userSelect: 'none',
                }}>
                    {data.label}
                </span>
            )}
        </TopologyNodeWrapper>
    )
}

export default memo(BackplaneNode)
