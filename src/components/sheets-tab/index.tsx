import {useState, FC, useEffect} from 'react'
import {
    getSelectedCellRange,
    Grid,
    isErrorMessage,
    SheetInfo,
    toA1notation,
    type SelectedData,
} from 'logisheets-engine'
import {useEngine, useOps} from '@/core/engine/provider'
import {StandardColor} from '@/core/standable'
import AddIcon from '@mui/icons-material/Add'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import {ContextMenuComponent} from './contextmenu'
import {formulaEditCoordinator} from '@/core/formula-edit-coordinator'
import styles from './sheets-tab.module.scss'
import {
    cellRangeStats,
    formatStat,
    shouldSummarise,
    type SelectionStats,
} from './stats'

export interface SheetTabProps {
    activeSheet: number
    activeSheet$: (s: number) => void
    /**
     * Workbook-identity nonce. The engine doesn't emit `sheetChange`
     * on `loadWorkbook`, so we re-fetch sheet info whenever the host's
     * grid handle changes (set by load/save/transaction flow).
     */
    grid?: Grid | null
    /** Drives the status read-out on the right of the strip. */
    selectedData?: SelectedData
}

export const SheetsTabComponent: FC<SheetTabProps> = ({
    activeSheet,
    activeSheet$,
    grid,
    selectedData,
}) => {
    const engine = useEngine()
    const workbook = engine.getWorkbook()
    const ops = useOps()
    const [sheets, setSheets] = useState([] as readonly SheetInfo[])
    const [isOpen, setIsOpen] = useState(false)
    const [zoom, setZoom] = useState(() => engine.getZoom())
    useEffect(() => {
        const onZoom = (z: number) => setZoom(z)
        engine.on('zoomChange', onZoom)
        return () => engine.off('zoomChange', onZoom)
    }, [engine])
    const [modalPosition, setModalPosition] = useState({
        top: 0,
        left: 0,
        tabTop: 0,
        tabLeft: 0,
        tabWidth: 0,
        tabHeight: 0,
    })

    useEffect(() => {
        workbook.getAllSheetInfo().then((v) => {
            if (isErrorMessage(v)) return
            setSheets(v)
        })

        // Listen for sheet changes
        const handleSheetChange = (newSheets: readonly SheetInfo[]) => {
            setSheets(newSheets)
        }
        engine.on('sheetChange', handleSheetChange)

        return () => {
            engine.off('sheetChange', handleSheetChange)
        }
    }, [engine, workbook, grid])

    // Clamp active index to available tab range when sheets change
    useEffect(() => {
        if (sheets.length === 0) return
        if (activeSheet >= sheets.length) {
            activeSheet$(Math.max(0, sheets.length - 1))
        }
    }, [sheets, activeSheet, activeSheet$])

    /**
     * Sum, average and count over the selection — the numbers Excel and Sheets
     * both put bottom-right. One `getCells` call covers the whole range, so
     * this costs a single worker round trip however large the block is.
     *
     * Big selections are skipped rather than fetched: someone who has selected
     * a whole column wants the column, not a statistic, and pulling a million
     * cells across to add them up would stall the strip.
     */
    const [stats, setStats] = useState<SelectionStats | null>(null)
    useEffect(() => {
        const r = selectedData ? getSelectedCellRange(selectedData) : undefined
        if (!r || !shouldSummarise(r)) {
            setStats(null)
            return
        }
        let cancelled = false
        workbook
            .getCells({
                sheetIdx: activeSheet,
                startRow: Math.min(r.startRow, r.endRow),
                startCol: Math.min(r.startCol, r.endCol),
                endRow: Math.max(r.startRow, r.endRow),
                endCol: Math.max(r.startCol, r.endCol),
            })
            .then((cells) => {
                if (cancelled || isErrorMessage(cells)) return
                setStats(cellRangeStats(cells))
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [selectedData, activeSheet, workbook, grid])

    /**
     * What the selection is, in the words a spreadsheet uses: its address and
     * how big it is. Excel and Sheets both put this bottom-right, and it costs
     * nothing to show — the range is already in hand, so no cell has to be
     * read to say it.
     */
    const selectionLabel = (() => {
        const r = selectedData ? getSelectedCellRange(selectedData) : undefined
        if (!r) return null
        const rows = Math.abs(r.endRow - r.startRow) + 1
        const cols = Math.abs(r.endCol - r.startCol) + 1
        const a1 = (row: number, col: number) =>
            `${toA1notation(col)}${row + 1}`
        const top = a1(
            Math.min(r.startRow, r.endRow),
            Math.min(r.startCol, r.endCol)
        )
        if (rows === 1 && cols === 1) return {address: top, size: null}
        const bottom = a1(
            Math.max(r.startRow, r.endRow),
            Math.max(r.startCol, r.endCol)
        )
        return {address: `${top}:${bottom}`, size: `${rows}R × ${cols}C`}
    })()

    const onTabChange = (_: unknown, idx: number) => {
        activeSheet$(idx)
        // If a formula is being edited, switching sheets is "point mode": the
        // editor stays open (it won't commit on blur). The tab button grabbed
        // focus, so hand it back to the editor once the switch settles, keeping
        // Enter as confirm while the user picks a cross-sheet reference.
        if (formulaEditCoordinator.isFormulaEditing()) {
            setTimeout(() => formulaEditCoordinator.focusActive(), 0)
        }
    }

    /**
     * Add a sheet and go to it, the way every spreadsheet does.
     *
     * The switch has to wait for the refreshed sheet list, not just for the
     * transaction: `activeSheet$(newIdx)` on its own raced the clamp effect
     * below, which saw an index past the end of a `sheets` array that had not
     * been updated yet and pulled the selection straight back. Refreshing
     * first means the clamp sees a list that already contains the new sheet.
     */
    const addSheet = async () => {
        const newSheetName = findNewSheetName(sheets.map((s) => s.name))
        const newIdx = sheets.length
        const created = await ops.createSheet(newSheetName, newIdx)
        if (isErrorMessage(created)) return
        const refreshed = await workbook.getAllSheetInfo()
        if (!isErrorMessage(refreshed)) setSheets(refreshed)
        activeSheet$(newIdx)
    }

    return (
        <div className={styles['host']}>
            <Tabs
                value={
                    sheets.length
                        ? Math.min(activeSheet, sheets.length - 1)
                        : false
                }
                onChange={onTabChange}
                variant="scrollable"
                scrollButtons="auto"
            >
                {sheets.map((sheet, i) => (
                    <Tab
                        key={sheet.name}
                        className={styles.sheetTab}
                        // A sheet's colour belongs on its edge, as in Excel —
                        // filling the whole tab fought the active/inactive
                        // surfaces that say which sheet you are on.
                        style={
                            sheet.tabColor
                                ? {
                                      boxShadow: `inset 0 -3px 0 ${StandardColor.fromArgb(
                                          sheet.tabColor
                                      ).css()}`,
                                  }
                                : undefined
                        }
                        label={
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    activeSheet$(i)
                                    setIsOpen(true)
                                    const target =
                                        e.currentTarget as HTMLElement
                                    const tabEl =
                                        (target.closest(
                                            '[role="tab"]'
                                        ) as HTMLElement | null) ?? target
                                    const rect = tabEl.getBoundingClientRect()
                                    setModalPosition({
                                        top: e.clientY,
                                        left: e.clientX,
                                        tabTop: rect.top,
                                        tabLeft: rect.left,
                                        tabWidth: rect.width,
                                        tabHeight: rect.height,
                                    })
                                }}
                            >
                                <span>{sheet.name}</span>
                            </Box>
                        }
                    />
                ))}
            </Tabs>
            <div className={styles.addSheet}>
                <IconButton
                    size="small"
                    aria-label="add sheet"
                    onClick={addSheet}
                >
                    <AddIcon fontSize="small" />
                </IconButton>
            </div>
            {/* The right of the strip: what is selected, and the zoom. The
                tabs alone left this half empty, and these are the two things a
                status bar is for. */}
            <div className={styles.status}>
                {selectionLabel ? (
                    <span className={styles.selection}>
                        <span className={styles.selectionAddress}>
                            {selectionLabel.address}
                        </span>
                        {selectionLabel.size ? (
                            <span className={styles.selectionSize}>
                                {selectionLabel.size}
                            </span>
                        ) : null}
                    </span>
                ) : null}
                {stats ? (
                    <>
                        <span className={styles.statusDivider} />
                        <span className={styles.stats}>
                            <span>
                                Sum <b>{formatStat(stats.sum)}</b>
                            </span>
                            <span>
                                Avg <b>{formatStat(stats.sum / stats.count)}</b>
                            </span>
                            <span>
                                Count <b>{stats.count}</b>
                            </span>
                        </span>
                    </>
                ) : null}
                <span className={styles.statusDivider} />
                <IconButton
                    size="small"
                    aria-label="Zoom out"
                    onClick={() => engine.zoomOut()}
                >
                    <ZoomOutIcon fontSize="small" />
                </IconButton>
                <button
                    type="button"
                    className={styles.zoomValue}
                    aria-label="Reset zoom to 100%"
                    title="Reset zoom to 100%"
                    onClick={() => engine.resetZoom()}
                >
                    {Math.round(zoom * 100)}%
                </button>
                <IconButton
                    size="small"
                    aria-label="Zoom in"
                    onClick={() => engine.zoomIn()}
                >
                    <ZoomInIcon fontSize="small" />
                </IconButton>
            </div>
            <ContextMenuComponent
                left={modalPosition.left}
                top={modalPosition.top}
                tabLeft={modalPosition.tabLeft}
                tabTop={modalPosition.tabTop}
                tabWidth={modalPosition.tabWidth}
                tabHeight={modalPosition.tabHeight}
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                index={activeSheet}
                sheetnames={sheets.map((s) => s.name)}
            />
        </div>
    )
}

function findNewSheetName(sheetNames: readonly string[]): string {
    const sheetPattern = /^Sheet(\d+)$/

    const numbers = sheetNames
        .map((name) => {
            const match = name.match(sheetPattern)
            return match ? parseInt(match[1], 10) : null
        })
        .filter((num): num is number => num !== null)

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1

    return `Sheet${nextNumber}`
}
