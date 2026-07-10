import type { PortKind } from '../hooks/useSvgPorts'

export const PORT_COLOR: Record<PortKind, string> = {
    in: '#1565c0',   // blue  – digital/analog input
    out: '#2e7d32',   // green – digital/analog output
    inout: '#ff9800',   // amber – bidirectional / unknown
}

export const DISP_W = 60
export const DISP_H = Math.round(DISP_W * (107 / 50))   // proportional to viewBox 50×107

export const PORT_D = 11
export const PORT_HIT_D = 20

export function pct(i: number, total: number) {
    return `${((i + 1) / (total + 1)) * 100}%`
}

export function getGenericOutStyle(index: number, total: number, editMode: boolean): React.CSSProperties {
    return {
        left: pct(index, total),
        background: editMode ? PORT_COLOR.out : 'transparent',
        width: PORT_D,
        height: PORT_D,
        border: editMode ? '2px solid #fff' : 'none',
        borderRadius: '50%',
        top: -5,
        opacity: editMode ? 1 : 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

export function getGenericInStyle(index: number, total: number, editMode: boolean): React.CSSProperties {
    return {
        left: pct(index, total),
        background: editMode ? PORT_COLOR.in : 'transparent',
        width: PORT_D,
        height: PORT_D,
        border: editMode ? '2px solid #fff' : 'none',
        borderRadius: '50%',
        bottom: -5,
        opacity: editMode ? 1 : 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

export function getApInStyle(left?: string, top?: string): React.CSSProperties {
    return {
        position: 'absolute',
        left: left ?? '50%',
        top: top ?? '37.85%',
        transform: 'translate(-50%,-50%)',
        width: 10,
        height: 10,
        background: '#1565c0',
        border: '2.5px solid #fff',
        borderRadius: '50%',
        boxShadow: '0 0 0 2px #1565c0',
        zIndex: 10,
    }
}

export function getApOutStyle(left?: string, top?: string): React.CSSProperties {
    return {
        position: 'absolute',
        left: left ?? '50%',
        top: top ?? '52.8%',
        transform: 'translate(-50%,-50%)',
        width: 10,
        height: 10,
        background: '#2e7d32',
        border: '2.5px solid #fff',
        borderRadius: '50%',
        boxShadow: '0 0 0 2px #2e7d32',
        zIndex: 10,
        cursor: 'crosshair',
    }
}

export function getPortSrcStyle(cx: number, cy: number, portColor: string, editMode: boolean, isSquare?: boolean, isSmall?: boolean): React.CSSProperties {
    const size = isSmall ? PORT_D * 0.6 : PORT_D;
    return {
        position: 'absolute',
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: 'translate(-50%,-50%)',
        width: size,
        height: size,
        background: editMode ? portColor : 'transparent',
        border: editMode ? '2.5px solid #fff' : 'none',
        borderRadius: isSquare ? '2px' : '50%',
        boxShadow: editMode ? `0 0 0 2px ${portColor}` : 'none',
        zIndex: 10,
        cursor: editMode ? 'crosshair' : 'default',
        opacity: editMode ? 1 : 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

export function getPortTgtStyle(cx: number, cy: number, editMode: boolean, isSquare?: boolean, isSmall?: boolean): React.CSSProperties {
    const size = isSmall ? PORT_HIT_D * 0.6 : PORT_HIT_D;
    return {
        position: 'absolute',
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: 'translate(-50%,-50%)',
        width: size,
        height: size,
        background: 'transparent',
        border: 'none',
        borderRadius: isSquare ? '2px' : '50%',
        opacity: 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

export function supportsMountedValves(name: string, type: string): boolean {
    const upName = name.toUpperCase()
    if (/^VABX-A-(?:S-)?EL-E(?:12|34)-AP[IPA]\b/.test(upName)) return false
    return type.toLowerCase() === 'valve' || upName.startsWith('VMPAL') || upName.startsWith('VAEM') || upName.startsWith('VTUX') || /VABX-A-(?:S-)?(BV|SBV|VE|VP)/.test(upName)
}

export function defaultValveSlots(name: string, explicitSlots?: number): number | undefined {
    if (explicitSlots !== undefined) return explicitSlots
    const upName = name.toUpperCase()
    if (upName.startsWith('VTUX')) return 4
    if (upName.startsWith('VMPAL')) return 16
    return undefined
}

// Pre-computed display widths for modules with non-standard SVG aspect ratios
// (svgWidth × DISP_H / svgHeight, rounded). Keyed by exact module OrderCode name.
const KNOWN_DISP_WIDTHS: Record<string, number> = {
    // VABX interface modules – "API-P" / "APA-P" wide parallel-bus variants (SVG height 109)
    'VABX-A-EL-API-P':              177,  // 151×109
    'VABX-A-EL-APA-P':              127,  // 108×109
    // VABX-A-P-EL-* parallel port variants (SVG height 109)
    'VABX-A-P-EL-E12-API':          178,  // 151.178×109
    'VABX-A-P-EL-E12-APA':          127,  // 108×109
    'VABX-A-P-E12-CTED':            122,  // 104.179×109
    'VABX-A-P-EL-E12-CTED-MPM12':   181,  // 154.09×109
    'VABX-A-P-EL-E12-CTED-MPM8':    181,  // 154.09×109
    'VABX-A-P-EL-E12-CTED-MPRJ45':  181,  // 154×109
    // VABX-A-S-EL-* single-bus CTED variants (SVG height 109)
    'VABX-A-S-EL-E12-CTED-MPM12':   58,   // 49×109
    'VABX-A-S-EL-E12-CTED-MPM8':    58,   // 49×109
    'VABX-A-S-EL-E12-CTED-MPRJ45':  58,   // 49×109
    // CPX-AP-L wider variant (3-section connector block, SVG 148×90)
    'CPX-AP-L-16NDI8NDO-PI':        210,  // 148×90
}

export function getModuleDispW(mod: { Name: string, ValveSlots?: number }): number {
    // Exact-name lookup wins over formulas
    const known = KNOWN_DISP_WIDTHS[mod.Name]
    if (known !== undefined) return known

    const isVmpal = mod.Name.toUpperCase().startsWith('VMPAL')
    const isVaba = mod.Name.toUpperCase().startsWith('VABA')
    const isVabaX5 = mod.Name.toUpperCase().includes('X5')
    const isVaem = mod.Name.toUpperCase().startsWith('VAEM')
    const isApl = mod.Name.toUpperCase().startsWith('CPX-AP-L')
    const is32DiD = mod.Name.toUpperCase().includes('32DI-D')
    const is16DiM8 = mod.Name.toUpperCase().includes('16DI-M8-3P')
    const numValves = defaultValveSlots(mod.Name, mod.ValveSlots)

    if (isVmpal && numValves !== undefined) {
        const svgW = 33 + numValves * 10
        return Math.round(svgW * (DISP_H / 109))
    } else if (isVaba && numValves !== undefined) {
        const svgW = isVabaX5 ? (72 + numValves * 17) : (45 + numValves * 17)
        return Math.round(svgW * (DISP_H / 145))
    } else if (isVaem) {
        // Parse solenoid count from name: "VAEM-L1-S-12-AP" → 12
        // SVG width formula (validated against S-12=115 and S-24=139): svgW = 91 + 2×N
        const match = /VAEM-[^-]+-S-(\d+)/.exec(mod.Name)
        const nSolenoids = match ? parseInt(match[1]) : (numValves ?? 12)
        return Math.round((91 + 2 * nSolenoids) * (DISP_H / 104))
    } else if (isApl) {
        // CPX-AP-L-16DIO-PI and CPX-AP-L-16NDI-PI both use 102×90 SVG
        return Math.round(102 * (DISP_H / 90))
    } else if (is32DiD || is16DiM8) {
        return Math.round(100 * (DISP_H / 107))
    }
    return DISP_W
}
