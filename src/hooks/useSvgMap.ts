/**
 * useSvgMap.ts
 *
 * This file provides hooks and utilities for mapping CPX-AP module names and OrderCodes
 * to their corresponding SVG file assets. The mapping is fetched once at runtime from
 * /svg/IconFileMapping.json and cached at module level, then used for instant,
 * synchronous lookups for the topology and connections canvas.
 */
import { useState, useEffect } from 'react'

type SvgMap = Record<string, string>

interface IconMappingEntry {
    OrderCode?: string
    ModuleCode?: string | number
    FileName: string
    Variants?: Array<{ OrderCode: string; ModuleCode?: string | number }>
}

// ── Module-level cache: fetch once, share across all components ────────────

let _cachedMaps: { byName: SvgMap; byCode: SvgMap } | null = null
let _fetchPromise: Promise<void> | null = null

function buildMaps(entries: IconMappingEntry[]): { byName: SvgMap; byCode: SvgMap } {
    const byName: SvgMap = {}
    const byCode: SvgMap = {}

    for (const e of entries) {
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

function ensureMaps(): Promise<void> {
    if (_cachedMaps) return Promise.resolve()
    if (!_fetchPromise) {
        _fetchPromise = fetch('/svg/IconFileMapping.json')
            .then(r => {
                if (!r.ok) throw new Error(`SVG map request failed: ${r.status}`)
                return r.json()
            })
            .then((data: { IconFileMapping: IconMappingEntry[] }) => {
                if (!Array.isArray(data.IconFileMapping)) throw new Error('Invalid SVG map response')
                _cachedMaps = buildMaps(data.IconFileMapping)
            })
            .catch(error => {
                _fetchPromise = null
                throw error
            })
    }
    return _fetchPromise
}

// ── Hook: returns maps, falling back to empty maps until the fetch completes ─

export function useSvgMap(): { byName: SvgMap; byCode: SvgMap } {
    const [maps, setMaps] = useState<{ byName: SvgMap; byCode: SvgMap }>(
        _cachedMaps ?? { byName: {}, byCode: {} },
    )

    useEffect(() => {
        if (!_cachedMaps) {
            let cancelled = false
            ensureMaps()
                .then(() => { if (!cancelled && _cachedMaps) setMaps(_cachedMaps) })
                .catch(() => { /* transient failure; the next mount retries */ })
            return () => { cancelled = true }
        }
    }, [])

    return maps
}

/** Resolve the SVG URL for a module by order-code name, with ModuleCode fallback. */
export function resolveIcon(
    name: string,
    maps: { byName: SvgMap; byCode: SvgMap },
    moduleCode?: number,
): string {
    // Some topology sources omit the second separator in EL-E12/EL-E34.
    const canonicalName = name.replace(/-EL(12|34)-/i, '-EL-E$1-')
    let file = maps.byName[name]
        ?? maps.byName[canonicalName]
        ?? (moduleCode != null ? maps.byCode[String(moduleCode)] : undefined)

    if (!file) {
        const upperName = canonicalName.toUpperCase()
        const fallbackName = Object.keys(maps.byName)
            .filter(key => {
                const upperKey = key.toUpperCase()
                return upperName === upperKey || upperName.startsWith(`${upperKey}-`)
            })
            .sort((a, b) => b.length - a.length)[0]
        if (fallbackName) file = maps.byName[fallbackName]
    }

    if (!file) {
        const upperName = canonicalName.toUpperCase()
        if (upperName.includes('CPX-AP-I') || upperName.includes('AP-I')) {
            // 16-channel AP-I devices use the Wide module SVG (more connector positions)
            const isWide = /(?:16(?:DI|DIO|NDI|NDIO|NIDO))/.test(upperName)
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

