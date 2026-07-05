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

export function getPortSrcStyle(cx: number, cy: number, portColor: string, editMode: boolean): React.CSSProperties {
    return {
        position: 'absolute',
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: 'translate(-50%,-50%)',
        width: PORT_D,
        height: PORT_D,
        background: editMode ? portColor : 'transparent',
        border: editMode ? '2.5px solid #fff' : 'none',
        borderRadius: '50%',
        boxShadow: editMode ? `0 0 0 2px ${portColor}` : 'none',
        zIndex: 10,
        cursor: editMode ? 'crosshair' : 'default',
        opacity: editMode ? 1 : 0,
        pointerEvents: editMode ? undefined : 'none',
    }
}

export function getPortTgtStyle(cx: number, cy: number, editMode: boolean): React.CSSProperties {
    return {
        position: 'absolute',
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: 'translate(-50%,-50%)',
        width: PORT_HIT_D,
        height: PORT_HIT_D,
        background: 'transparent',
        border: 'none',
        borderRadius: '50%',
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
