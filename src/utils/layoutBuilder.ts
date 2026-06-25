import type { Edge } from '@xyflow/react'
import type { TopologyModule, DiffStatus } from '../types'
import type { ModuleNodeData } from '../components/ModuleNode'
import type { BackplaneNodeData } from '../components/BackplaneNode'
import type { Node } from '@xyflow/react'

// ─── Module classification ────────────────────────────────────────────────────

export function isApA(name: string, series?: string): boolean {
    return series === 'CPX-AP-A' || name.includes('CPX-AP-A')
}

/** Valve bank body – physically snapped directly to its interface, no cable.
 *  Matches both: VABX-A-BV-* and VABX-A-S-BV-* (with 'S-' infix). */
export function isValveBody(name: string): boolean {
    return /VABX-A-(?:S-)?(BV|SBV|VE|VP)/.test(name)
}

/** Valve bank interface – connects to the AP bus via cable (VABX-A-EL/EP in any variant) */
export function isValveInterface(name: string): boolean {
    // Matches: VABX-A-EL-*, VABX-A-EP-*, VABX-A-S-EL-*, VABX-A-S-EP-*
    return name.startsWith('VABX-A') && /-E[LP][-_]/.test(name)
}

// ─── Segmentation ─────────────────────────────────────────────────────────────

export type SegmentKind = 'apa' | 'valve' | 'api'

export interface Segment {
    kind: SegmentKind
    mods: TopologyModule[]
    id: string
}

/**
 * Group the flat module list into logical segments:
 * - 'apa'   – CPX-AP-A modules (backplane) plus any VABX bodies directly attached
 *             via a PCB adapter (no interface module, no cable).
 * - 'valve' – VABX-A-EL/EP interface + directly-snapped VABX valve bodies
 * - 'api'   – all other standalone AP-I bus modules
 */
export function segmentModules(mods: TopologyModule[]): Segment[] {
    const segs: Segment[] = []
    let i = 0
    while (i < mods.length) {
        const m = mods[i]
        if (isApA(m.Name, m.Series)) {
            const run: TopologyModule[] = []
            while (i < mods.length && isApA(mods[i].Name, mods[i].Series)) run.push(mods[i++])
            // VABX bodies that follow an AP-A run with no interface module are physically
            // snapped onto the AP-A backplane via a PCB adapter – no cable, no separate group.
            while (i < mods.length && isValveBody(mods[i].Name)) run.push(mods[i++])
            segs.push({ kind: 'apa', mods: run, id: `apa-${run[0].Adress}` })
        } else if (isValveInterface(m.Name) || isValveBody(m.Name)) {
            const run: TopologyModule[] = [m]
            i++
            while (i < mods.length && isValveBody(mods[i].Name)) run.push(mods[i++])
            segs.push({ kind: 'valve', mods: run, id: `valve-${run[0].Adress}` })
        } else {
            segs.push({ kind: 'api', mods: [m], id: `api-${m.Adress}` })
            i++
        }
    }
    return segs
}

// ─── Layout constants ─────────────────────────────────────────────────────────

export const NODE_W    = 75   // width of a module card
export const NODE_H    = 152  // approximate height of a module card (for group sizing)
export const INLINE_G  = 2    // gap between modules on same backplane/rail
export const CABLE_G   = 160  // gap between cable-connected segments
export const NODE_Y    = 70   // canvas Y for all module nodes
const        BP_PAD    = 6    // padding around the AP-A backplane group box

// ─── Layout builder ───────────────────────────────────────────────────────────

type ModNode = Node<ModuleNodeData, 'mod'>
type BpNode  = Node<BackplaneNodeData, 'backplane'>

export function buildLayout(
    mods: TopologyModule[],
    diffStatus: DiffStatus | null,
    editMode: boolean,
): { nodes: (ModNode | BpNode)[]; edges: Edge[] } {
    const segments = segmentModules(mods)
    const bgNodes:  BpNode[]  = []   // pushed first → renders behind module nodes
    const modNodes: ModNode[] = []
    const edges: Edge[] = []

    let curX = 40

    type SegInfo = { seg: Segment; lastId: string }
    const placed: SegInfo[] = []

    for (const seg of segments) {
        let lastId = String(seg.mods[0].Adress)

        // ── Group background for AP-A and valve assemblies ────
        if (seg.kind === 'apa' || seg.kind === 'valve') {
            const segW = seg.mods.length * (NODE_W + INLINE_G) - INLINE_G
            bgNodes.push({
                id: `backplane-${seg.id}`,
                type: 'backplane' as const,
                position: { x: curX - BP_PAD, y: NODE_Y - BP_PAD },
                style: {
                    width:  segW + BP_PAD * 2,
                    height: NODE_H + BP_PAD * 2,
                    pointerEvents: 'none',
                },
                data: {
                    label: seg.kind === 'apa' ? 'CPX-AP-A Terminal' : 'VABX Assembly',
                },
                selectable: false,
                draggable: false,
            })
        }

        seg.mods.forEach((m, i) => {
            const id      = String(m.Adress)
            const isFirst = i === 0
            const isLast  = i === seg.mods.length - 1
            const stride  = NODE_W + INLINE_G
            // VABX body directly on an AP-A backplane (PCB-adapter case, no interface module)
            const isDirectValveBody = seg.kind === 'apa' && isValveBody(m.Name)

            modNodes.push({
                id,
                type: 'mod' as const,
                position: { x: curX + i * stride, y: NODE_Y },
                // AP-A and valve assembly modules are locked as one rigid block
                draggable: seg.kind !== 'apa' && seg.kind !== 'valve',
                data: {
                    mod: m,
                    status: diffStatus?.[m.Adress] ?? 'unchanged',
                    editMode,
                    isBackplane: seg.kind === 'apa' || (seg.kind === 'valve' && !isFirst),
                    showLeftHandle:    isFirst,
                    showRightHandle:   isLast,
                    showValveEditor:   editMode && ((seg.kind === 'valve' && !isFirst) || isDirectValveBody),
                    // VABX bodies have no external M12 connectors – no IO handles
                    suppressIoHandles: (seg.kind === 'valve' && !isFirst) || isDirectValveBody,
                },
            })
            lastId = id
        })

        placed.push({ seg, lastId })
        const segW = seg.mods.length * (NODE_W + INLINE_G)
        curX += segW + CABLE_G
    }

    // ── Cable edges between consecutive segments ──────────
    const cableStyle = { strokeDasharray: '6 4', strokeWidth: 1.5, stroke: '#607d8b' }

    placed.slice(0, -1).forEach(({ lastId }, si) => {
        const nextFirstId = String(placed[si + 1].seg.mods[0].Adress)
        edges.push({
            id: `cable-${si}`,
            source: lastId,
            sourceHandle: 'right',
            target: nextFirstId,
            targetHandle: 'left',
            type: 'smoothstep',
            animated: true,
            label: 'AP Cable',
            labelStyle: { fontSize: 10, fill: '#1565c0', fontWeight: 700 },
            labelBgStyle: { fill: '#e3f2fd', fillOpacity: 0.9 },
            style: cableStyle,
            zIndex: 2,
            data: { kind: 'cable' },
        })
    })

    return { nodes: [...bgNodes, ...modNodes], edges }
}
