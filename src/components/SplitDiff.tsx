import { useRef } from 'react'
import { Box } from '@mui/material'
import { buildRows } from '../utils/diffBuilder'
import type { DiffRow } from '../utils/diffBuilder'
import type { CompareResult } from '../types'

import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

function getKindStyles(kind: 'ctx' | 'del' | 'add' | 'empty', theme: Theme) {
    const isDark = theme.palette.mode === 'dark'
    switch (kind) {
        case 'ctx': return { bg: isDark ? '#1e1e1e' : '#ffffff', gutterBg: isDark ? '#2d2d2d' : '#f8f8f8', fg: isDark ? '#d4d4d4' : '#444', gfg: isDark ? '#888' : '#bbb', prefix: ' ' }
        case 'del': return { bg: isDark ? 'rgba(248, 81, 73, 0.15)' : '#ffebe9', gutterBg: isDark ? 'rgba(248, 81, 73, 0.3)' : '#ffd7d5', fg: isDark ? '#ff7b72' : '#9a1b1b', gfg: isDark ? '#ff7b72' : '#9a1b1b', prefix: '−' }
        case 'add': return { bg: isDark ? 'rgba(46, 160, 67, 0.15)' : '#e6ffed', gutterBg: isDark ? 'rgba(46, 160, 67, 0.3)' : '#ccffd8', fg: isDark ? '#3fb950' : '#057a35', gfg: isDark ? '#3fb950' : '#057a35', prefix: '+' }
        case 'empty': return { bg: isDark ? '#2d2d2d' : '#f8f8f8', gutterBg: isDark ? '#1e1e1e' : '#f0f0f0', fg: isDark ? '#555' : '#ccc', gfg: isDark ? '#555' : '#ccc', prefix: ' ' }
    }
}

interface DiffPaneProps {
    rows: DiffRow[]
    side: 'left' | 'right'
    myRef: React.RefObject<HTMLDivElement | null>
    peerRef: React.RefObject<HTMLDivElement | null>
}

function DiffPane({ rows, side, myRef, peerRef }: DiffPaneProps) {
    const syncing = useRef(false)

    function onScroll(e: React.UIEvent<HTMLDivElement>) {
        if (syncing.current) return
        syncing.current = true
        if (peerRef.current) peerRef.current.scrollTop = e.currentTarget.scrollTop
        requestAnimationFrame(() => { syncing.current = false })
    }

    const theme = useTheme()
    const isDark = theme.palette.mode === 'dark'

    const header = side === 'left'
        ? { label: '--- stored', bg: isDark ? 'rgba(248, 81, 73, 0.15)' : '#ffeef0', color: isDark ? '#ff7b72' : '#9a1b1b' }
        : { label: '+++ live (device)', bg: isDark ? 'rgba(46, 160, 67, 0.15)' : '#eaffed', color: isDark ? '#3fb950' : '#057a35' }

    return (
        <Box
            ref={myRef}
            onScroll={onScroll}
            sx={{
                flex: 1, overflow: 'auto', minWidth: 0,
                borderRight: side === 'left' ? 2 : 0, borderColor: 'divider',
            }}
        >
            {/* Sticky header */}
            <Box sx={{
                fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem',
                background: header.bg, color: header.color,
                px: 1.5, py: 0.8, position: 'sticky', top: 0, zIndex: 2,
                borderBottom: 1, borderColor: 'divider',
            }}>
                {header.label}
            </Box>

            {rows.map((row, i) => {
                const cell = side === 'left' ? row.l : row.r
                const s = getKindStyles(cell.kind, theme)
                return (
                    <Box key={`${row.l.no ?? 'L'}-${row.r.no ?? 'R'}-${i}`} sx={{ display: 'flex', minHeight: 20, background: s.bg }}>
                        <Box sx={{
                            minWidth: 40, px: 0.5, textAlign: 'right',
                            background: s.gutterBg, color: s.gfg,
                            fontSize: 10, lineHeight: '20px',
                            borderRight: 1, borderColor: 'divider',
                            fontFamily: 'monospace', flexShrink: 0, userSelect: 'none',
                        }}>
                            {cell.no ?? ''}
                        </Box>
                        <Box sx={{
                            width: 16, textAlign: 'center', lineHeight: '20px',
                            fontFamily: 'monospace', fontSize: 12,
                            background: s.gutterBg, color: s.fg,
                            borderRight: 1, borderColor: 'divider', flexShrink: 0,
                        }}>
                            {cell.kind !== 'empty' ? s.prefix : ''}
                        </Box>
                        <Box component="span" sx={{
                            px: 1, fontFamily: 'monospace', fontSize: 12,
                            lineHeight: '20px', whiteSpace: 'pre', flex: 1,
                            color: s.fg, overflow: 'hidden',
                        }}>
                            {cell.kind !== 'empty' ? cell.text : ''}
                        </Box>
                    </Box>
                )
            })}
        </Box>
    )
}

interface Props {
    cmpData: CompareResult
}

export default function SplitDiff({ cmpData }: Props) {
    const rows = buildRows(cmpData)
    const leftRef = useRef<HTMLDivElement>(null)
    const rightRef = useRef<HTMLDivElement>(null)

    const adds = rows.filter(r => r.r.kind === 'add').length
    const dels = rows.filter(r => r.l.kind === 'del').length

    return (
        <Box>
            {cmpData.has_diff && (
                <Box sx={{ mb: 1, fontFamily: 'monospace', fontSize: '0.82rem', px: 0.5, display: 'flex', gap: 2 }}>
                    <span style={{ color: 'var(--mui-palette-success-main)' }}>+{adds} addition{adds !== 1 && 's'}</span>
                    <span style={{ color: 'var(--mui-palette-error-main)' }}>−{dels} deletion{dels !== 1 && 's'}</span>
                </Box>
            )}

            <Box sx={{ display: 'flex', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <DiffPane rows={rows} side="left" myRef={leftRef} peerRef={rightRef} />
                <DiffPane rows={rows} side="right" myRef={rightRef} peerRef={leftRef} />
            </Box>
        </Box>
    )
}
