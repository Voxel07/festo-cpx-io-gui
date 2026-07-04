/**
 * useSvgMap.ts
 *
 * This file provides hooks and utilities for mapping CPX-AP module names and OrderCodes
 * to their corresponding SVG file assets. It processes a bundled JSON mapping at build time
 * to allow instant, synchronous lookups for the topology and connections canvas, handling
 * variants like wide modules for 16-channel devices and generic fallback SVGs.
 */
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
    return _builtinMaps
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
            // 16-channel AP-I devices use the Wide module SVG (more connector positions)
            const isWide = /(?:16(?:DI|DIO|NDI|NIDO))/.test(upperName)
            if (upperName.includes('M12')) {
                file = isWide ? 'CPX-AP-I-M12_Wide.svg' : 'CPX-AP-I-M12.svg'
            } else if (upperName.includes('M8')) {
                file = isWide ? 'CPX-AP-I-M8_Wide.svg' : 'CPX-AP-I-M8.svg'
            } else if (upperName.includes('16DI')) {
                // 16DI without explicit M8/M12 — default to M8 Wide
                file = 'CPX-AP-I-M8_Wide.svg'
            }
        }
    }

    if (!file) {
        file = 'CPX-AP-A_Generic.svg'
    }
    return `/svg/${file}`
}

