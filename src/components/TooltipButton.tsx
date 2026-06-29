import React from 'react'
import { Button, IconButton, Tooltip } from '@mui/material'
import type { ButtonProps, IconButtonProps } from '@mui/material'

export interface TooltipButtonProps extends ButtonProps {
    tooltip: string
    icon?: React.ReactNode
}

export const TooltipButton: React.FC<TooltipButtonProps> = ({
    tooltip,
    icon,
    onClick,
    children,
    ...props
}) => {
    return (
        <Tooltip title={tooltip}>
            <span>
                <Button
                    startIcon={icon}
                    onClick={onClick}
                    {...props}
                >
                    {children}
                </Button>
            </span>
        </Tooltip>
    )
}

export interface TooltipIconButtonProps extends IconButtonProps {
    tooltip: string
    icon: React.ReactNode
}

export const TooltipIconButton: React.FC<TooltipIconButtonProps> = ({
    tooltip,
    icon,
    onClick,
    ...props
}) => {
    return (
        <Tooltip title={tooltip}>
            <span>
                <IconButton onClick={onClick} {...props}>
                    {icon}
                </IconButton>
            </span>
        </Tooltip>
    )
}
