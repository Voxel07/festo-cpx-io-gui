import type { CompareResult, TopologyModule } from '../types'

type RowKind = 'ctx' | 'add' | 'del' | 'empty'

interface Cell {
    text: string
    kind: RowKind
    no: number | null
}

export interface DiffRow {
    l: Cell
    r: Cell
}

/**
 * buildRows(cmpData) → array of { l, r } row objects for the split diff view.
 * Each side cell: { text, kind: 'ctx'|'add'|'del'|'empty', no: number|null }
 */
export function buildRows(cmpData: CompareResult): DiffRow[] {
    const { stored, live } = cmpData

    const changedByAddr = new Map<number, Set<string>>()
    for (const c of cmpData.changes) {
        if (!changedByAddr.has(c.address)) changedByAddr.set(c.address, new Set())
        changedByAddr.get(c.address)!.add(c.field)
    }
    const addedSet   = new Set(cmpData.added.map(m => m.Adress))
    const removedSet = new Set(cmpData.removed.map(m => m.Adress))
    const storedMap  = new Map((stored.Topology ?? []).map(m => [m.Adress, m]))
    const liveMap    = new Map((live.Topology   ?? []).map(m => [m.Adress, m]))

    const rows: DiffRow[] = []
    let lNo = 1, rNo = 1

    function push(lt: string, lk: RowKind, rt: string, rk: RowKind) {
        rows.push({
            l: { text: lt, kind: lk, no: lk !== 'empty' ? lNo++ : null },
            r: { text: rt, kind: rk, no: rk !== 'empty' ? rNo++ : null },
        })
    }
    function ctx(t: string) { push(t, 'ctx', t, 'ctx') }

    const ind  = '        '       // 8 spaces  – inside Topology array
    const indK = ind + '    '     // 12 spaces – key indent

    function modLines(m: TopologyModule, getKind: (k: string) => RowKind) {
        const keys = Object.keys(m) as (keyof TopologyModule)[]
        return [
            { t: `${ind}{`, k: 'ctx' as RowKind },
            ...keys.map((k, i) => ({
                t: `${indK}"${k}": ${JSON.stringify(m[k])}${i < keys.length - 1 ? ',' : ''}`,
                k: getKind(k as string),
            })),
            { t: `${ind}},`, k: 'ctx' as RowKind },
        ]
    }

    // ── Header ────────────────────────────────────────────────────────────────
    ctx('{')
    for (const f of ['Name', 'Description', 'Version'] as const) {
        const sv = stored[f], lv = live[f]
        if (sv !== lv) {
            push(`    "${f}": ${JSON.stringify(sv)},`, 'del', `    "${f}": ${JSON.stringify(lv)},`, 'add')
        } else {
            ctx(`    "${f}": ${JSON.stringify(sv ?? lv)},`)
        }
    }
    ctx('    "Topology": [')

    // ── Modules ───────────────────────────────────────────────────────────────
    const seen  = new Set<number>()
    const order = [
        ...(stored.Topology ?? []).map(m => m.Adress),
        ...cmpData.added.map(m => m.Adress),
    ].filter(a => !seen.has(a) && seen.add(a))

    for (const addr of order) {
        const sm = storedMap.get(addr)
        const lm = liveMap.get(addr)

        if (removedSet.has(addr) && sm) {
            for (const ln of modLines(sm, () => 'del'))
                push(ln.t, ln.k, '', 'empty')
        } else if (addedSet.has(addr) && lm) {
            for (const ln of modLines(lm, () => 'add'))
                push('', 'empty', ln.t, ln.k)
        } else if (changedByAddr.has(addr) && sm && lm) {
            const fd = changedByAddr.get(addr)!
            push(`${ind}{`, 'ctx', `${ind}{`, 'ctx')
            const keys = Object.keys(sm) as (keyof TopologyModule)[]
            keys.forEach((k, i) => {
                const comma = i < keys.length - 1 ? ',' : ''
                const sl = `${indK}"${k}": ${JSON.stringify(sm[k])}${comma}`
                const ll = `${indK}"${k}": ${JSON.stringify(lm[k])}${comma}`
                fd.has(k as string) ? push(sl, 'del', ll, 'add') : push(sl, 'ctx', ll, 'ctx')
            })
            push(`${ind}},`, 'ctx', `${ind}},`, 'ctx')
        } else if (sm) {
            for (const ln of modLines(sm, () => 'ctx'))
                push(ln.t, ln.k, ln.t, ln.k)
        }
    }

    ctx('    ]')
    ctx('}')
    return rows
}
