import type { Node } from '@xyflow/react'

type Point = { x: number; y: number }

class MinHeap {
    data: number[] = []
    scores: Map<number, number>

    constructor(scores: Map<number, number>) {
        this.scores = scores
    }

    push(val: number) {
        this.data.push(val)
        this.bubbleUp(this.data.length - 1)
    }

    pop(): number | undefined {
        if (this.data.length === 0) return undefined
        const root = this.data[0]
        const last = this.data.pop()!
        if (this.data.length > 0) {
            this.data[0] = last
            this.sinkDown(0)
        }
        return root
    }

    private bubbleUp(idx: number) {
        const val = this.data[idx]
        const score = this.scores.get(val)!
        while (idx > 0) {
            const parentIdx = Math.floor((idx - 1) / 2)
            const parent = this.data[parentIdx]
            if (score >= this.scores.get(parent)!) break
            this.data[idx] = parent
            idx = parentIdx
        }
        this.data[idx] = val
    }

    private sinkDown(idx: number) {
        const length = this.data.length
        const val = this.data[idx]
        const score = this.scores.get(val)!

        while (true) {
            const leftIdx = 2 * idx + 1
            const rightIdx = 2 * idx + 2
            let swapIdx = -1
            let leftScore = Infinity

            if (leftIdx < length) {
                leftScore = this.scores.get(this.data[leftIdx])!
                if (leftScore < score) swapIdx = leftIdx
            }
            if (rightIdx < length) {
                const rightScore = this.scores.get(this.data[rightIdx])!
                if (
                    (swapIdx === -1 && rightScore < score) ||
                    (swapIdx !== -1 && rightScore < leftScore)
                ) {
                    swapIdx = rightIdx
                }
            }

            if (swapIdx === -1) break
            this.data[idx] = this.data[swapIdx]
            idx = swapIdx
        }
        this.data[idx] = val
    }
}

// Cache for grid to avoid rebuilding it on every edge render if obstacles haven't changed
let lastObstaclesKey = ''
let cachedGrid: Uint8Array | null = null
let cachedGridCols = 0
let cachedGridRows = 0
let cachedMinX = 0
let cachedMinY = 0

