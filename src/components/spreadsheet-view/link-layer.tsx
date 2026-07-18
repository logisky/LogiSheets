import {useEffect, useState} from 'react'
import {observer} from 'mobx-react-lite'
import type {Grid} from 'logisheets-engine'
import {xForColStart, yForRowStart} from 'logisheets-engine'
import {isErrorMessage} from 'logisheets-web'
import type {LinkInfo} from 'logisheets-web'
import {useWorkbook} from '@/core/engine/provider'
import {LeftTop} from '@/core/settings'
import {globalStore} from '@/store'

export interface LinkLayerProps {
    grid: Grid
    activeSheet: number
}

/**
 * Outer-border overlay for ranges that are linked to a block.
 *
 * A range the user references (e.g. `A1:A10`) can be *linked* to a backing
 * block — the engine redirects the reference to the block at resolution time
 * (see the RangeLink concept). Visually, the source range looks like ordinary
 * cells, so we draw a dashed outer border around each linked range to signal
 * that it's backed by a growable block.
 *
 * The linked ranges come from the engine (`getLinks`); we refetch whenever the
 * grid changes (edits, growth, scroll) and map each to a pixel box the same way
 * the trace overlay does. Off-screen ranges simply aren't drawn.
 */
export const LinkLayer = observer(({grid, activeSheet}: LinkLayerProps) => {
    const workbook = useWorkbook()
    const [links, setLinks] = useState<readonly LinkInfo[]>([])
    // Read the store's link revision so a newly created link refetches the
    // border immediately. Linking an empty range changes no cell value, so the
    // grid/cellUpdated signals may not fire — the revision is the explicit nudge.
    const linkRevision = globalStore.linkRevision

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const res = await workbook.getLinks({sheetIdx: activeSheet})
            if (cancelled || isErrorMessage(res)) return
            setLinks(res)
        })()
        return () => {
            cancelled = true
        }
        // Refetch when the sheet, its data/window, or the link set changes.
    }, [workbook, activeSheet, grid, linkRevision])

    if (links.length === 0) return null

    // Pixel box for a cell range on this sheet, or null if its top-left is
    // outside the visible window.
    const boxOf = (rect: {
        startRow: number
        startCol: number
        endRow: number
        endCol: number
    }) => {
        const colW = (c: number) =>
            grid.columns.find((x: {idx: number; width: number}) => x.idx === c)
                ?.width
        const rowH = (r: number) =>
            grid.rows.find((x: {idx: number; height: number}) => x.idx === r)
                ?.height
        if (colW(rect.startCol) === undefined) return null
        if (rowH(rect.startRow) === undefined) return null
        let width = 0
        for (let c = rect.startCol; c <= rect.endCol; c++) width += colW(c) ?? 0
        let height = 0
        for (let r = rect.startRow; r <= rect.endRow; r++) height += rowH(r) ?? 0
        return {
            left: xForColStart(rect.startCol, grid) + LeftTop.width,
            top: yForRowStart(rect.startRow, grid) + LeftTop.height,
            width,
            height,
        }
    }

    const boxes: React.ReactNode[] = []
    links.forEach((link, i) => {
        if (link.sheetIdx !== activeSheet) return
        const b = boxOf(link)
        if (!b) return
        boxes.push(
            <div
                key={`link${i}`}
                data-testid="link-border"
                title={`Linked to block #${link.blockId}`}
                style={{
                    position: 'absolute',
                    left: b.left,
                    top: b.top,
                    width: b.width,
                    height: b.height,
                    boxSizing: 'border-box',
                    border: '2px dashed #7c3aed',
                    borderRadius: 2,
                    background: 'rgba(124, 58, 237, 0.06)',
                    pointerEvents: 'none',
                }}
            />
        )
    })

    return <>{boxes}</>
})
