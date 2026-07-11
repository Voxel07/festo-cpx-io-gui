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
        if (sv !== undefined || lv !== undefined) {
            if (sv !== lv) {
                push(`    "${f}": ${JSON.stringify(sv)},`, 'del', `    "${f}": ${JSON.stringify(lv)},`, 'add')
            } else {
                ctx(`    "${f}": ${JSON.stringify(sv ?? lv)},`)
            }
        }
    }
    ctx('    "Topology": [')

    // ── Modules ───────────────────────────────────────────────────────────────
    const storedTop = stored.Topology ?? []
    const liveTop = live.Topology ?? []

    // Use LCS to align modules by Name and Modulecode
    const dp = Array(storedTop.length + 1).fill(null).map(() => Array(liveTop.length + 1).fill(0))
    for (let i = 1; i <= storedTop.length; i++) {
        for (let j = 1; j <= liveTop.length; j++) {
            if (storedTop[i - 1].Name === liveTop[j - 1].Name && storedTop[i - 1].Modulecode === liveTop[j - 1].Modulecode) {
                dp[i][j] = dp[i - 1][j - 1] + 1
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
            }
        }
    }

    type Op = { type: 'match' | 'insert' | 'delete', sm?: TopologyModule, lm?: TopologyModule }
    const ops: Op[] = []
    let i = storedTop.length, j = liveTop.length

    while (i > 0 && j > 0) {
        if (storedTop[i - 1].Name === liveTop[j - 1].Name && storedTop[i - 1].Modulecode === liveTop[j - 1].Modulecode) {
            ops.push({ type: 'match', sm: storedTop[i - 1], lm: liveTop[j - 1] })
            i--; j--
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            ops.push({ type: 'delete', sm: storedTop[i - 1] })
            i--
        } else {
            ops.push({ type: 'insert', lm: liveTop[j - 1] })
            j--
        }
    }
    while (i > 0) { ops.push({ type: 'delete', sm: storedTop[i - 1] }); i-- }
    while (j > 0) { ops.push({ type: 'insert', lm: liveTop[j - 1] }); j-- }
    ops.reverse()

    for (const op of ops) {
        if (op.type === 'delete' && op.sm) {
            for (const ln of modLines(op.sm, () => 'del'))
                push(ln.t, ln.k, '', 'empty')
        } else if (op.type === 'insert' && op.lm) {
            for (const ln of modLines(op.lm, () => 'add'))
                push('', 'empty', ln.t, ln.k)
        } else if (op.type === 'match' && op.sm && op.lm) {
            const sm = op.sm
            const lm = op.lm
            const hasChanges = changedByAddr.has(lm.Adress)
            if (hasChanges) {
                const fd = changedByAddr.get(lm.Adress)!
                push(`${ind}{`, 'ctx', `${ind}{`, 'ctx')
                const keys = Object.keys(sm) as (keyof TopologyModule)[]
                keys.forEach((k, idx) => {
                    const comma = idx < keys.length - 1 ? ',' : ''
                    const sl = `${indK}"${k}": ${JSON.stringify(sm[k])}${comma}`
                    const ll = `${indK}"${k}": ${JSON.stringify(lm[k])}${comma}`
                    if (fd.has(k as string)) push(sl, 'del', ll, 'add')
                    else push(sl, 'ctx', ll, 'ctx')
                })
                push(`${ind}},`, 'ctx', `${ind}},`, 'ctx')
            } else {
                for (const ln of modLines(sm, () => 'ctx'))
                    push(ln.t, ln.k, ln.t, ln.k)
            }
        }
    }

    ctx('    ]')
    ctx('}')
    return rows
}
