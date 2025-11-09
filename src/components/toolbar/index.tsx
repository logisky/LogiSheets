import {useEffect, useRef, useState} from 'react'
import styles from './toolbar.module.scss'
import modalStyles from '../modal.module.scss'
import {
    SelectedData,
    getFirstCell,
    getSelectedCellRange,
    getSelectedLines,
} from '@/components/canvas'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl as DataService} from '@/core/data'
import {BlockComposerComponent} from '@/components/block-composer'
import {BorderSettingComponent} from '@/components/top-bar/content/border-setting'
import {
    generateAlgnmentPayload,
    generateFontPayload,
    generatePatternFillPayload,
} from '@/components/top-bar/content/payload'
import {
    CellFormatBrushBuilder,
    HorizontalAlignment,
    getPatternFill,
    LineFormatBrushBuilder,
    MergeCell,
    MergeCellsBuilder,
    Payload,
    Transaction,
} from 'logisheets-web'
import {SplitMergedCellsBuilder} from 'packages/web'
import {ColorResult, SketchPicker} from 'react-color'
import Modal from 'react-modal'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import {
    FolderOpen as FolderOpenIcon,
    Save as SaveIcon,
    Undo as UndoIcon,
    Redo as RedoIcon,
    FormatPaint as FormatPaintIcon,
    FormatBold as FormatBoldIcon,
    FormatItalic as FormatItalicIcon,
    FormatUnderlined as FormatUnderlinedIcon,
    FormatColorText as FormatColorTextIcon,
    FormatColorFill as FormatColorFillIcon,
    BorderClear as BorderIcon,
    MergeType as MergeIcon,
    ArrowDropDown as ArrowDropDownIcon,
    TextIncrease,
    TextDecrease,
    AlignHorizontalCenter,
    AlignHorizontalCenterOutlined,
} from '@mui/icons-material'
import {isErrorMessage} from 'packages/web/src/api/utils'
import {StandardColor, StandardFont} from '@/core/standable'
import {useToast} from '@/ui/notification/useToast'
import {getU8} from '@/core/file'

export interface ToolbarProps {
    selectedData?: SelectedData
}

