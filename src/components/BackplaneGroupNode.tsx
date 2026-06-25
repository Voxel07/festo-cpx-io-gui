import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { Box, Typography } from '@mui/material'

export type BackplaneGroupData = {
    label?: string
}

export type BackplaneGroupNodeType = Node<BackplaneGroupData, 'group'>

/**
 * Renders the AP-A backplane rack container.
 * Module nodes are positioned inside this group via `parentId`.
 *
 * The right-side "cable-out" handle is used to draw AP cable connections
 * to AP-I modules.
 */
function BackplaneGroupNode({ data }: NodeProps<BackplaneGroupNodeType>) {
    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                background: 'rgba(21, 101, 192, 0.05)',
                border: '2.5px solid #1565c0',
                borderRadius: '8px',
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'visible',
            }}
        >
            {/* Group label */}
            <Typography
                sx={{
                    position: 'absolute',
                    top: 5,
                    left: 10,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#1565c0',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                {data.label ?? 'AP-A Backplane'}
            </Typography>

            {/* Bottom backplane DIN-rail indicator */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 12,
                    background: '#1565c0',
                    borderRadius: '0 0 5px 5px',
                    opacity: 0.75,
                }}
            />

            {/* Cable-out handle — connects AP-A system to AP-I modules via cable */}
            <Handle
                id="cable-out"
                type="source"
                position={Position.Right}
                style={{
                    background: '#1565c0',
                    width: 14,
                    height: 14,
                    border: '2px solid #fff',
                    borderRadius: '50%',
                    right: -7,
                    top: '45%',
                }}
            />
        </Box>
    )
}

export default memo(BackplaneGroupNode)