export function findSmartPath(
    sx: number, sy: number,
    tx: number, ty: number,
    nodes: Node[]
): Point[] {
    const GRID_SIZE = 15
    const PADDING = 15

    let minX = Math.min(sx, tx)
    let maxX = Math.max(sx, tx)
    let minY = Math.min(sy, ty)
    let maxY = Math.max(sy, ty)

    const obstacles: { left: number; right: number; top: number; bottom: number }[] = []

    for (const node of nodes) {
        if (node.type === 'mod') {
            const width = typeof node.style?.width === 'number'
                ? node.style.width
                : parseFloat(String(node.style?.width || 0)) || node.measured?.width || 100
            const height = typeof node.style?.height === 'number'
                ? node.style.height
                : parseFloat(String(node.style?.height || 0)) || node.measured?.height || 100

            // Absolute position (handling parent nodes)
            let absX = node.position.x
            let absY = node.position.y
            if (node.parentId) {
                const parent = nodes.find(n => n.id === node.parentId)
                if (parent) {
                    absX += parent.position.x
                    absY += parent.position.y
                }
            }

            const left = absX - PADDING
            const right = absX + width + PADDING
            const top = absY - PADDING
            const bottom = absY + height + PADDING

            obstacles.push({ left, right, top, bottom })

            minX = Math.min(minX, left)
            maxX = Math.max(maxX, right)
            minY = Math.min(minY, top)
            maxY = Math.max(maxY, bottom)
        }
    }

    minX -= 40
    maxX += 40
    minY -= 40
    maxY += 40

    const toGrid = (v: number, minV: number) => Math.floor((v - minV) / GRID_SIZE)

    const cols = toGrid(maxX, minX) + 1
    const rows = toGrid(maxY, minY) + 1

    const getIdx = (gx: number, gy: number) => gy * cols + gx

    // Generate a simple cache key based on obstacles to reuse the grid across multiple edges in the same render
    const currentObstaclesKey = obstacles.map(o => `${o.left},${o.right},${o.top},${o.bottom}`).join('|')

    let grid: Uint8Array

    if (cachedGrid && lastObstaclesKey === currentObstaclesKey && cachedGridCols === cols && cachedGridRows === rows && cachedMinX === minX && cachedMinY === minY) {
        grid = new Uint8Array(cachedGrid) // fast copy
    } else {
        grid = new Uint8Array(cols * rows)
        for (const obs of obstacles) {
            const startC = Math.max(0, toGrid(obs.left, minX))
            const endC = Math.min(cols - 1, toGrid(obs.right, minX))
            const startR = Math.max(0, toGrid(obs.top, minY))
            const endR = Math.min(rows - 1, toGrid(obs.bottom, minY))

            for (let r = startR; r <= endR; r++) {
                for (let c = startC; c <= endC; c++) {
                    grid[getIdx(c, r)] = 1
                }
            }
        }

        cachedGrid = new Uint8Array(grid)
        cachedGridCols = cols
        cachedGridRows = rows
        cachedMinX = minX
        cachedMinY = minY
        lastObstaclesKey = currentObstaclesKey
    }

    const startC = toGrid(sx, minX)
    const startR = toGrid(sy, minY)
    const targetC = toGrid(tx, minX)
    const targetR = toGrid(ty, minY)

    const carveEscape = (px: number, py: number) => {
        for (const obs of obstacles) {
            // Check if point is inside this obstacle (with a small tolerance)
            if (px >= obs.left - 5 && px <= obs.right + 5 && py >= obs.top - 5 && py <= obs.bottom + 5) {
                const distTop = py - obs.top
                const distBottom = obs.bottom - py
                const distLeft = px - obs.left
                const distRight = obs.right - px

                const c = toGrid(px, minX)
                const r = toGrid(py, minY)

                const cRight = Math.min(cols - 1, toGrid(obs.right, minX))
                const cLeft = Math.max(0, toGrid(obs.left, minX))
                const rTop = Math.max(0, toGrid(obs.top, minY))
                const rBot = Math.min(rows - 1, toGrid(obs.bottom, minY))

                const canEscapeRight = cRight + 1 < cols && grid[getIdx(cRight + 1, r)] === 0
                const canEscapeLeft = cLeft - 1 >= 0 && grid[getIdx(cLeft - 1, r)] === 0

                const effectiveDistRight = canEscapeRight ? distRight : Infinity
                const effectiveDistLeft = canEscapeLeft ? distLeft : Infinity

                const minDist = Math.min(distTop, distBottom, effectiveDistLeft, effectiveDistRight)

                if (minDist === distTop) {
                    for (let rr = rTop; rr <= r; rr++) grid[getIdx(c, rr)] = 0
                } else if (minDist === distBottom) {
                    for (let rr = r; rr <= rBot; rr++) grid[getIdx(c, rr)] = 0
                } else if (minDist === effectiveDistLeft) {
                    for (let cc = cLeft; cc <= c; cc++) grid[getIdx(cc, r)] = 0
                } else {
                    for (let cc = c; cc <= cRight; cc++) grid[getIdx(cc, r)] = 0
                }
            }
        }
    }

    carveEscape(sx, sy)
    carveEscape(tx, ty)

    // Ensure exact start and target cells are unblocked just in case they fell outside module bounds
    grid[getIdx(startC, startR)] = 0
    grid[getIdx(targetC, targetR)] = 0

    const openSetIds = new Set<number>()
    const startIdx = getIdx(startC, startR)
    openSetIds.add(startIdx)

    const cameFrom = new Map<number, { p: number; dir: number }>()
    const gScore = new Map<number, number>()
    gScore.set(startIdx, 0)

    const fScore = new Map<number, number>()
    const heuristic = (c1: number, r1: number, c2: number, r2: number) => Math.abs(c1 - c2) + Math.abs(r1 - r2)
    fScore.set(startIdx, heuristic(startC, startR, targetC, targetR))

    const openSet = new MinHeap(fScore)
    openSet.push(startIdx)

    const dirs = [
        { dc: 0, dr: -1 }, // Up
        { dc: 1, dr: 0 },  // Right
        { dc: 0, dr: 1 },  // Down
        { dc: -1, dr: 0 }  // Left
    ]

    let found = false

    // Cap iterations to prevent freezing on impossible routes (e.g. fully boxed in target)
    let iter = 0
    const MAX_ITER = 30000

    while (openSetIds.size > 0 && iter < MAX_ITER) {
        iter++
        const curr = openSet.pop()
        if (curr === undefined) break
        openSetIds.delete(curr)

        const c = curr % cols
        const r = Math.floor(curr / cols)

        if (c === targetC && r === targetR) {
            found = true
            break
        }

        const currG = gScore.get(curr)!
        const prevInfo = cameFrom.get(curr)

        for (let d = 0; d < 4; d++) {
            const nc = c + dirs[d].dc
            const nr = r + dirs[d].dr

            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue

            const nIdx = getIdx(nc, nr)
            if (grid[nIdx] === 1) continue // Blocked

            // Turn penalty
            const isTurn = prevInfo ? prevInfo.dir !== d : false
            const cost = isTurn ? 1.5 : 1
            const tentativeG = currG + cost

            const existingG = gScore.get(nIdx) ?? Infinity
            if (tentativeG < existingG) {
                cameFrom.set(nIdx, { p: curr, dir: d })
                gScore.set(nIdx, tentativeG)
                fScore.set(nIdx, tentativeG + heuristic(nc, nr, targetC, targetR))
                if (!openSetIds.has(nIdx)) {
                    openSetIds.add(nIdx)
                    openSet.push(nIdx)
                }
            }
        }
    }

    if (!found) {
        return [
            { x: sx, y: sy },
            { x: tx, y: ty }
        ]
    }

    const path: Point[] = []
    let curr = getIdx(targetC, targetR)

    while (cameFrom.has(curr)) {
        const c = curr % cols
        const r = Math.floor(curr / cols)
        path.push({ x: minX + c * GRID_SIZE, y: minY + r * GRID_SIZE })
        curr = cameFrom.get(curr)!.p
    }

    path.push({ x: sx, y: sy })
    path.reverse()
    path[path.length - 1] = { x: tx, y: ty }

    // Simplify to corners
    const simplified: Point[] = [path[0]]
    let lastDir = { dx: 0, dy: 0 }

    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1]
        const curr = path[i]

        const dx = Math.sign(curr.x - prev.x)
        const dy = Math.sign(curr.y - prev.y)

        if (i === 1) {
            lastDir = { dx, dy }
            continue
        }

        if (dx !== lastDir.dx || dy !== lastDir.dy) {
            simplified.push(prev)
            lastDir = { dx, dy }
        }
    }
    simplified.push(path[path.length - 1])

    return simplified
}
