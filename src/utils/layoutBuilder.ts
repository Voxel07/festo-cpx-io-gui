import type { Edge } from '@xyflow/react'
import type { TopologyModule, DiffStatus } from '../types'
import type { ModuleNodeData } from '../components/ModuleNode'
import type { BackplaneNodeData } from '../components/BackplaneNode'
import type { Node } from '@xyflow/react'

// ─── Module classification ────────────────────────────────────────────────────

function isApA(name: string, series?: string): boolean {
    return series === 'CPX-AP-A' || name.includes('CPX-AP-A')
}

/** EPLI interface module — AP-bus connectors are on top (AP-in) and bottom (AP-out)
 *  rather than left/right like regular AP-I modules. */
function isEpli(name: string): boolean {
    return name.includes('EPLI')
}

/** VABX valve interface with AP pass-through connectors (e.g. VABX-A-S-EL-E12-API).
 *  XF10 (top) = AP-in, XF20 (bottom) = AP-out — positioned on left side of SVG. */
function isVabxApInterface(name: string): boolean {
    return /^VABX-A-(?:S-)?EL-\w+-API/.test(name)
}

function isApIM12orM8(name: string): boolean {
    const upperName = name.toUpperCase()
    return (upperName.includes('CPX-AP-I') || upperName.includes('AP-I')) && (upperName.includes('M12') || upperName.includes('M8'))
}

/** AP-chain interface — module that has explicit ap-in / ap-out handles instead of
 *  the standard left/right cable handles. */
function isApChainInterface(name: string): boolean {
    return isEpli(name) || isVabxApInterface(name) || isApIM12orM8(name)
}

/** Handle position percentages within the SVG image container box (60 × 128 px).
 *  Derived from connector circle centres in each module's SVG. */
function getApHandlePos(name: string): {
    apInTop: string; apInLeft: string
    apOutTop: string; apOutLeft: string
} {
    if (isVabxApInterface(name)) {
        // VABX-A-EL-API-S.svg viewBox 46×109; objectFit:contain scale = 128/109 ≈ 1.174
        // XF10 cy=23.5 → 21.6 %  |  XF20 cy=44.5 → 40.8 %  |  cx=12.0 → 28.5 %
        return { apInTop: '21.6%', apInLeft: '28.5%', apOutTop: '40.8%', apOutLeft: '28.5%' }
    }
    if (isApIM12orM8(name)) {
        // M12/M8 SVG 33.005×186; objectFit:contain scale = 128/186 ≈ 0.688
        // XF10 cx=8.5, cy=139.5 → cx = 25.75%, cy = 75%
        // XF20 cx=25.5, cy=139.5 → cx = 77.26%, cy = 75%
        return { apInTop: '75%', apInLeft: '25.75%', apOutTop: '75%', apOutLeft: '77.26%' }
    }
    // EPLI SVG 31×107; objectFit:contain scale = 128/107 ≈ 1.196
    // XF10 cy=40.5 → 37.85 %  |  XF20 cy=56.5 → 52.8 %  |  cx=15.5 → 50 %
    return { apInTop: '37.85%', apInLeft: '50%', apOutTop: '52.8%', apOutLeft: '50%' }
}

/** Valve bank body – physically snapped directly to its interface, no cable.
 *  Matches both: VABX-A-BV-* and VABX-A-S-BV-* (with 'S-' infix). */
function isValveBody(name: string): boolean {
    return /VABX-A-(?:S-)?(BV|SBV|VE|VP)/.test(name)
}

