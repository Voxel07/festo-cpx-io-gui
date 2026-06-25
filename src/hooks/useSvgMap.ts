import { useState, useEffect } from 'react'

type SvgMap = Record<string, string>

interface IconVariant {
    OrderCode: string
    ModuleCode?: string | number
}

interface IconEntry {
    OrderCode?: string
    ModuleCode?: string | number
    FileName: string
    /** Some entries share one image for multiple order codes */
    Variants?: IconVariant[]
}

interface IconFileMapping {
    IconFileMapping: IconEntry[]
}

let cacheByName: SvgMap | null = null
let cacheByCode: SvgMap | null = null  // ModuleCode -> FileName

function buildMaps(data: IconFileMapping): { byName: SvgMap; byCode: SvgMap } {
    const byName: SvgMap = {}
    const byCode: SvgMap = {}

    for (const e of data.IconFileMapping) {
        if (e.Variants) {
            // Multi-variant entry: FileName is shared, each variant has its own OrderCode/ModuleCode
            for (const v of e.Variants) {
                byName[v.OrderCode.trim()] = e.FileName
                if (v.ModuleCode != null) byCode[String(v.ModuleCode)] = e.FileName
            }
        } else if (e.OrderCode) {
            // Standard entry
            // OrderCode may be a slash-separated list (e.g. "CPX-AP-A / CPX-AP-B")
            for (const oc of e.OrderCode.split('/')) {
                byName[oc.trim()] = e.FileName
            }
            if (e.ModuleCode != null) byCode[String(e.ModuleCode)] = e.FileName
        }
    }
    return { byName, byCode }
}

export function useSvgMap(): { byName: SvgMap; byCode: SvgMap } {
    const [maps, setMaps] = useState<{ byName: SvgMap; byCode: SvgMap }>(
        () => ({ byName: cacheByName ?? {}, byCode: cacheByCode ?? {} })
    )

    useEffect(() => {
        if (cacheByName) { setMaps({ byName: cacheByName, byCode: cacheByCode! }); return }
        fetch('/svg-map')
            .then(r => r.json())
            .then((data: IconFileMapping) => {
                const { byName, byCode } = buildMaps(data)
                cacheByName = byName
                cacheByCode = byCode
                setMaps({ byName, byCode })
            })
            .catch(() => {})
    }, [])

    return maps
}

/** Resolve the SVG URL for a module by order-code name, with ModuleCode fallback. */
export function resolveIcon(name: string, maps: { byName: SvgMap; byCode: SvgMap }, moduleCode?: number): string {
    const file = maps.byName[name]
        ?? (moduleCode != null ? maps.byCode[String(moduleCode)] : undefined)
        ?? 'CPX-AP-A_Generic.svg'
    return `/svg/${file}`
}