export const Toolbar = ({selectedData}: ToolbarProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const {toast} = useToast()

    // File open
    const fileInputRef = useRef<HTMLInputElement>(null)
    const onOpenClick = () => fileInputRef.current?.click()
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.item(0)
        if (!file) return
        const readFile = new Promise((resolve, reject) => {
            getU8(file).subscribe(
                async (u8) => {
                    if (!u8) {
                        reject('read file error')
                        return
                    }
                    DATA_SERVICE.loadWorkbook(u8, file.name)
                    resolve('')
                },
                (err) => reject(err)
            )
        })
        toast.promise(readFile, {
            pending: 'Loading file...',
            error: 'Read file error, retry later',
            success: `Read file ${file.name}`,
        })
    }

    // File menu (dropdown)
    const [fileAnchor, setFileAnchor] = useState<HTMLElement | null>(null)
    const openFileMenu = (e: React.MouseEvent<HTMLElement>) =>
        setFileAnchor(e.currentTarget)
    const closeFileMenu = () => setFileAnchor(null)

    // Undo/Redo
    const undo = () => DATA_SERVICE.undo()
    const redo = () => DATA_SERVICE.redo()

    // Painter / font / fill
    const [formatBrushOn, setFormatBrushOn] = useState<{
        sheetIdx: number
        row: number
        col: number
    } | null>(null)

    const [fontColor, setFontColor] = useState('#000')
    const [fillColor, setFillColor] = useState('#000')
    const [colorPicking, setColorPicking] = useState<'font' | 'fill' | ''>('')

    const [bold, setBold] = useState(false)
    const [italic, setItalic] = useState(false)
    const [underline, setUnderline] = useState(false)
    const [fontSize, setFontSize] = useState<number | ''>('')

    // Alignment popover
    const [alignAnchor, setAlignAnchor] = useState<HTMLElement | null>(null)
    const [alignment, setAlignment] = useState<string | null>(null)

    // Merge
    const [mergedOn, setMergedOn] = useState<boolean | null>(null)
    let mergedCells: readonly MergeCell[] = []

    // Border modal
    const [borderOpen, setBorderOpen] = useState(false)

    // BlockComposer modal
    const [composerOpen, setComposerOpen] = useState(false)

    // Init style when selection changes
    useEffect(() => {
        if (!selectedData || !selectedData.data) {
            setFontColor('#000')
            setFillColor('#000')
            setAlignment(null)
            setMergedOn(null)
            return
        }
        // font/fill/alignment
        const cell = getFirstCell(selectedData)
        const {r, c} = cell
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        DATA_SERVICE.getCellInfo(sheet, r, c).then((ci) => {
            if (isErrorMessage(ci)) return
            const style = ci.getStyle()
            const a = style.alignment
            if (a?.horizontal === 'center') setAlignment('center')
            else if (a?.horizontal === 'left') setAlignment('left')
            else if (a?.horizontal === 'right') setAlignment('right')
            else setAlignment(null)
            const pf = getPatternFill(style.fill)
            if (pf && pf.bgColor) {
                const c = StandardColor.fromCtColor(pf.bgColor)
                setFillColor(c.css())
            }
            const font = StandardFont.from(style.font)
            setFontColor(font.standardColor.css())
            setFontSize(font.size)
            setBold(font.bold)
            setItalic(font.italic)
            setUnderline(font.underline ? font.underline.val !== 'none' : false)
        })
        // merged state
        const cr = getSelectedCellRange(selectedData)
        if (!cr) {
            setMergedOn(null)
            return
        }
        DATA_SERVICE.getMergedCells(
            DATA_SERVICE.getCurrentSheetIdx(),
            cr.startRow,
            cr.startCol,
            cr.endRow,
            cr.endCol
        ).then((v) => {
            if (isErrorMessage(v)) {
                setMergedOn(null)
                return
            }
            mergedCells = v
            if (
                v.length === 1 &&
                v[0].startRow === cr.startRow &&
                v[0].endRow === cr.endRow &&
                v[0].startCol === cr.startCol &&
                v[0].endCol === cr.endCol
            ) {
                setMergedOn(true)
            } else if (
                v.length === 0 &&
                cr.startRow === cr.endRow &&
                cr.startCol === cr.endCol
            ) {
                setMergedOn(null)
            } else {
                setMergedOn(false)
            }
        })
    }, [selectedData])

    // Format painter effect (same behavior as top-bar)
    useEffect(() => {
        if (!formatBrushOn) return
        if (!selectedData) return
        const cellRange = getSelectedCellRange(selectedData)
        if (cellRange) {
            const payload: Payload = {
                type: 'cellFormatBrush',
                value: new CellFormatBrushBuilder()
                    .srcSheetIdx(formatBrushOn.sheetIdx)
                    .srcRow(formatBrushOn.row)
                    .srcCol(formatBrushOn.col)
                    .dstRowStart(cellRange.startRow)
                    .dstColStart(cellRange.startCol)
                    .dstRowEnd(cellRange.endRow)
                    .dstColEnd(cellRange.endCol)
                    .dstSheetIdx(formatBrushOn.sheetIdx)
                    .build(),
            }
            DATA_SERVICE.handleTransaction(new Transaction([payload], true))
            setFormatBrushOn(null)
            return
        }
        const lineRange = getSelectedLines(selectedData)
        if (lineRange) {
            const payload: Payload = {
                type: 'lineFormatBrush',
                value: new LineFormatBrushBuilder()
                    .srcSheetIdx(formatBrushOn.sheetIdx)
                    .srcRow(formatBrushOn.row)
                    .srcCol(formatBrushOn.col)
                    .from(lineRange.start)
                    .to(lineRange.end)
                    .dstSheetIdx(formatBrushOn.sheetIdx)
                    .row(lineRange.type === 'row')
                    .build(),
            }
            DATA_SERVICE.handleTransaction(new Transaction([payload], true))
            setFormatBrushOn(null)
        }
    }, [formatBrushOn, selectedData])

    // Handlers
    const onFormatPainter = () => {
        if (formatBrushOn) return setFormatBrushOn(null)
        if (!selectedData) return
        const src = getFirstCell(selectedData)
        setFormatBrushOn({
            sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
            row: src.r,
            col: src.c,
        })
    }

    const onPick = (result: ColorResult) => {
        if (!selectedData) return
        const {r, g, b, a} = result.rgb
        const color = StandardColor.from(r, g, b, a)
        if (colorPicking === 'font') {
            const payloads = generateFontPayload(
                DATA_SERVICE.getCurrentSheetIdx(),
                selectedData,
                {color: color.argb()}
            )
            DATA_SERVICE.handleTransaction(
                new Transaction(payloads, true)
            ).then(() => {
                setFontColor(color.css())
                setColorPicking('')
            })
        } else if (colorPicking === 'fill') {
            const payloads = generatePatternFillPayload(
                DATA_SERVICE.getCurrentSheetIdx(),
                selectedData,
                undefined,
                color.argb(),
                'solid'
            )
            DATA_SERVICE.handleTransaction(
                new Transaction(payloads, true)
            ).then(() => {
                setFillColor(color.css())
                setColorPicking('')
            })
        }
    }

    const onToggleBold = () => {
        if (!selectedData) return
        const v = !bold
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {bold: v}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            () => setBold(v)
        )
    }
    const onToggleItalic = () => {
        if (!selectedData) return
        const v = !italic
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {italic: v}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            () => setItalic(v)
        )
    }
    const onToggleUnderline = () => {
        if (!selectedData) return
        const v = !underline
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {underline: v}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            () => setUnderline(v)
        )
    }

    const onAlignClick = (event: React.MouseEvent<HTMLElement>) => {
        setAlignAnchor(event.currentTarget)
    }
    const onChooseAlign = (v: 'left' | 'center' | 'right') => {
        if (!selectedData) return
        const payloads = generateAlgnmentPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {horizontal: v as HorizontalAlignment}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            () => setAlignment(v)
        )
        setAlignAnchor(null)
    }

    const onMergeOrSplitClick = () => {
        if (mergedOn === null) return
        if (!selectedData) return
        const cr = getSelectedCellRange(selectedData)
        if (!cr) return
        const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
        if (mergedOn) {
            return DATA_SERVICE.handleTransaction(
                new Transaction(
                    [
                        {
                            type: 'splitMergedCells',
                            value: new SplitMergedCellsBuilder()
                                .sheetIdx(sheetIdx)
                                .row(cr.startRow)
                                .col(cr.startCol)
                                .build(),
                        },
                    ],
                    true
                )
            ).then(() => setMergedOn(false))
        }
        const payloads: Payload[] = mergedCells.map((v) => ({
            type: 'splitMergedCells',
            value: new SplitMergedCellsBuilder()
                .sheetIdx(sheetIdx)
                .row(v.startRow)
                .col(v.startCol)
                .build(),
        }))
        payloads.push({
            type: 'mergeCells',
            value: new MergeCellsBuilder()
                .sheetIdx(sheetIdx)
                .startRow(cr.startRow)
                .endRow(cr.endRow)
                .startCol(cr.startCol)
                .endCol(cr.endCol)
                .build(),
        })
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            () => setMergedOn(true)
        )
    }

    return (
        <div className={styles.host}>
            {/* App logo */}
            <div className={styles.logo}>L</div>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                style={{display: 'none'}}
                onChange={onFileChange}
            />
            {/* File dropdown (left fixed cluster) */}
            <div className={styles.section}>
                <Button
                    size="small"
                    variant="text"
                    startIcon={<FolderOpenIcon fontSize="small" />}
                    endIcon={<ArrowDropDownIcon fontSize="small" />}
                    onClick={openFileMenu}
                >
                    File
                </Button>
                <Menu
                    anchorEl={fileAnchor}
                    open={Boolean(fileAnchor)}
                    onClose={closeFileMenu}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                >
                    <MenuItem
                        onClick={() => {
                            closeFileMenu()
                            onOpenClick()
                        }}
                    >
                        <FolderOpenIcon
                            fontSize="small"
                            style={{marginRight: 8}}
                        />
                        Open
                    </MenuItem>
                    <MenuItem disabled>
                        <SaveIcon fontSize="small" style={{marginRight: 8}} />
                        Save
                    </MenuItem>
                </Menu>
            </div>
            {/* Center cluster: all remaining controls */}
            <div className={styles.center}>
                {/* History */}
                <div className={styles.section}>
                    <Tooltip title="Undo">
                        <IconButton size="small" onClick={undo}>
                            <UndoIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Redo">
                        <IconButton size="small" onClick={redo}>
                            <RedoIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </div>
                <Divider
                    orientation="vertical"
                    flexItem
                    className={styles.divider}
                />

                {/* Formatting */}
                <div className={styles.section}>
                    <Tooltip title="Format Painter">
                        <IconButton
                            size="small"
                            onClick={onFormatPainter}
                            color={formatBrushOn ? 'primary' : 'default'}
                        >
                            <FormatPaintIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Bold">
                        <IconButton
                            size="small"
                            onClick={onToggleBold}
                            color={bold ? 'primary' : 'default'}
                        >
                            <FormatBoldIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Italic">
                        <IconButton
                            size="small"
                            onClick={onToggleItalic}
                            color={italic ? 'primary' : 'default'}
                        >
                            <FormatItalicIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Underline">
                        <IconButton
                            size="small"
                            onClick={onToggleUnderline}
                            color={underline ? 'primary' : 'default'}
                        >
                            <FormatUnderlinedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Font Color">
                        <IconButton
                            size="small"
                            onClick={() => setColorPicking('font')}
                            sx={{color: fontColor}}
                        >
                            <FormatColorTextIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Increase font size">
                        <IconButton size="small">
                            <TextIncrease fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Decrease font size">
                        <IconButton size="small">
                            <TextDecrease fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Fill Color">
                        <IconButton
                            size="small"
                            onClick={() => setColorPicking('fill')}
                            sx={{color: fillColor}}
                        >
                            <FormatColorFillIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Borders">
                        <IconButton
                            size="small"
                            onClick={() => setBorderOpen(true)}
                        >
                            <BorderIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Alignment">
                        <IconButton
                            size="small"
                            onClick={onAlignClick}
                            color={alignment ? 'primary' : 'default'}
                        >
                            <AlignHorizontalCenterOutlined fontSize="small" />
                            <ArrowDropDownIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Merge">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onMergeOrSplitClick}
                                disabled={mergedOn === null}
                                color={mergedOn ? 'primary' : 'default'}
                            >
                                <MergeIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </div>

                <Divider
                    orientation="vertical"
                    flexItem
                    className={styles.divider}
                />

                {/* Special */}
                <div className={styles.section}>
                    <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        onClick={() => setComposerOpen(true)}
                        startIcon={<span>⚙️</span>}
                        disabled={
                            selectedData === undefined ||
                            getSelectedCellRange(selectedData) === undefined
                        }
                    >
                        CreateCraft
                    </Button>
                </div>
            </div>

            {/* Color pickers */}
            <Modal
                isOpen={colorPicking !== ''}
                onRequestClose={() => setColorPicking('')}
                ariaHideApp={false}
                className={modalStyles.modalContent}
                overlayClassName={modalStyles.modalOverlay}
            >
                <SketchPicker
                    color={colorPicking === 'font' ? fontColor : fillColor}
                    onChangeComplete={onPick}
                />
            </Modal>

            {/* Borders modal */}
            <Modal
                isOpen={borderOpen}
                onRequestClose={() => setBorderOpen(false)}
                ariaHideApp={false}
                className={modalStyles.modalContent}
                overlayClassName={modalStyles.modalOverlay}
            >
                <BorderSettingComponent
                    selectedData={selectedData}
                    close={() => setBorderOpen(false)}
                />
            </Modal>

            {/* Alignment popover (3x3 grid – we only wire horizontal choices) */}
            <Popover
                open={Boolean(alignAnchor)}
                anchorEl={alignAnchor}
                onClose={() => setAlignAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
            >
                <div className={styles.alignGrid}>
                    {/* Top row (not wired) */}
                    <button className={styles.alignCell} disabled>
                        {' '}
                    </button>
                    <button className={styles.alignCell} disabled>
                        {' '}
                    </button>
                    <button className={styles.alignCell} disabled>
                        {' '}
                    </button>
                    {/* Middle row */}
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('left')}
                    >
                        L
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('center')}
                    >
                        C
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('right')}
                    >
                        R
                    </button>
                    {/* Bottom row (not wired) */}
                    <button className={styles.alignCell} disabled>
                        {' '}
                    </button>
                    <button className={styles.alignCell} disabled>
                        {' '}
                    </button>
                    <button className={styles.alignCell} disabled>
                        {' '}
                    </button>
                </div>
            </Popover>

            {composerOpen && (
                <BlockComposerComponent
                    selectedData={selectedData}
                    close={() => setComposerOpen(false)}
                />
            )}
        </div>
    )
}
