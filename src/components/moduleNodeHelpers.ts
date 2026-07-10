import type { PortKind } from '../hooks/useSvgPorts'

export const PORT_COLOR: Record<PortKind, string> = {
    in: '#1565c0',   // blue  – digital/analog input
    out: '#2e7d32',   // green – digital/analog output
    inout: '#ff9800',   // amber – bidirectional / unknown
    'ap-in': 'transparent',
    'ap-out': 'transparent',
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

export function getPortSrcStyle(cx: number, cy: number, editMode: boolean, isSquare?: boolean, isSmall?: boolean): React.CSSProperties {
    const size = isSmall ? PORT_D * 0.6 : PORT_D;
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
        boxShadow: 'none',
        zIndex: 10,
        cursor: editMode ? 'crosshair' : 'default',
        opacity: 0,
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
}

export function getModuleDispSize(mod: { Name: string, ValveSlots?: number }): { w: number, h: number } {
    // Constant scale factor (approx 1.2 pixels per SVG unit)
    const SCALE = DISP_H / 107; // DISP_H is 128, so 128/107 ≈ 1.196
    
    // Exact-name lookup for widths (if specified, we still scale height according to its known SVG height, which we'd have to guess, so fallback to width-only overrides is tricky. Actually KNOWN_DISP_WIDTHS only has widths. Let's just return fixed heights for those if they are AP-A)
    const upName = mod.Name.toUpperCase()
    const isVmpal = upName.startsWith('VMPAL')
    const isVaba = upName.startsWith('VABA')
    const isVabaX5 = upName.includes('X5')
    const isVaem = upName.startsWith('VAEM')
    const isApl = upName.startsWith('CPX-AP-L')
    const is32DiD = upName.includes('32DI-D')
    const is16DiM8 = upName.includes('16DI-M8-3P')
    const isEpli = upName.includes('EPLI')
    const isApI = upName.startsWith('CPX-AP-I')
    const isVabx = upName.startsWith('VABX')
    const numValves = defaultValveSlots(mod.Name, mod.ValveSlots)

    const knownW = KNOWN_DISP_WIDTHS[mod.Name]
    
    if (isVmpal && numValves !== undefined) {
        const svgW = 33 + numValves * 10
        return { w: Math.round(svgW * SCALE), h: Math.round(109 * SCALE) }
    } else if (isVaba && numValves !== undefined) {
        const svgW = isVabaX5 ? (72 + numValves * 17) : (45 + numValves * 17)
        return { w: Math.round(svgW * SCALE), h: Math.round(145 * SCALE) }
    } else if (isVaem) {
        const match = /VAEM-[^-]+-S-(\d+)/.exec(mod.Name)
        const nSolenoids = match ? parseInt(match[1]) : (numValves ?? 12)
        return { w: Math.round((91 + 2 * nSolenoids) * SCALE), h: Math.round(104 * SCALE) }
    } else if (isApl) {
        let defaultW = 102
        if (upName.includes('16NDI8NDO')) {
            defaultW = 148
        }
        return { w: knownW ?? Math.round(defaultW * SCALE), h: Math.round(90 * SCALE) }
    } else if (isApI) {
        // AP-I must be checked before is32DiD/is16DiM8 so AP-I modules like
        // CPX-AP-I-16DI-M8-3P aren't misclassified as AP-A form-factor modules.
        const isBusNode = upName.endsWith('-M12') && (upName.includes('-PN-') || upName.includes('-EP-') || upName.includes('-EC-') || upName.includes('-PB-') || upName.includes('-CCB-'))
        const isWideIo = /(?:16(?:DI|DIO|NDI|NDIO|NIDO))/.test(upName)
        const svgW = isBusNode ? 54 : (isWideIo ? 68 : 33)
        return { w: Math.round(svgW * SCALE), h: Math.round(186 * SCALE) }
    } else if (is32DiD || is16DiM8) {
        return { w: Math.round(100 * SCALE), h: Math.round(107 * SCALE) }
    } else if (isEpli) {
        return { w: Math.round(31 * SCALE), h: Math.round(107 * SCALE) }
    } else if (isVabx) {
        if (upName.includes('-V4A')) return { w: Math.round(43 * SCALE), h: Math.round(109 * SCALE) }
        if (upName.includes('-V4B')) return { w: Math.round(51 * SCALE), h: Math.round(109 * SCALE) }
    }
    
    return { w: knownW ?? DISP_W, h: DISP_H }
}

export function getModuleDispW(mod: { Name: string, ValveSlots?: number }): number {
    return getModuleDispSize(mod).w
}





