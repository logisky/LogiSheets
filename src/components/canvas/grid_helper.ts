import {Grid} from '@/core/worker/types'

export const xForColStart = (colIdx: number, grid: Grid): number => {
    let acc = 0
    for (const c of grid.columns) {
        if (c.idx >= colIdx) break
        acc += c.width
    }
    return acc
}

export const xForColEnd = (colIdx: number, grid: Grid): number => {
    let acc = 0
    for (const c of grid.columns) {
        acc += c.width
        if (c.idx >= colIdx) break
    }
    return acc
}

export const yForRowStart = (rowIdx: number, grid: Grid): number => {
    let acc = 0
    for (const r of grid.rows) {
        if (r.idx >= rowIdx) break
        acc += r.height
    }
    return acc
}

export const yForRowEnd = (rowIdx: number, grid: Grid): number => {
    let acc = 0
    for (const r of grid.rows) {
        acc += r.height
        if (r.idx >= rowIdx) break
    }
    return acc
}

export const findVisibleRowIdxRange = (
    anchor: number,
    height: number,
    grid: Grid
): [number, number] => {
    let s = grid.anchorY
    let startIdx = 0
    for (let i = 0; i < grid.rows.length; i += 1) {
        if (s > anchor) {
            startIdx = i
            break
        }
        s += grid.rows[i].height
    }
    let endIdx = startIdx
    let acc = 0
    for (let j = startIdx; j < grid.rows.length; j += 1) {
        acc += grid.rows[j].height
        if (acc >= height) {
            endIdx = j - 1
            break
        }
    }
    return [startIdx, endIdx]
}

export const findVisibleColIdxRange = (
    anchor: number,
    width: number,
    grid: Grid
): [number, number] => {
    let s = grid.anchorX
    let startIdx = 0
    for (let i = 0; i < grid.columns.length; i += 1) {
        if (s >= anchor) {
            startIdx = i
            break
        }
        s += grid.columns[i].width
    }
    let endIdx = grid.columns.length - 1
    let acc = 0
    for (let j = startIdx; j < grid.columns.length; j += 1) {
        acc += grid.columns[j].width
        if (acc > width) {
            endIdx = j
        }
    }
    return [startIdx, endIdx]
}
