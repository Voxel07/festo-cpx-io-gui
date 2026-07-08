import { Box, Divider, Typography, Slider, Stack } from '@mui/material'
import CableIcon from '@mui/icons-material/Cable'
import LinkIcon from '@mui/icons-material/Link'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import { TooltipButton } from './TooltipButton'

interface Props {
    showApCables: boolean
    onToggleApCables: () => void
    showIoCables: boolean
    onToggleIoCables: () => void
    fullscreen: boolean
    onToggleFullscreen: () => void
    showLegend?: boolean
    wrapThreshold: number
    onWrapThresholdChange: (val: number) => void
    cableGap: number
    onCableGapChange: (val: number) => void
}

export default function TopologyToolbar({
    showApCables,
    onToggleApCables,
    showIoCables,
    onToggleIoCables,
    fullscreen,
    onToggleFullscreen,
    showLegend = false,
    wrapThreshold,
    onWrapThresholdChange,
    cableGap,
    onCableGapChange,
}: Props) {

    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 0.75,
            flexShrink: 0,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            flexWrap: 'wrap',
        }}>
            {/* AP Cable toggle */}
            <TooltipButton
                size="small"
                variant="text"
                color="inherit"
                onClick={onToggleApCables}
                tooltip={showApCables ? 'Hide AP transmission cables' : 'Show AP transmission cables'}
                icon={<CableIcon />}
                sx={{ fontSize: '0.7rem', py: 0.25 }}
            >
                {showApCables ? 'AP Cables ON' : 'AP Cables OFF'}
            </TooltipButton>

            {/* IO Cable toggle */}
            <TooltipButton
                size="small"
                variant="text"
                color="inherit"
                onClick={onToggleIoCables}
                tooltip={showIoCables ? 'Hide IO connection wires' : 'Show IO connection wires'}
                icon={<LinkIcon />}
                sx={{ fontSize: '0.7rem', py: 0.25 }}
            >
                {showIoCables ? 'IO Wires ON' : 'IO Wires OFF'}
            </TooltipButton>

            {/* Fullscreen toggle */}
            <TooltipButton
                size="small"
                variant="text"
                color="inherit"
                onClick={onToggleFullscreen}
                tooltip={fullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
                icon={fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                sx={{ minWidth: 32, px: 1, fontSize: '0.7rem' }}
            >
                {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </TooltipButton>

            <Divider orientation="vertical" flexItem />
            
            {/* Layout Controls */}
            <Stack direction="row" spacing={3} sx={{ ml: 1, alignItems: 'center' }}>
                <Box sx={{ width: 120 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: -0.5 }}>Modules/Row: {wrapThreshold}</Typography>
                    <Slider
                        size="small"
                        value={wrapThreshold}
                        min={4}
                        max={32}
                        step={1}
                        onChange={(_, val) => onWrapThresholdChange(val as number)}
                    />
                </Box>
                <Box sx={{ width: 120 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: -0.5 }}>Spacing: {cableGap}</Typography>
                    <Slider
                        size="small"
                        value={cableGap}
                        min={40}
                        max={400}
                        step={10}
                        onChange={(_, val) => onCableGapChange(val as number)}
                    />
                </Box>
            </Stack>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            {/* Color legend */}
            {showLegend && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'primary.main', fontWeight: 600 }}>
                        unchanged
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'warning.main', fontWeight: 600 }}>
                        changed
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'success.main', fontWeight: 600 }}>
                        added
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'error.main', fontWeight: 600 }}>
                        removed
                    </Typography>
                </Box>
            )}
        </Box>
    )
}
