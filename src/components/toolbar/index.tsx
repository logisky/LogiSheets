import {useEffect, useRef, useState} from 'react'
import styles from './toolbar.module.scss'
import modalStyles from '../modal.module.scss'
import {getSelectedCellRange, getSelectedLines} from '@/components/canvas'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {CraftManager, DataServiceImpl as DataService} from '@/core/data'
import {BlockComposerComponent} from '@/components/block-composer'
import {BorderSettingComponent} from './border-setting'
import {
    generateAlgnmentPayload,
    generateFontPayload,
    generateNumFmtPayload,
    generatePatternFillPayload,
    generateWrapTextPayload,
} from './payload'
import {
    CellFormatBrushBuilder,
    HorizontalAlignment,
    getPatternFill,
    LineFormatBrushBuilder,
    MergeCell,
    MergeCellsBuilder,
    Payload,
    Transaction,
    SelectedData,
    VerticalAlignment,
    SplitMergedCellsBuilder,
    getFirstCell,
} from 'logisheets-web'
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
    AlignHorizontalCenterOutlined,
    WrapText as WrapTextIcon,
    StrikethroughS,
} from '@mui/icons-material'
import {isErrorMessage} from 'packages/web/src/api/utils'
import {StandardColor, StandardFont} from '@/core/standable'
import {useToast} from '@/ui/notification/useToast'
import {TextField} from '@mui/material'
import Select, {SelectChangeEvent} from '@mui/material/Select'
import {Grid} from '@/core/worker/types'

export interface ToolbarProps {
    setGrid: (grid: Grid | null) => void
    selectedData?: SelectedData
}