/** Valve bank interface – connects to the AP bus via cable (VABX-A-EL/EP in any variant) */
function isValveInterface(name: string): boolean {
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
function segmentModules(mods: TopologyModule[]): Segment[] {
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

const NODE_W = 75   // width of a module card
const NODE_H = 152  // approximate height of a module card (for group sizing)
const INLINE_G = 0    // gap between modules on same backplane/rail (none – tight fit)
const CABLE_G = 160  // gap between cable-connected segments
const NODE_Y = 70   // canvas Y for all module nodes
const BP_PAD_TOP = 10   // space above modules in group box
const BP_PAD_BOT = 18   // space below modules (name/chips extend further down)
const BP_PAD_SIDE = 8    // horizontal padding in group box

// ─── Layout builder ───────────────────────────────────────────────────────────

type ModNode = Node<ModuleNodeData, 'mod'>
type BpNode = Node<BackplaneNodeData, 'backplane'>

export function buildLayout(
    mods: TopologyModule[],
    diffStatus: DiffStatus | null,
    editMode: boolean,
): { nodes: (ModNode | BpNode)[]; edges: Edge[] } {
    const segments = segmentModules(mods)
    const bgNodes: BpNode[] = []   // pushed first → renders behind module nodes
    const modNodes: ModNode[] = []
    const edges: Edge[] = []

    let curX = 40

    type SegInfo = { seg: Segment; lastId: string; epliId: string | null }
    const placed: SegInfo[] = []

    for (const seg of segments) {
        let lastId = String(seg.mods[0].Adress)

        // ── Group background for AP-A and valve assemblies ────
        const isGroup = seg.kind === 'apa' || seg.kind === 'valve'
        if (isGroup) {
            const segW = seg.mods.length * (NODE_W + INLINE_G) - INLINE_G
            const addrRange = seg.mods.length > 1
                ? `#${seg.mods[0].Adress}–#${seg.mods[seg.mods.length - 1].Adress}`
                : `#${seg.mods[0].Adress}`
            bgNodes.push({
                id: `backplane-${seg.id}`,
                type: 'backplane' as const,
                position: { x: curX - BP_PAD_SIDE, y: NODE_Y - BP_PAD_TOP },
                style: {
                    width: segW + BP_PAD_SIDE * 2,
                    height: BP_PAD_TOP + NODE_H + BP_PAD_BOT,
                },
                data: {
                    label: seg.kind === 'apa'
                        ? `CPX-AP-A Terminal [${addrRange}]`
                        : `VABX Assembly [${addrRange}]`,
                },
                selectable: false,
                draggable: true,
            })
        }

        seg.mods.forEach((m, i) => {
            const id = String(m.Adress)
            const isFirst = i === 0
            const isLast = i === seg.mods.length - 1
            const stride = NODE_W + INLINE_G
            const isDirectValveBody = seg.kind === 'apa' && isValveBody(m.Name)
            const modIsEpli = isEpli(m.Name)
            const modIsApChain = isApChainInterface(m.Name)
            const apPos = modIsApChain ? getApHandlePos(m.Name) : undefined

            modNodes.push({
                id,
                type: 'mod' as const,
                parentId: isGroup ? `backplane-${seg.id}` : undefined,
                position: isGroup
                    ? { x: BP_PAD_SIDE + i * stride, y: BP_PAD_TOP }
                    : { x: curX + i * stride, y: NODE_Y },
                draggable: false,
                data: {
                    mod: m,
                    status: diffStatus?.[m.Adress] ?? 'unchanged',
                    editMode,
                    isBackplane: seg.kind === 'apa' || (seg.kind === 'valve' && !isFirst),
                    showLeftHandle: isFirst && !modIsApChain,
                    showRightHandle: isLast && !modIsApChain,
                    showApIn: modIsApChain,
                    showApOut: modIsApChain,
                    ...(apPos ? {
                        apInPos: { top: apPos.apInTop, left: apPos.apInLeft },
                        apOutPos: { top: apPos.apOutTop, left: apPos.apOutLeft },
                    } : {}),
                    showValveEditor: editMode && ((seg.kind === 'valve' && !isFirst) || isDirectValveBody),
                    suppressIoHandles: (seg.kind === 'valve' && !isFirst) || isDirectValveBody,
                },
            })
            lastId = id
        })

        // Find AP-chain interface module in this segment for ap-in/ap-out cable routing
        const apChainMod = seg.mods.find(m => isApChainInterface(m.Name))
        const epliId = apChainMod ? String(apChainMod.Adress) : null
        placed.push({ seg, lastId, epliId })
        const segW = seg.mods.length * (NODE_W + INLINE_G)
        curX += segW + CABLE_G
    }

    // ── Cable edges between consecutive segments ──────────
    const cableStyle = { strokeDasharray: '6 4', strokeWidth: 2, stroke: '#1565c0' }

    placed.slice(0, -1).forEach(({ lastId, epliId }, si) => {
        const next = placed[si + 1]
        const nextFirstId = String(next.seg.mods[0].Adress)

        // Route FROM EPLI's ap-out (if segment has EPLI), else from last module's right
        const srcNode = epliId ?? lastId
        const srcHandle = epliId ? 'ap-out' : 'right'
        // Route TO next segment's EPLI ap-in (if it has one), else to first module's left
        const tgtNode = next.epliId ?? nextFirstId
        const tgtHandle = next.epliId ? 'ap-in' : 'left'

        const srcMod = mods.find(m => String(m.Adress) === srcNode)
        const exitRight = srcMod ? isApIM12orM8(srcMod.Name) : false

        edges.push({
            id: `cable-${si}`,
            source: srcNode,
            sourceHandle: srcHandle,
            target: tgtNode,
            targetHandle: tgtHandle,
            type: 'cable',
            animated: true,
            labelStyle: { fontSize: 10, fill: '#1565c0', fontWeight: 700 },
            labelBgStyle: { fill: '#e3f2fd', fillOpacity: 0.9 },
            style: cableStyle,
            zIndex: 2,
            data: { kind: 'cable', exitRight },
        })
    })

    return { nodes: [...bgNodes, ...modNodes], edges }
}
