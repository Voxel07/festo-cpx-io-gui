import { useRef } from 'react'
import { Box } from '@mui/material'
import { buildRows } from '../utils/diffBuilder'
import type { DiffRow } from '../utils/diffBuilder'
import type { CompareResult } from '../types'

const KIND = {
    ctx: { bg: '#ffffff', gutterBg: '#f8f8f8', fg: '#444', gfg: '#bbb', prefix: ' ' },
    del: { bg: '#ffebe9', gutterBg: '#ffd7d5', fg: '#9a1b1b', gfg: '#9a1b1b', prefix: '−' },
    add: { bg: '#e6ffed', gutterBg: '#ccffd8', fg: '#057a35', gfg: '#057a35', prefix: '+' },
    empty: { bg: '#f8f8f8', gutterBg: '#f0f0f0', fg: '#ccc', gfg: '#ccc', prefix: ' ' },
} as const

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

    const header = side === 'left'
        ? { label: '--- stored', color: '#f48771' }
        : { label: '+++ live (device)', color: '#b5d397' }

    return (
        <Box
            ref={myRef}
            onScroll={onScroll}
            sx={{
                flex: 1, overflow: 'auto', minWidth: 0,
                borderRight: side === 'left' ? '2px solid #ccc' : 'none',
            }}
        >
            {/* Sticky header */}
            <Box sx={{
                fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem',
                background: '#1e1e2e', color: header.color,
                px: 1.5, py: 0.8, position: 'sticky', top: 0, zIndex: 2,
            }}>
                {header.label}
            </Box>

            {rows.map((row, i) => {
                const cell = side === 'left' ? row.l : row.r
                const s = KIND[cell.kind]
                return (
                    <Box key={i} sx={{ display: 'flex', minHeight: 20, background: s.bg }}>
                        <Box sx={{
                            minWidth: 40, px: 0.5, textAlign: 'right',
                            background: s.gutterBg, color: s.gfg,
                            fontSize: 10, lineHeight: '20px',
                            borderRight: '1px solid #ddd',
                            fontFamily: 'monospace', flexShrink: 0, userSelect: 'none',
                        }}>
                            {cell.no ?? ''}
                        </Box>
                        <Box sx={{
                            width: 16, textAlign: 'center', lineHeight: '20px',
                            fontFamily: 'monospace', fontSize: 12,
                            background: s.gutterBg, color: s.fg,
                            borderRight: '1px solid #ddd', flexShrink: 0,
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
            <Box sx={{ mb: 1, fontFamily: 'monospace', fontSize: '0.82rem', px: 0.5, display: 'flex', gap: 2 }}>
                {cmpData.has_diff ? (
                    <>
                        <span style={{ color: '#057a35' }}>+{adds} addition{adds !== 1 && 's'}</span>
                        <span style={{ color: '#9a1b1b' }}>−{dels} deletion{dels !== 1 && 's'}</span>
                    </>
                ) : (
                    <span style={{ color: '#2e7d32' }}>✓ No differences</span>
                )}
            </Box>

            <Box sx={{ display: 'flex', border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
                <DiffPane rows={rows} side="left" myRef={leftRef} peerRef={rightRef} />
                <DiffPane rows={rows} side="right" myRef={rightRef} peerRef={leftRef} />
            </Box>
        </Box>
    )
}