export const Toolbar = ({selectedData, setGrid}: ToolbarProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const {toast} = useToast()
    const hasSelectedData =
        selectedData !== undefined && selectedData.data !== undefined

    // File open
    const fileInputRef = useRef<HTMLInputElement>(null)
    const onOpenClick = () => fileInputRef.current?.click()
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.item(0)
        if (!file) return
        const readFile = file.arrayBuffer().then(async (buf) => {
            const grid = await DATA_SERVICE.loadWorkbook(
                new Uint8Array(buf),
                file.name
            )
            if (isErrorMessage(grid)) {
                // todo!
                return
            }
            let appData = await DATA_SERVICE.getWorkbook().getAppData()
            if (isErrorMessage(appData)) appData = []
            appData.forEach((d) => {
                if (d.name === 'logisheets') {
                    CRAFT_MANAGER.parseAppData(d.data)
                }
            })
            setGrid(grid)
            setBookName(file.name.replace(/\.[^/.]+$/, ''))
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
    const [strike, setStrike] = useState(false)

    // Alignment popover
    const [alignAnchor, setAlignAnchor] = useState<HTMLElement | null>(null)
    const [alignment, setAlignment] = useState<string | null>(null)
    const [wrapText, setWrapText] = useState(false)
    const [bookName, setBookName] = useState('Untitled')

    // Merge
    const [mergedOn, setMergedOn] = useState<boolean | null>(null)
    let mergedCells: readonly MergeCell[] = []

    // Border modal
    const [borderOpen, setBorderOpen] = useState(false)

    // BlockComposer modal
    const [composerOpen, setComposerOpen] = useState(false)

    // Number format
    const [numberFormat, setNumberFormat] = useState<string>('general')
    const onNumberFormatChange = (e: SelectChangeEvent<string>) => {
        const v = (e.target.value as string) || 'general'
        if (!selectedData) return
        setNumberFormat(v)
        let numFmt = 'general'
        switch (v) {
            case 'general':
                break
            case 'number':
                numFmt = '0.00_'
                break
            case 'fraction':
                numFmt = '1/2'
                break
            case 'percent':
                numFmt = '0.00%'
                break
            case 'text':
                numFmt = '@'
                break
            case 'date':
                numFmt = 'yyyy/m/d;@'
                break
            case 'time':
                numFmt = 'h:mm:ss'
                break
            default:
                break
        }
        const payloads = generateNumFmtPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            numFmt
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true))
    }

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
        const {y: r, x: c} = cell
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        DATA_SERVICE.getCellInfo(sheet, r, c).then((ci) => {
            if (isErrorMessage(ci)) return
            const style = ci.getStyle()
            const a = style.alignment
            let h = null
            let v = null
            if (a?.horizontal === 'center') h = 'center'
            else if (a?.horizontal === 'left') h = 'left'
            else if (a?.horizontal === 'right') h = 'right'
            if (a?.vertical === 'center') v = 'center'
            else if (a?.vertical === 'top') v = 'top'
            else if (a?.vertical === 'bottom') v = 'bottom'
            if (h && v) setAlignment(`${h}-${v}`)
            else if (h) setAlignment(`${h}-center`)
            else if (v) setAlignment(`center-${v}`)
            else setAlignment(null)
            const pf = getPatternFill(style.fill)

            if (a?.wrapText || false) setWrapText(a.wrapText)
            if (pf && pf.bgColor) {
                const c = StandardColor.fromCtColor(pf.bgColor)
                setFillColor(c.css())
            }
            const font = StandardFont.from(style.font)
            setFontColor(font.standardColor.css())
            setBold(font.bold)
            setItalic(font.italic)
            setUnderline(font.underline ? font.underline.val !== 'none' : false)
            switch (style.formatter.toLocaleLowerCase()) {
                case '':
                case 'general':
                    setNumberFormat('general')
                    break
                case '0.00_':
                    setNumberFormat('number')
                    break
                case '1/2':
                    setNumberFormat('fraction')
                    break
                case '0.00%':
                    setNumberFormat('percent')
                    break
                case '@':
                    setNumberFormat('text')
                    break
                case 'yyyy/m/d':
                case 'yyyy/m/d;@':
                    setNumberFormat('date')
                    break
                case 'h:mm:ss':
                    setNumberFormat('time')
                    break
                default:
                    setNumberFormat('Custom')
            }
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

    const formatBrushOnRef = useRef(formatBrushOn)
    useEffect(() => {
        formatBrushOnRef.current = formatBrushOn
    }, [formatBrushOn])

    const selectedDataRef = useRef<SelectedData | undefined>(selectedData)
    useEffect(() => {
        selectedDataRef.current = selectedData
    }, [selectedData])

    useEffect(() => {
        const onMouseUp = () => {
            const fb = formatBrushOnRef.current
            const sel = selectedDataRef.current
            if (!fb) return
            if (!sel) return

            const cellRange = getSelectedCellRange(sel)
            if (cellRange) {
                const payload: Payload = {
                    type: 'cellFormatBrush',
                    value: new CellFormatBrushBuilder()
                        .srcSheetIdx(fb.sheetIdx)
                        .srcRow(fb.row)
                        .srcCol(fb.col)
                        .dstRowStart(cellRange.startRow)
                        .dstColStart(cellRange.startCol)
                        .dstRowEnd(cellRange.endRow)
                        .dstColEnd(cellRange.endCol)
                        .dstSheetIdx(fb.sheetIdx)
                        .build(),
                }
                DATA_SERVICE.handleTransaction(new Transaction([payload], true))
                setFormatBrushOn(null)
                return
            }

            const lineRange = getSelectedLines(sel)
            if (lineRange) {
                const payload: Payload = {
                    type: 'lineFormatBrush',
                    value: new LineFormatBrushBuilder()
                        .srcSheetIdx(fb.sheetIdx)
                        .srcRow(fb.row)
                        .srcCol(fb.col)
                        .from(lineRange.start)
                        .to(lineRange.end)
                        .dstSheetIdx(fb.sheetIdx)
                        .row(lineRange.type === 'row')
                        .build(),
                }
                DATA_SERVICE.handleTransaction(new Transaction([payload], true))
                setFormatBrushOn(null)
            }
        }

        window.addEventListener('mouseup', onMouseUp)
        return () => window.removeEventListener('mouseup', onMouseUp)
    }, [DATA_SERVICE])

    // Handlers
    const onFormatPainter = () => {
        if (formatBrushOn) return setFormatBrushOn(null)
        if (!selectedData) return
        const src = getFirstCell(selectedData)
        setFormatBrushOn({
            sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
            row: src.y,
            col: src.x,
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

    const onToggleStrike = () => {
        if (!selectedData) return
        const v = !strike
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {strike: v}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            () => setStrike(v)
        )
    }

    const onToggleWrapText = () => {
        if (!selectedData) return
        const v = !wrapText
        const payloads = generateWrapTextPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            v
        )
        DATA_SERVICE.handleTransactionAndAdjustRowHeights(
            new Transaction(payloads, true),
            true
        ).then(() => setWrapText(v))
    }

    const onAlignClick = (event: React.MouseEvent<HTMLElement>) => {
        setAlignAnchor(event.currentTarget)
    }
    const onChooseAlign = (
        v:
            | 'left-center'
            | 'center-center'
            | 'right-center'
            | 'left-top'
            | 'center-top'
            | 'right-top'
            | 'left-bottom'
            | 'center-bottom'
            | 'right-bottom'
    ) => {
        if (!selectedData) return
        const payloads = generateAlgnmentPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {
                horizontal: v.split('-')[0] as HorizontalAlignment,
                vertical: v.split('-')[1] as VerticalAlignment,
            }
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            () => setAlignment(v)
        )
        setAlignAnchor(null)
    }

    const onFontSizeChange = async (ty: 'increase' | 'decrease') => {
        if (!selectedData) return
        const firstCell = getFirstCell(selectedData)
        const cellInfo = await DATA_SERVICE.getCellInfo(
            DATA_SERVICE.getCurrentSheetIdx(),
            firstCell.y,
            firstCell.x
        )
        if (isErrorMessage(cellInfo)) return
        const fontSize = cellInfo.getStyle().font.sz ?? 10
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {size: ty === 'increase' ? fontSize + 1 : fontSize - 1}
        )
        DATA_SERVICE.handleTransactionAndAdjustRowHeights(
            new Transaction(payloads, true)
        )
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

    // Icon for alignment grid cells
    /* eslint-disable react/prop-types */
    const AlignCellIcon: React.FC<{
        pos:
            | 'left-center'
            | 'center-center'
            | 'right-center'
            | 'left-top'
            | 'center-top'
            | 'right-top'
            | 'left-bottom'
            | 'center-bottom'
            | 'right-bottom'
    }> = ({pos}) => {
        const indicator = 4 // size of the indicator square
        const pad = 3 // padding around the canvas
        const size = 18 // inner box size

        const [h, v] = pos.split('-') as [
            'left' | 'center' | 'right',
            'top' | 'center' | 'bottom'
        ]
        const x =
            h === 'left'
                ? pad + 2
                : h === 'center'
                ? pad + size / 2 - indicator / 2
                : pad + size - indicator - 2
        const y =
            v === 'top'
                ? pad + 2
                : v === 'center'
                ? pad + size / 2 - indicator / 2
                : pad + size - indicator - 2

        return (
            <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                aria-hidden
                focusable={false}
            >
                {/* Outer box */}
                <rect
                    x={pad}
                    y={pad}
                    width={size}
                    height={size}
                    rx={2}
                    ry={2}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.5}
                    strokeWidth={1}
                />
                {/* Indicator square */}
                <rect
                    x={x}
                    y={y}
                    width={indicator}
                    height={indicator}
                    fill="currentColor"
                />
            </svg>
        )
    }
    async function onSave(): Promise<void> {
        const blockFields = await DATA_SERVICE.getWorkbook().getAllBlockFields()
        if (isErrorMessage(blockFields)) return
        const persistentData = CRAFT_MANAGER.getPersistentData(blockFields)
        const saveResult = await DATA_SERVICE.getWorkbook().save({
            appData: persistentData,
        })
        if (isErrorMessage(saveResult)) return
        const {code, data} = saveResult
        if (code !== 0) throw Error('error saving')
        // data is Vec<u8> from Rust, serialized as a JS array by serde_wasm_bindgen
        // Convert to Uint8Array before creating the Blob
        const bytes = Array.isArray(data) ? new Uint8Array(data) : data
        const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${bookName}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
    }
    return (
        <div className={styles.host}>
            {/* App logo */}
            <img src="/logo.png" alt="LogiSheets" className={styles.logo} />
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
                        sx={{fontSize: 12}}
                    >
                        <FolderOpenIcon
                            fontSize="small"
                            style={{marginRight: 8}}
                        />
                        Open
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            closeFileMenu()
                            onSave()
                        }}
                        sx={{fontSize: 12}}
                    >
                        <SaveIcon fontSize="small" style={{marginRight: 8}} />
                        Save
                    </MenuItem>
                </Menu>
                <TextField
                    value={bookName}
                    onChange={(e) => setBookName(e.target.value)}
                    variant="standard"
                    size="small"
                    placeholder="Untitled"
                    sx={{
                        '& .MuiInput-root': {
                            fontSize: '14px',
                            fontWeight: 500,
                        },
                        '& .MuiInput-root:before': {
                            borderBottom: 'none',
                        },
                        '& .MuiInput-root:hover:not(.Mui-disabled):before': {
                            borderBottom: '1px solid rgba(0, 0, 0, 0.42)',
                        },
                        '& .MuiInput-root:after': {
                            borderBottom: '2px solid primary.main',
                        },
                        '& input': {
                            cursor: 'pointer',
                            padding: '4px 8px',
                        },
                        '& input:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                    }}
                />
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
                        <span>
                            <IconButton
                                size="small"
                                onClick={onFormatPainter}
                                color={formatBrushOn ? 'primary' : 'default'}
                                disabled={!hasSelectedData}
                            >
                                <FormatPaintIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Tooltip title="Bold">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onToggleBold}
                                color={bold ? 'primary' : 'default'}
                                disabled={!hasSelectedData}
                            >
                                <FormatBoldIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Italic">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onToggleItalic}
                                color={italic ? 'primary' : 'default'}
                                disabled={!hasSelectedData}
                            >
                                <FormatItalicIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Underline">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onToggleUnderline}
                                color={underline ? 'primary' : 'default'}
                                disabled={!hasSelectedData}
                            >
                                <FormatUnderlinedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Strikethrough">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onToggleStrike}
                                color={strike ? 'primary' : 'default'}
                                disabled={!hasSelectedData}
                            >
                                <StrikethroughS
                                    fontSize="small"
                                    style={{textDecoration: 'line-through'}}
                                />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Font Color">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => setColorPicking('font')}
                                sx={{color: fontColor}}
                                disabled={!hasSelectedData}
                            >
                                <FormatColorTextIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Increase font size">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => onFontSizeChange('increase')}
                            >
                                <TextIncrease fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Decrease font size">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => onFontSizeChange('decrease')}
                            >
                                <TextDecrease fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Wrap text">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onToggleWrapText}
                                color={wrapText ? 'primary' : 'default'}
                                disabled={!hasSelectedData}
                            >
                                <WrapTextIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Tooltip title="Fill Color">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => setColorPicking('fill')}
                                sx={{color: fillColor}}
                                disabled={!hasSelectedData}
                            >
                                <FormatColorFillIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Tooltip title="Borders">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => setBorderOpen(true)}
                                disabled={!hasSelectedData}
                            >
                                <BorderIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>

                    <Tooltip title="Alignment">
                        <span>
                            <IconButton
                                size="small"
                                onClick={onAlignClick}
                                color={alignment ? 'primary' : 'default'}
                                disabled={!hasSelectedData}
                            >
                                <AlignHorizontalCenterOutlined fontSize="small" />
                                <ArrowDropDownIcon fontSize="small" />
                            </IconButton>
                        </span>
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
                {/* number formatter */}
                <div className={styles.section}>
                    <Select
                        size="small"
                        value={numberFormat}
                        onChange={onNumberFormatChange}
                        displayEmpty
                        disabled={!hasSelectedData}
                        sx={{minWidth: 100, maxHeight: 30, fontSize: 12}}
                    >
                        <MenuItem value="general" sx={{fontSize: 12}}>
                            General
                        </MenuItem>
                        <MenuItem value="number" sx={{fontSize: 12}}>
                            Number
                        </MenuItem>
                        <MenuItem value="fraction" sx={{fontSize: 12}}>
                            Fraction
                        </MenuItem>
                        <MenuItem value="percent" sx={{fontSize: 12}}>
                            Percent
                        </MenuItem>
                        <MenuItem value="text" sx={{fontSize: 12}}>
                            Text
                        </MenuItem>
                        <MenuItem value="date" sx={{fontSize: 12}}>
                            Date
                        </MenuItem>
                        <MenuItem value="time" sx={{fontSize: 12}}>
                            Time
                        </MenuItem>
                    </Select>
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
                        CreateBlock
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
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('left-top')}
                    >
                        <AlignCellIcon pos="left-top" />
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('center-top')}
                    >
                        <AlignCellIcon pos="center-top" />
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('right-top')}
                    >
                        <AlignCellIcon pos="right-top" />
                    </button>
                    {/* Middle row */}
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('left-center')}
                    >
                        <AlignCellIcon pos="left-center" />
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('center-center')}
                    >
                        <AlignCellIcon pos="center-center" />
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('right-center')}
                    >
                        <AlignCellIcon pos="right-center" />
                    </button>
                    {/* Bottom row (not wired) */}
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('left-bottom')}
                    >
                        <AlignCellIcon pos="left-bottom" />
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('center-bottom')}
                    >
                        <AlignCellIcon pos="center-bottom" />
                    </button>
                    <button
                        className={styles.alignCell}
                        onClick={() => onChooseAlign('right-bottom')}
                    >
                        <AlignCellIcon pos="right-bottom" />
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
