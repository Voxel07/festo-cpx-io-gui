import { Box, useTheme } from '@mui/material'
import type { DiffStatusKind } from '../types'

interface TopologyNodeWrapperProps {
    children: React.ReactNode
    status?: DiffStatusKind
    compareActive?: boolean
    selected?: boolean
    active?: boolean
    width?: number | string
    height?: number | string
    noBorder?: boolean
    padding?: string
}

export default function TopologyNodeWrapper({
    children,
    status = 'unchanged',
    compareActive = false,
    selected = false,
    active = false,
    width = '100%',
    height = '100%',
    noBorder = false,
    padding = '0',
}: TopologyNodeWrapperProps) {
    const theme = useTheme()

    const STATUS_STYLE: Record<DiffStatusKind, string> = {
        unchanged: theme.palette.primary.main,
        changed: theme.palette.warning.main,
        added: theme.palette.success.main,
        removed: theme.palette.error.main,
    }

    const borderColor = compareActive ? STATUS_STYLE[status] : theme.palette.divider

    return (
        <Box sx={{
            width,
            height,
            border: noBorder ? 'none' : `2px solid ${borderColor}`,
            background: 'transparent',
            boxShadow: noBorder ? 'none' : active
                ? '0 0 12px 4px rgba(255,152,0,0.6), 0 2px 6px rgba(0,0,0,0.14)'
                : selected 
                    ? `0 0 0 2px ${theme.palette.primary.main} inset, 0 2px 6px rgba(0,0,0,0.14)` 
                    : '0 2px 6px rgba(0,0,0,0.14)',
            borderRadius: 1.5,
            p: padding,
            textAlign: 'center',
            position: 'relative',
            boxSizing: 'border-box',
            animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
            '@keyframes pulse': {
                '0%, 100%': { boxShadow: '0 0 8px 2px rgba(255,152,0,0.4), 0 2px 6px rgba(0,0,0,0.14)' },
                '50%': { boxShadow: '0 0 16px 6px rgba(255,152,0,0.7), 0 2px 6px rgba(0,0,0,0.14)' },
            },
        }}>
            {children}
        </Box>
    )
}
