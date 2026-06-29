import { useState, useEffect, useMemo } from 'react'
// Icon file mapping bundled at build time — no network fetch needed.
import iconMapping from '../assets/IconFileMapping.json'

type SvgMap = Record<string, string>

// ── Build maps once at module init (zero-cost after first import) ────────────

function buildMaps(): { byName: SvgMap; byCode: SvgMap } {
    const byName: SvgMap = {}
    const byCode: SvgMap = {}

    for (const e of (iconMapping as { IconFileMapping: Array<{
        OrderCode?: string; ModuleCode?: string | number; FileName: string
        Variants?: Array<{ OrderCode: string; ModuleCode?: string | number }>
    }> }).IconFileMapping) {
        if (e.Variants) {
            for (const v of e.Variants) {
                byName[v.OrderCode.trim()] = e.FileName
                if (v.ModuleCode != null) byCode[String(v.ModuleCode)] = e.FileName
            }
        } else if (e.OrderCode) {
            for (const oc of e.OrderCode.split('/')) {
                byName[oc.trim()] = e.FileName
            }
            if (e.ModuleCode != null) byCode[String(e.ModuleCode)] = e.FileName
        }
    }
    return { byName, byCode }
}

const _builtinMaps = buildMaps()

// ── Hook: returns the pre-built maps (no fetch, no state, instant) ──────────

export function useSvgMap(): { byName: SvgMap; byCode: SvgMap } {
    return useMemo(() => _builtinMaps, [])
}

/** Resolve the SVG URL for a module by order-code name, with ModuleCode fallback. */
export function resolveIcon(
    name: string,
    maps: { byName: SvgMap; byCode: SvgMap },
    moduleCode?: number,
): string {
    let file = maps.byName[name]
        ?? (moduleCode != null ? maps.byCode[String(moduleCode)] : undefined)

    if (!file) {
        const upperName = name.toUpperCase()
        if (upperName.includes('CPX-AP-I') || upperName.includes('AP-I')) {
            if (upperName.includes('M12')) {
                file = 'CPX-AP-I-M12.svg'
            } else if (upperName.includes('M8') || upperName.includes('16DI')) {
                file = 'CPX-AP-I-M8.svg'
            }
        }
    }

    if (!file) {
        file = 'CPX-AP-A_Generic.svg'
    }
    return `/svg/${file}`
}

