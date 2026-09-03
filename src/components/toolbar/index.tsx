import {useEffect, useRef, useState} from 'react'
import type {FC, ReactNode} from 'react'
import {observer} from 'mobx-react-lite'
import {globalStore} from '@/store'
import styles from './toolbar.module.scss'
import modalStyles from '../modal.module.scss'
import {
    getSelectedCellRange,
    getSelectedLines,
    toA1notation,
    Grid,
} from 'logisheets-engine'
import {Cell, ErrorMessage} from 'logisheets-engine'
import {useEngine, useOps} from '@/core/engine/provider'
import {BlockComposerComponent} from '@/components/block-composer'
import {ConditionalFormattingDialog} from '@/components/conditional-formatting'
import {BorderSettingComponent} from './border-setting'
import {GithubStar} from './github-star'
import {generateFontPayload, generateWrapTextPayload} from 'logisheets-core'
import {
    CellFormatBrushBuilder,
    HorizontalAlignment,
    getPatternFill,
    LineFormatBrushBuilder,
    MergeCell,
    MergeCellsBuilder,
    Payload,
    SelectedData,
    VerticalAlignment,
    SplitMergedCellsBuilder,
    getFirstCell,
} from 'logisheets-engine'
import {tx} from '@/core/transaction'
import {
    getPersistentInteractions,
    loadPersistentInteractions,
    getPersistentCraftStates,
    loadPersistentCraftStates,
} from 'logisheets-core'
import {ColorResult, SketchPicker} from 'react-color'
import Modal from 'react-modal'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import FunctionsIcon from '@mui/icons-material/Functions'
import SearchIcon from '@mui/icons-material/Search'
import BackspaceIcon from '@mui/icons-material/Backspace'
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined'
import ViewWeekOutlinedIcon from '@mui/icons-material/ViewWeekOutlined'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import TextIncreaseIcon from '@mui/icons-material/TextIncrease'
import TextDecreaseIcon from '@mui/icons-material/TextDecrease'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ExtensionIcon from '@mui/icons-material/Extension'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import Popover from '@mui/material/Popover'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tabs from '@mui/material/Tabs'
import Dialog from '@mui/material/Dialog'
import Tab from '@mui/material/Tab'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import {
    FolderOpen as FolderOpenIcon,
    Save as SaveIcon,
    Undo as UndoIcon,
    Redo as RedoIcon,
    Science as ScienceIcon,
    FormatPaint as FormatPaintIcon,
    FormatBold as FormatBoldIcon,
    FormatItalic as FormatItalicIcon,
    FormatUnderlined as FormatUnderlinedIcon,
    FormatColorText as FormatColorTextIcon,
    FormatColorFill as FormatColorFillIcon,
    BorderClear as BorderIcon,
    ArrowDropDown as ArrowDropDownIcon,
    NorthEastOutlined as NorthEastOutlinedIcon,
    SouthWestOutlined as SouthWestOutlinedIcon,
    LayersClearOutlined as LayersClearOutlinedIcon,
    PaletteOutlined as PaletteOutlinedIcon,
    TextIncrease,
    TextDecrease,
    AlignHorizontalCenterOutlined,
    WrapText as WrapTextIcon,
    StrikethroughS,
    BarChart as BarChartIcon,
    GridViewOutlined as GridViewIcon,
    Download as DownloadIcon,
} from '@mui/icons-material'
import {isErrorMessage} from 'logisheets-web'
import {StandardColor, StandardFont} from '@/core/standable'
import {useToast} from '@/ui/notification/useToast'
import {TextField} from '@mui/material'
import Select, {SelectChangeEvent} from '@mui/material/Select'

// Common, widely-available font families offered in the picker. If the current
// cell's font isn't in the list it's shown as an extra option so the value is
// never lost.
const FONT_FAMILIES = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Calibri',
    'Cambria',
    'Comic Sans MS',
    'Impact',
    '微软雅黑',
    '宋体',
    '黑体',
    '楷体',
]

/** The chart kinds the engine can create from a selection. */
const CHART_TYPES = [
    {value: 'col', label: 'Column'},
    {value: 'bar', label: 'Bar'},
    {value: 'line', label: 'Line'},
    {value: 'area', label: 'Area'},
    {value: 'pie', label: 'Pie'},
    {value: 'doughnut', label: 'Doughnut'},
    {value: 'scatter', label: 'Scatter'},
    {value: 'radar', label: 'Radar'},
    // Reads three columns from the selection: X, Y, then bubble size.
    {value: 'bubble', label: 'Bubble'},
    // Stock reads its series positionally: 4 columns is open/high/low/close,
    // 3 is high/low/close.
    {value: 'stock', label: 'Stock'},
    {value: 'ofPie', label: 'Pie of pie'},
    {value: 'barOfPie', label: 'Bar of pie'},
    {value: 'surface', label: 'Surface'},
    {value: 'surface3d', label: 'Surface (3-D)'},
    // The 3-D forms round-trip to Excel as 3-D but are drawn flat here.
    {value: 'col3d', label: 'Column (3-D)'},
    {value: 'bar3d', label: 'Bar (3-D)'},
    {value: 'line3d', label: 'Line (3-D)'},
    {value: 'area3d', label: 'Area (3-D)'},
    {value: 'pie3d', label: 'Pie (3-D)'},
]

export interface ToolbarProps {
    setGrid: (grid: Grid | null) => void
    setActiveSheet: (idx: number) => void
    selectedData?: SelectedData
    /** Toggle the built-in Watson assistant panel. */
    onToggleWatson?: () => void
    /** Whether the Watson panel is currently open (highlights the button). */
    watsonActive?: boolean
    /** Toggle the craft panel. */
    onToggleCraft?: () => void
    /** Whether the craft panel is currently open (highlights the button). */
    craftActive?: boolean
}

/** The point sizes Excel and Sheets offer; the box also accepts any value. */
const FONT_PT_CHOICES = [
    8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
] as const

/**
 * A ribbon button that says what it does.
 *
 * An icon alone only works once you already know the tool — `Merge`, `Wrap` or
 * the trace arrows are unreadable on first contact, and a tooltip does not help
 * someone scanning for a feature they have never seen. So the label ships with
 * the icon and only drops out when the ribbon genuinely runs out of room (see
 * the container query in the stylesheet), which is the order Excel and Sheets
 * degrade in too. `B`/`I`/`U` keep their bare glyphs: those are universal, and
 * labelling them would push everything else off the row.
 */
/**
 * Merge cells.
 *
 * Material's `Merge` is the version-control arrow — two branches joining — so
 * on a spreadsheet toolbar it reads as anything but "make these cells one".
 * This draws the operation instead: a divided bottom row under a single wide
 * cell, which is the before and after in one glyph.
 */
const MergeCellsIcon: FC<{fontSize?: 'small' | 'inherit'}> = () => (
    <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{fontSize: 18}}
        aria-hidden="true"
        focusable="false"
    >
        <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
        {/* the merged cell above, two cells below */}
        <path d="M3.5 12h17" />
        <path d="M12 12v7" />
    </svg>
)

const ToolButton: FC<{
    label: string
    tip?: string
    icon: ReactNode
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
    active?: boolean
}> = ({label, tip, icon, onClick, disabled, active}) => (
    <Tooltip title={tip ?? label}>
        {/* A disabled button fires no events, so the tooltip needs a live
            wrapper to hang off. */}
        <span>
            <button
                type="button"
                className={`${styles.toolBtn} ${
                    active ? styles.toolBtnActive : ''
                }`}
                aria-label={label}
                aria-pressed={active}
                disabled={disabled}
                onClick={onClick}
            >
                <span className={styles.toolIcon}>{icon}</span>
                <span className={styles.toolLabel}>{label}</span>
            </button>
        </span>
    </Tooltip>
)

export const Toolbar = observer(
    ({
        selectedData,
        setGrid,
        setActiveSheet,
        onToggleWatson,
        watsonActive,
        onToggleCraft,
        craftActive,
    }: ToolbarProps) => {
        const engine = useEngine()
        const DATA_SERVICE = engine.getDataService()
        const ops = useOps()
        const BLOCK_MANAGER = engine.getBlockManager()
        const {toast} = useToast()
        const hasSelectedData =
            selectedData !== undefined && selectedData.data !== undefined

        // File open
        const fileInputRef = useRef<HTMLInputElement>(null)
        const onOpenClick = () => fileInputRef.current?.click()
        const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.item(0)
            if (!file) return
            // Reset the input so picking the same file again re-fires change —
            // matters when the user cancels the overwrite prompt and retries.
            e.target.value = ''
            try {
                const buf = await file.arrayBuffer()
                // Use engine.loadFile, NOT DATA_SERVICE.loadWorkbook. The
                // engine path delegates to the mounted Spreadsheet's own
                // `loadWorkbook` (engine.ts:loadFile -> mounted.loadWorkbook),
                // which calls its internal render() + updateDocumentDimensions
                // and pushes the fresh grid through onGridChange — populating
                // grid.blockInfos for React. Calling the data service directly
                // refreshes the worker only; the Svelte side stays on stale
                // dimensions/blocks and the host never sees blockInfos for the
                // newly loaded workbook.
                const grid = await engine.loadFile(
                    new Uint8Array(buf),
                    file.name
                )
                if (!grid) {
                    // No grid: the user declined the overwrite prompt, or the
                    // load failed (the engine surfaces failures via its own
                    // error event). Either way nothing changed — stay silent.
                    return
                }
                let appData = await DATA_SERVICE.getWorkbook().getAppData()
                if (isErrorMessage(appData)) appData = []
                // Reset all host-held, AppData-backed state before applying the
                // loaded workbook's. A workbook with no `logisheets` AppData
                // entry would otherwise silently inherit the previously-open
                // workbook's block fields, craft interactions, and craft state.
                BLOCK_MANAGER.clear()
                loadPersistentInteractions(undefined)
                loadPersistentCraftStates(undefined)
                appData.forEach((d: {name: string; data: string}) => {
                    if (d.name !== 'logisheets') return
                    // Envelope format (current): a JSON object with `version`,
                    // `blockManager` (the BlockManager's own payload), and
                    // `craftInteractions` (host-held interaction state).
                    // Legacy format: the raw BlockManager string. Detect by
                    // attempting to parse and checking for the envelope shape.
                    let envelope: {
                        version?: number
                        blockManager?: string
                        craftInteractions?: unknown
                        craftStates?: unknown
                    } | null = null
                    try {
                        const parsed = JSON.parse(d.data)
                        if (
                            parsed &&
                            typeof parsed === 'object' &&
                            typeof parsed.version === 'number'
                        ) {
                            envelope = parsed
                        }
                    } catch {
                        // not JSON — falls through to legacy path
                    }
                    if (envelope) {
                        if (typeof envelope.blockManager === 'string') {
                            BLOCK_MANAGER.parseAppData(envelope.blockManager)
                        }
                        loadPersistentInteractions(envelope.craftInteractions)
                        loadPersistentCraftStates(envelope.craftStates)
                    } else {
                        BLOCK_MANAGER.parseAppData(d.data)
                    }
                })
                // Force a new grid reference so BlockInterfaceComponent
                // re-renders. During `engine.loadFile` the gridChange listener
                // already called setGrid(grid) — but that fired BEFORE
                // parseAppData populated FieldManager, so the first render
                // saw blocks with no matching fields and soft-skipped them
                // all. Passing the same object reference here would be a
                // React no-op (Object.is bails out); spread forces a fresh
                // identity so React re-renders BlockInterface with the
                // now-populated FieldManager.
                setGrid({...grid})
                // Reset to first sheet — host's previous active idx may not
                // exist in the new workbook (engine.loadFile already rendered
                // sheet 0 via the mounted component).
                setActiveSheet(0)
                setBookName(file.name.replace(/\.[^/.]+$/, ''))
                toast.success(`Read file ${file.name}`)
            } catch {
                toast.error('Read file error, retry later')
            }
        }

        // File menu (dropdown)
        const [fileAnchor, setFileAnchor] = useState<HTMLElement | null>(null)
        // Which toolbar ribbon tab is active.
        const fontSizeBoxRef = useRef<HTMLDivElement>(null)
        const [saving, setSaving] = useState(false)
        const [showValues, setShowValues] = useState(true)
        const [activeTab, setActiveTab] = useState<
            'home' | 'insert' | 'formulas' | 'data' | 'view' | 'advanced'
        >('home')
        const openFileMenu = (e: React.MouseEvent<HTMLElement>) =>
            setFileAnchor(e.currentTarget)
        const closeFileMenu = () => setFileAnchor(null)

        // Undo/Redo
        const undo = () => DATA_SERVICE.undo()
        const redo = () => DATA_SERVICE.redo()

        // Temp mode toggle
        const onToggleTempMode = () => {
            const next = !globalStore.isTempMode
            if (!next) {
                // Exiting temp mode: commit accumulated temp work as one undo step
                DATA_SERVICE.getWorkbook().commitTempStatus()
            }
            globalStore.setTempMode(next)
        }

        // Painter / font / fill
        const [formatBrushOn, setFormatBrushOn] = useState<{
            sheetIdx: number
            row: number
            col: number
        } | null>(null)

        const [fontColor, setFontColor] = useState('#000')
        const [fillColor, setFillColor] = useState('#000')
        const [colorPicking, setColorPicking] = useState<'font' | 'fill' | ''>(
            ''
        )

        const [bold, setBold] = useState(false)
        const [italic, setItalic] = useState(false)
        const [underline, setUnderline] = useState(false)
        const [strike, setStrike] = useState(false)
        const [fontName, setFontName] = useState('Arial')
        // The size of the selection's first cell, and the text in the box while
        // the user is typing (kept separate so a half-typed "1" is not applied).
        const [fontPt, setFontPt] = useState(10)
        const [fontPtDraft, setFontPtDraft] = useState<string | null>(null)
        const [fontSizeAnchor, setFontSizeAnchor] =
            useState<HTMLElement | null>(null)
        // The conditional-formatting dialog, which the Data tab opens for the
        // current selection. Until now it was reachable only from the cell
        // context menu.
        const [cfRange, setCfRange] = useState<{
            sheetIdx: number
            startRow: number
            startCol: number
            endRow: number
            endCol: number
        } | null>(null)

        // Alignment popover
        const [alignAnchor, setAlignAnchor] = useState<HTMLElement | null>(null)
        const [chartAnchor, setChartAnchor] = useState<HTMLElement | null>(null)
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
            ops.setNumFmt(
                DATA_SERVICE.getCurrentSheetIdx(),
                selectedData,
                numFmt
            )
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
            DATA_SERVICE.getCellInfo(sheet, r, c).then(
                (ci: Cell | ErrorMessage) => {
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
                    setUnderline(
                        font.underline ? font.underline.val !== 'none' : false
                    )
                    setStrike(font.strike)
                    setFontName(font.name?.val || 'Arial')
                    setFontPt(font.sz ?? 10)
                    setFontPtDraft(null)
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
                }
            )
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
            ).then((v: readonly MergeCell[] | ErrorMessage) => {
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
                    ops.applyPayloads([payload])
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
                    ops.applyPayloads([payload])
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
                ops.setFont(DATA_SERVICE.getCurrentSheetIdx(), selectedData, {
                    color: color.argb(),
                }).then(() => {
                    setFontColor(color.css())
                    setColorPicking('')
                })
            } else if (colorPicking === 'fill') {
                ops.setPatternFill(
                    DATA_SERVICE.getCurrentSheetIdx(),
                    selectedData,
                    {bgColor: color.argb(), pattern: 'solid'}
                ).then(() => {
                    setFillColor(color.css())
                    setColorPicking('')
                })
            }
        }

        const onToggleBold = () => {
            if (!selectedData) return
            const v = !bold
            ops.setFont(DATA_SERVICE.getCurrentSheetIdx(), selectedData, {
                bold: v,
            }).then(() => setBold(v))
        }
        const onToggleItalic = () => {
            if (!selectedData) return
            const v = !italic
            ops.setFont(DATA_SERVICE.getCurrentSheetIdx(), selectedData, {
                italic: v,
            }).then(() => setItalic(v))
        }
        const onToggleUnderline = () => {
            if (!selectedData) return
            const v = !underline
            ops.setFont(DATA_SERVICE.getCurrentSheetIdx(), selectedData, {
                underline: v,
            }).then(() => setUnderline(v))
        }

        const onToggleStrike = () => {
            if (!selectedData) return
            const v = !strike
            ops.setFont(DATA_SERVICE.getCurrentSheetIdx(), selectedData, {
                strike: v,
            }).then(() => setStrike(v))
        }

        const onFontNameChange = (e: SelectChangeEvent<string>) => {
            if (!selectedData) return
            const v = e.target.value
            ops.setFont(DATA_SERVICE.getCurrentSheetIdx(), selectedData, {
                name: v,
            }).then(() => setFontName(v))
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
                tx(payloads, true),
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
            ops.setAlignment(DATA_SERVICE.getCurrentSheetIdx(), selectedData, {
                horizontal: v.split('-')[0] as HorizontalAlignment,
                vertical: v.split('-')[1] as VerticalAlignment,
            }).then(() => setAlignment(v))
            setAlignAnchor(null)
        }

        // ─── Cells, editing and auditing ────────────────────────────────
        // These mirror actions the right-click menu already offers. They are
        // reissued here rather than shared with it because each is a couple of
        // payloads over the selection; the menu's versions also close the menu
        // and re-select, which a toolbar button must not do.

        const runTxn = (payloads: readonly Payload[]) =>
            DATA_SERVICE.handleTransaction(tx(payloads, true))

        /** Insert or delete whole rows/columns across the selection. */
        const lineOp = (axis: 'row' | 'col', op: 'insert' | 'delete') => {
            if (!selectedData) return
            const r = getSelectedCellRange(selectedData)
            if (!r) return
            const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
            const [lo, hi] =
                axis === 'row' ? [r.startRow, r.endRow] : [r.startCol, r.endCol]
            const count = hi - lo + 1
            const type =
                op === 'insert'
                    ? axis === 'row'
                        ? 'insertRows'
                        : 'insertCols'
                    : axis === 'row'
                    ? 'deleteRows'
                    : 'deleteCols'
            runTxn([{type, value: {sheetIdx, start: lo, count}} as Payload])
        }

        /** Empty every cell in the selection, keeping its formatting. */
        const clearCells = () => {
            if (!selectedData) return
            const r = getSelectedCellRange(selectedData)
            if (!r) return
            const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
            const payloads: Payload[] = []
            for (let row = r.startRow; row <= r.endRow; row++) {
                for (let col = r.startCol; col <= r.endCol; col++) {
                    payloads.push({
                        type: 'cellClear',
                        value: {sheetIdx, row, col},
                    })
                }
            }
            runTxn(payloads)
        }

        /** Pick a file and anchor it to the selection's top-left cell. */
        const insertImage = () => {
            if (!selectedData) return
            const r = getSelectedCellRange(selectedData)
            if (!r) return
            const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/png,image/jpeg,image/gif,image/bmp'
            input.onchange = () => {
                const file = input.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                    const result = String(reader.result ?? '')
                    const comma = result.indexOf(',')
                    if (comma < 0) return
                    const data = result.slice(comma + 1)
                    let format = 'png'
                    const m = /^data:image\/([a-z0-9.+-]+);/i.exec(result)
                    if (m) format = m[1].toLowerCase()
                    const imageId =
                        typeof crypto !== 'undefined' && crypto.randomUUID
                            ? crypto.randomUUID()
                            : `img-${Date.now()}`
                    runTxn([
                        {
                            type: 'setCellImage',
                            value: {
                                sheetIdx,
                                row: r.startRow,
                                col: r.startCol,
                                imageId,
                                format,
                                data,
                            },
                        } as Payload,
                    ])
                }
                reader.readAsDataURL(file)
            }
            input.click()
        }

        const addComment = () => {
            if (!selectedData) return
            const r = getSelectedCellRange(selectedData)
            if (!r) return
            globalStore.requestAddComment({
                sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
                row: r.startRow,
                col: r.startCol,
            })
        }

        /**
         * Sum the run of cells directly above the selection (or to its left
         * when the selection spans a row), writing `=SUM(range)` into it —
         * Excel's AutoSum, which guesses the range instead of asking.
         */
        const autoSum = async () => {
            if (!selectedData) return
            const r = getSelectedCellRange(selectedData)
            if (!r) return
            const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
            const numericAt = async (row: number, col: number) => {
                if (row < 0 || col < 0) return false
                const info = await DATA_SERVICE.getCellInfo(sheetIdx, row, col)
                if (isErrorMessage(info)) return false
                const v = info.toCellInfo().value
                return v !== 'empty' && v.type === 'number'
            }
            // Walk up first; a single row of numbers to the left is the other
            // shape people expect.
            let start = r.startRow
            while (start > 0 && (await numericAt(start - 1, r.startCol)))
                start--
            if (start < r.startRow) {
                const col = toA1notation(r.startCol)
                runTxn([
                    {
                        type: 'cellInput',
                        value: {
                            sheetIdx,
                            row: r.startRow,
                            col: r.startCol,
                            content: `=SUM($${col}$${start + 1}:$${col}$${
                                r.startRow
                            })`,
                        },
                    } as Payload,
                ])
                return
            }
            let left = r.startCol
            while (left > 0 && (await numericAt(r.startRow, left - 1))) left--
            if (left < r.startCol) {
                const row = r.startRow + 1
                runTxn([
                    {
                        type: 'cellInput',
                        value: {
                            sheetIdx,
                            row: r.startRow,
                            col: r.startCol,
                            content: `=SUM($${toA1notation(
                                left
                            )}$${row}:$${toA1notation(r.startCol - 1)}$${row})`,
                        },
                    } as Payload,
                ])
            }
        }

        /** Zoom is engine state, so the buttons just drive its API. */
        const zoomPct = Math.round(engine.getZoom() * 100)

        /**
         * Creating a block is this spreadsheet's flagship action, so it earns
         * two doors: Insert, where someone looks for "add a thing", and
         * Advanced, next to the rest of what makes this not-Excel. One
         * definition rendered twice — a second copy would drift.
         */
        const createBlockButton = (
            <Button
                variant="outlined"
                size="small"
                color="primary"
                onClick={() => setComposerOpen(true)}
                startIcon={<GridViewIcon />}
                disabled={
                    selectedData === undefined ||
                    getSelectedCellRange(selectedData) === undefined
                }
                sx={{
                    borderRadius: '8px',
                    fontWeight: 600,
                    px: 1.25,
                    whiteSpace: 'nowrap',
                }}
            >
                CreateBlock
            </Button>
        )

        /** Trace arrows for the selection's first cell (see TraceLayer). */
        const traceCell = (kind: 'precedents' | 'dependents') => {
            if (!selectedData) return
            const r = getSelectedCellRange(selectedData)
            if (!r) return
            globalStore.requestTrace({
                sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
                row: r.startRow,
                col: r.startCol,
                kind,
            })
        }

        const openConditionalFormatting = () => {
            if (!selectedData) return
            const r = getSelectedCellRange(selectedData)
            if (!r) return
            setCfRange({
                sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
                startRow: r.startRow,
                startCol: r.startCol,
                endRow: r.endRow,
                endCol: r.endCol,
            })
        }

        /** Apply an absolute point size, the way the size box does. */
        /**
         * The next size up or down the offered ladder rather than ±1pt: from 11
         * the useful next step is 12, and at the top end 48 → 72, which walking
         * one point at a time would take forever to reach.
         */
        const nextFontPt = (dir: 1 | -1) => {
            const ladder = FONT_PT_CHOICES
            if (dir === 1)
                return (
                    ladder.find((p) => p > fontPt) ?? Math.min(fontPt + 1, 409)
                )
            return (
                [...ladder].reverse().find((p) => p < fontPt) ??
                Math.max(fontPt - 1, 1)
            )
        }

        const applyFontSize = (pt: number) => {
            if (!selectedData) return
            // Excel's own bounds; anything outside is a typo, not an intent.
            if (!Number.isFinite(pt) || pt < 1 || pt > 409) {
                setFontPtDraft(null)
                return
            }
            const rounded = Math.round(pt * 2) / 2 // Excel allows half points
            setFontPt(rounded)
            setFontPtDraft(null)
            DATA_SERVICE.handleTransactionAndAdjustRowHeights(
                tx(
                    generateFontPayload(
                        DATA_SERVICE.getCurrentSheetIdx(),
                        selectedData,
                        {size: rounded}
                    ),
                    true
                )
            )
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
                tx(payloads, true)
            )
        }

        const onMergeOrSplitClick = () => {
            if (mergedOn === null) return
            if (!selectedData) return
            const cr = getSelectedCellRange(selectedData)
            if (!cr) return
            const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
            if (mergedOn) {
                return ops
                    .applyPayloads([
                        {
                            type: 'splitMergedCells',
                            value: new SplitMergedCellsBuilder()
                                .sheetIdx(sheetIdx)
                                .row(cr.startRow)
                                .col(cr.startCol)
                                .build(),
                        },
                    ])
                    .then(() => setMergedOn(false))
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
            ops.applyPayloads(payloads).then(() => setMergedOn(true))
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
        async function onExportCsv(): Promise<void> {
            const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
            const csv = await DATA_SERVICE.exportSheetToCsv(sheetIdx)
            // Prepend a UTF-8 BOM so Excel opens non-ASCII text correctly.
            const blob = new Blob(['﻿' + csv], {
                type: 'text/csv;charset=utf-8',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${bookName || 'Untitled'}.csv`
            a.click()
            URL.revokeObjectURL(url)
        }
        /**
         * Save with feedback. Serialising a workbook takes long enough to
         * notice, and the File-menu item gave no sign it was working — so the
         * toolbar button disables itself for the duration.
         */
        const saveWorkbook = async () => {
            if (saving) return
            setSaving(true)
            try {
                await onSave()
            } finally {
                setSaving(false)
            }
        }

        async function onSave(): Promise<void> {
            const persistentData = BLOCK_MANAGER.getPersistentData([])
            const envelope = JSON.stringify({
                version: 1,
                blockManager: persistentData,
                craftInteractions: getPersistentInteractions(),
                craftStates: getPersistentCraftStates(),
            })
            const saveResult = await DATA_SERVICE.getWorkbook().save({
                appData: envelope,
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
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{display: 'none'}}
                    onChange={onFileChange}
                />

                {/* One chrome row: identity, the File menu and the tab
                    strip. These were three rows, but ours had little to put in
                    them — a 40px line holding only a document name, and a 30px
                    line holding only five tabs, left two bands of empty space.
                    Merged, the row is full and the chrome is ~30px shorter. */}
                <div className={styles.topRow}>
                    <img
                        src="/logo.png"
                        alt="LogiSheets"
                        className={styles.logo}
                    />
                    <TextField
                        className={styles.docName}
                        value={bookName}
                        onChange={(e) => setBookName(e.target.value)}
                        variant="standard"
                        size="small"
                        placeholder="Untitled"
                    />
                    <Divider
                        orientation="vertical"
                        flexItem
                        className={styles.divider}
                    />
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
                            <SaveIcon
                                fontSize="small"
                                style={{marginRight: 8}}
                            />
                            Save
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                closeFileMenu()
                                onExportCsv()
                            }}
                            sx={{fontSize: 12}}
                        >
                            <DownloadIcon
                                fontSize="small"
                                style={{marginRight: 8}}
                            />
                            Export as CSV
                        </MenuItem>
                    </Menu>
                    <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        sx={{
                            minHeight: 0,
                            '& .MuiTab-root': {
                                minHeight: 0,
                                minWidth: 0,
                                padding: '4px 10px',
                                fontSize: 12,
                                textTransform: 'none',
                            },
                        }}
                    >
                        <Tab value="home" label="Home" />
                        <Tab value="insert" label="Insert" />
                        <Tab value="formulas" label="Formulas" />
                        <Tab value="data" label="Data" />
                        <Tab value="view" label="View" />
                        {/* The five above are the tabs every spreadsheet has;
                            this one is what only this spreadsheet has. It is
                            set apart by a rule and carries the accent even
                            when unselected — enough to draw the eye without
                            turning a tab strip into a badge. */}
                        <Tab
                            value="advanced"
                            label="Advanced"
                            className={styles.tabAdvanced}
                        />
                    </Tabs>
                    <span className={styles.grow} />
                    {/* Document-level actions. Saving lives here rather than
                        only in the File menu because it is the most-used one,
                        and temp mode announces itself here because it is a
                        mode: entering it from the Advanced tab and then
                        switching to Home used to leave no sign that edits were
                        going to a scratch branch. */}
                    {globalStore.isTempMode ? (
                        <Tooltip title="Editing on a scratch branch — click to commit it">
                            <button
                                type="button"
                                className={styles.tempChip}
                                onClick={onToggleTempMode}
                            >
                                <ScienceIcon fontSize="small" />
                                Temp mode
                            </button>
                        </Tooltip>
                    ) : null}
                    <Tooltip
                        title={
                            globalStore.showComments
                                ? 'Hide comments'
                                : 'Show comments'
                        }
                    >
                        <IconButton
                            size="small"
                            aria-label="Toggle comments"
                            color={
                                globalStore.showComments ? 'primary' : 'default'
                            }
                            onClick={() =>
                                globalStore.setShowComments(
                                    !globalStore.showComments
                                )
                            }
                        >
                            <ChatBubbleOutlineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Download as .xlsx">
                        <span>
                            <button
                                type="button"
                                className={styles.saveBtn}
                                aria-label="Save workbook"
                                disabled={saving}
                                onClick={saveWorkbook}
                            >
                                <SaveIcon fontSize="small" />
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </span>
                    </Tooltip>
                    <GithubStar />
                </div>

                {/* Row 3 — the active tab's controls. */}
                <div className={styles.ribbon}>
                    {activeTab === 'view' ? (
                        <>
                            <div className={styles.viewSection}>
                                {[
                                    {
                                        label: 'Split view (2nd view)',
                                        checked: globalStore.splitView,
                                        onChange: (v: boolean) =>
                                            globalStore.setSplitView(v),
                                    },
                                    {
                                        label: 'Diff layer',
                                        checked: globalStore.diffLayerEnabled,
                                        onChange: (v: boolean) =>
                                            globalStore.setDiffLayerEnabled(v),
                                    },
                                    {
                                        label: 'Block overlays always visible',
                                        checked:
                                            globalStore.alwaysShowBlockInfo,
                                        onChange: (v: boolean) =>
                                            globalStore.setAlwaysShowBlockInfo(
                                                v
                                            ),
                                    },
                                    {
                                        label: 'Show gridlines',
                                        checked: globalStore.showGridlines,
                                        onChange: (v: boolean) => {
                                            globalStore.setShowGridlines(v)
                                            engine.setShowGridLines(v)
                                        },
                                    },
                                    {
                                        label: 'Show comments',
                                        checked: globalStore.showComments,
                                        onChange: (v: boolean) =>
                                            globalStore.setShowComments(v),
                                    },
                                ].map((t) => (
                                    <div
                                        className={styles.toggleItem}
                                        key={t.label}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={t.checked}
                                                    onChange={(e) =>
                                                        t.onChange(
                                                            e.target.checked
                                                        )
                                                    }
                                                />
                                            }
                                            label={t.label}
                                            labelPlacement="start"
                                            sx={{
                                                m: 0,
                                                gap: '6px',
                                                '& .MuiFormControlLabel-label':
                                                    {
                                                        fontSize: 12,
                                                    },
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Zoom */}
                            <div className={styles.section}>
                                <Tooltip title="Zoom out">
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label="Zoom out"
                                            onClick={() => engine.zoomOut()}
                                        >
                                            <ZoomOutIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <span className={styles.zoomLabel}>
                                    {zoomPct}%
                                </span>
                                <Tooltip title="Zoom in">
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label="Zoom in"
                                            onClick={() => engine.zoomIn()}
                                        >
                                            <ZoomInIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <ToolButton
                                    label="Reset"
                                    tip="Reset zoom to 100%"
                                    icon={
                                        <CenterFocusStrongIcon fontSize="small" />
                                    }
                                    onClick={() => engine.resetZoom()}
                                />
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Cell values */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Values"
                                    tip="Show or hide cell contents"
                                    icon={
                                        <VisibilityOutlinedIcon fontSize="small" />
                                    }
                                    onClick={() => {
                                        const v = !showValues
                                        engine.setShowCellValues(v)
                                        setShowValues(v)
                                    }}
                                />
                            </div>
                        </>
                    ) : null}
                    {activeTab === 'insert' ? (
                        <>
                            <div className={styles.section}>
                                {createBlockButton}
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Insert / create */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Chart"
                                    tip="Insert a chart from the selection"
                                    icon={<BarChartIcon fontSize="small" />}
                                    onClick={(e) =>
                                        setChartAnchor(e.currentTarget)
                                    }
                                    disabled={!hasSelectedData}
                                />
                                <Menu
                                    anchorEl={chartAnchor}
                                    open={Boolean(chartAnchor)}
                                    onClose={() => setChartAnchor(null)}
                                >
                                    {CHART_TYPES.map((t) => (
                                        <MenuItem
                                            key={t.value}
                                            onClick={() => {
                                                setChartAnchor(null)
                                                engine.insertChart(t.value)
                                            }}
                                        >
                                            {t.label}
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Objects */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Image"
                                    tip="Insert an image at the selection"
                                    icon={
                                        <ImageOutlinedIcon fontSize="small" />
                                    }
                                    onClick={insertImage}
                                    disabled={!hasSelectedData}
                                />
                                <ToolButton
                                    label="Comment"
                                    tip="Add a comment to this cell"
                                    icon={
                                        <AddCommentOutlinedIcon fontSize="small" />
                                    }
                                    onClick={addComment}
                                    disabled={!hasSelectedData}
                                />
                            </div>
                        </>
                    ) : null}
                    {activeTab === 'formulas' ? (
                        <>
                            {/* Function library */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="AutoSum"
                                    tip="Sum the numbers above or to the left"
                                    icon={<FunctionsIcon fontSize="small" />}
                                    onClick={autoSum}
                                    disabled={!hasSelectedData}
                                />
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Formula auditing */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Precedents"
                                    tip="Show which cells this formula reads"
                                    icon={
                                        <NorthEastOutlinedIcon fontSize="small" />
                                    }
                                    onClick={() => traceCell('precedents')}
                                    disabled={!hasSelectedData}
                                />
                                <ToolButton
                                    label="Dependents"
                                    tip="Show which cells read this one"
                                    icon={
                                        <SouthWestOutlinedIcon fontSize="small" />
                                    }
                                    onClick={() => traceCell('dependents')}
                                    disabled={!hasSelectedData}
                                />
                                <ToolButton
                                    label="Clear arrows"
                                    tip="Clear the trace arrows"
                                    icon={
                                        <LayersClearOutlinedIcon fontSize="small" />
                                    }
                                    onClick={() => globalStore.clearTrace()}
                                    disabled={!globalStore.traceResult}
                                />
                            </div>
                        </>
                    ) : null}
                    {activeTab === 'advanced' ? (
                        <>
                            {/* What this spreadsheet has that others do not:
                                structured blocks, crafts, the assistant, and
                                the uncommitted "temp" branch. Grouped together
                                so the product's own concepts are one place
                                rather than scattered through Excel's tabs. */}
                            <div className={styles.section}>
                                {createBlockButton}
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            <div className={styles.section}>
                                {onToggleWatson ? (
                                    <ToolButton
                                        label="Watson"
                                        tip="Ask Watson"
                                        icon={
                                            <AutoAwesomeIcon fontSize="small" />
                                        }
                                        onClick={onToggleWatson}
                                        active={watsonActive}
                                    />
                                ) : null}
                                {onToggleCraft ? (
                                    <ToolButton
                                        label="Crafts"
                                        tip="Open the craft panel"
                                        icon={
                                            <ExtensionIcon fontSize="small" />
                                        }
                                        onClick={onToggleCraft}
                                        active={craftActive}
                                    />
                                ) : null}
                                <ToolButton
                                    label="Temp mode"
                                    tip={
                                        globalStore.isTempMode
                                            ? 'Exit temp mode (commit the branch)'
                                            : 'Enter temp mode (edit on a scratch branch)'
                                    }
                                    icon={<ScienceIcon fontSize="small" />}
                                    onClick={onToggleTempMode}
                                    active={globalStore.isTempMode}
                                />
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Blocks, crafts and Watson are this product's own
                                vocabulary — nothing carried over from Excel
                                tells you what they are. The tab that gathers
                                them is the one place someone will look, so it
                                is where the way out to the docs belongs. */}
                            <div className={styles.section}>
                                <Tooltip title="What are blocks, crafts and Watson? — opens the docs">
                                    <a
                                        className={styles.helpLink}
                                        // `.html` is not optional: the docs site does not set VitePress'
                                        // `cleanUrls`, so the extensionless path 404s.
                                        href="https://docs.logisheets.com/introduction.html"
                                        target="_blank"
                                        rel="noreferrer noopener"
                                    >
                                        <HelpOutlineIcon fontSize="small" />
                                        Help
                                    </a>
                                </Tooltip>
                            </div>
                        </>
                    ) : null}
                    {activeTab === 'data' ? (
                        <>
                            {/* Rules */}
                            <div className={styles.section}>
                                <Button
                                    size="small"
                                    startIcon={<PaletteOutlinedIcon />}
                                    disabled={!hasSelectedData}
                                    onClick={openConditionalFormatting}
                                >
                                    Conditional formatting…
                                </Button>
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Find */}
                            <div className={styles.section}>
                                <Button
                                    size="small"
                                    startIcon={<SearchIcon />}
                                    onClick={() => globalStore.requestFind()}
                                >
                                    Find & replace
                                </Button>
                            </div>
                        </>
                    ) : null}
                    {activeTab === 'home' ? (
                        <>
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

                            {/* Clipboard */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Painter"
                                    tip="Copy formatting to another range"
                                    icon={<FormatPaintIcon fontSize="small" />}
                                    onClick={onFormatPainter}
                                    disabled={!hasSelectedData}
                                    active={!!formatBrushOn}
                                />
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Font */}
                            <div className={styles.section}>
                                <Select
                                    size="small"
                                    value={fontName}
                                    onChange={onFontNameChange}
                                    disabled={!hasSelectedData}
                                    sx={{
                                        minWidth: 120,
                                        maxHeight: 30,
                                        fontSize: 12,
                                    }}
                                >
                                    {(FONT_FAMILIES.includes(fontName)
                                        ? FONT_FAMILIES
                                        : [fontName, ...FONT_FAMILIES]
                                    ).map((f) => (
                                        <MenuItem
                                            key={f}
                                            value={f}
                                            sx={{fontSize: 12, fontFamily: f}}
                                        >
                                            {f}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {/* Point size: an editable box with a dropdown, as in Excel and
                                    Sheets. The stepper buttons that used to be here could only walk the
                                    size one point at a time, so setting 24 took fourteen clicks. */}
                                <div
                                    className={styles.fontSize}
                                    ref={fontSizeBoxRef}
                                >
                                    <input
                                        aria-label="Font size"
                                        value={fontPtDraft ?? String(fontPt)}
                                        disabled={!hasSelectedData}
                                        onChange={(e) =>
                                            setFontPtDraft(e.target.value)
                                        }
                                        onBlur={() => {
                                            if (fontPtDraft !== null)
                                                applyFontSize(
                                                    Number(fontPtDraft)
                                                )
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter')
                                                e.currentTarget.blur()
                                            // Escape abandons the edit and shows the real size again.
                                            if (e.key === 'Escape') {
                                                setFontPtDraft(null)
                                                e.currentTarget.blur()
                                            }
                                            // The old stepper behaviour, on the keys that mean it.
                                            if (e.key === 'ArrowUp') {
                                                e.preventDefault()
                                                applyFontSize(fontPt + 1)
                                            }
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault()
                                                applyFontSize(fontPt - 1)
                                            }
                                        }}
                                    />
                                    <Tooltip title="Font size">
                                        <span>
                                            <IconButton
                                                className={styles.fontSizeCaret}
                                                size="small"
                                                aria-label="Choose font size"
                                                disabled={!hasSelectedData}
                                                onClick={() =>
                                                    setFontSizeAnchor(
                                                        fontSizeBoxRef.current
                                                    )
                                                }
                                            >
                                                <ArrowDropDownIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    {/* Anchored to the whole box, not to the
                                        caret: hanging a menu off a 16px button
                                        left it visibly out of line with the
                                        field it belongs to. */}
                                    <Menu
                                        anchorEl={fontSizeAnchor}
                                        open={Boolean(fontSizeAnchor)}
                                        onClose={() => setFontSizeAnchor(null)}
                                        anchorOrigin={{
                                            vertical: 'bottom',
                                            horizontal: 'left',
                                        }}
                                        transformOrigin={{
                                            vertical: 'top',
                                            horizontal: 'left',
                                        }}
                                        slotProps={{
                                            paper: {
                                                sx: {
                                                    minWidth:
                                                        fontSizeAnchor?.offsetWidth,
                                                    maxHeight: 320,
                                                },
                                            },
                                        }}
                                    >
                                        {FONT_PT_CHOICES.map((pt) => (
                                            <MenuItem
                                                key={pt}
                                                selected={pt === fontPt}
                                                sx={{
                                                    fontSize: 12,
                                                    minHeight: 28,
                                                }}
                                                onClick={() => {
                                                    setFontSizeAnchor(null)
                                                    applyFontSize(pt)
                                                }}
                                            >
                                                {pt}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                </div>
                                <Tooltip title="Increase font size">
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label="Increase font size"
                                            disabled={!hasSelectedData}
                                            onClick={() =>
                                                applyFontSize(nextFontPt(1))
                                            }
                                        >
                                            <TextIncreaseIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title="Decrease font size">
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label="Decrease font size"
                                            disabled={!hasSelectedData}
                                            onClick={() =>
                                                applyFontSize(nextFontPt(-1))
                                            }
                                        >
                                            <TextDecreaseIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Font style */}
                            <div className={styles.section}>
                                <Tooltip title="Bold">
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label="Bold"
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
                                            aria-label="Italic"
                                            onClick={onToggleItalic}
                                            color={
                                                italic ? 'primary' : 'default'
                                            }
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
                                            aria-label="Underline"
                                            onClick={onToggleUnderline}
                                            color={
                                                underline
                                                    ? 'primary'
                                                    : 'default'
                                            }
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
                                            aria-label="Strikethrough"
                                            onClick={onToggleStrike}
                                            color={
                                                strike ? 'primary' : 'default'
                                            }
                                            disabled={!hasSelectedData}
                                        >
                                            <StrikethroughS
                                                fontSize="small"
                                                style={{
                                                    textDecoration:
                                                        'line-through',
                                                }}
                                            />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Colour and borders */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Text"
                                    tip="Text colour"
                                    icon={
                                        <FormatColorTextIcon fontSize="small" />
                                    }
                                    onClick={() => setColorPicking('font')}
                                    disabled={!hasSelectedData}
                                />
                                <ToolButton
                                    label="Fill"
                                    tip="Cell fill colour"
                                    icon={
                                        <FormatColorFillIcon fontSize="small" />
                                    }
                                    onClick={() => setColorPicking('fill')}
                                    disabled={!hasSelectedData}
                                />
                                <ToolButton
                                    label="Borders"
                                    tip="Cell borders"
                                    icon={<BorderIcon fontSize="small" />}
                                    onClick={() => setBorderOpen(true)}
                                    disabled={!hasSelectedData}
                                />
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Alignment */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Align"
                                    tip="Alignment"
                                    icon={
                                        <ArrowDropDownIcon fontSize="small" />
                                    }
                                    onClick={onAlignClick}
                                    disabled={!hasSelectedData}
                                />
                                <ToolButton
                                    label="Wrap"
                                    tip="Wrap text in the cell"
                                    icon={<WrapTextIcon fontSize="small" />}
                                    onClick={onToggleWrapText}
                                    disabled={!hasSelectedData}
                                    active={wrapText}
                                />
                                <ToolButton
                                    label="Merge"
                                    tip="Merge or split the selected cells"
                                    icon={<MergeCellsIcon />}
                                    onClick={onMergeOrSplitClick}
                                    disabled={mergedOn === null}
                                    active={!!mergedOn}
                                />
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
                                    sx={{
                                        minWidth: 100,
                                        maxHeight: 30,
                                        fontSize: 12,
                                    }}
                                >
                                    <MenuItem
                                        value="general"
                                        sx={{fontSize: 12}}
                                    >
                                        General
                                    </MenuItem>
                                    <MenuItem
                                        value="number"
                                        sx={{fontSize: 12}}
                                    >
                                        Number
                                    </MenuItem>
                                    <MenuItem
                                        value="fraction"
                                        sx={{fontSize: 12}}
                                    >
                                        Fraction
                                    </MenuItem>
                                    <MenuItem
                                        value="percent"
                                        sx={{fontSize: 12}}
                                    >
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
                            {/* Cells. The insert button carries the noun; its
                                delete twin is a bare minus beside it, which
                                reads as "one fewer of these" without spending
                                a second label on the same word. */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Rows"
                                    tip="Insert rows above the selection"
                                    icon={
                                        <TableRowsOutlinedIcon fontSize="small" />
                                    }
                                    onClick={() => lineOp('row', 'insert')}
                                    disabled={!hasSelectedData}
                                />
                                <Tooltip title="Delete the selected rows">
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label="Delete rows"
                                            disabled={!hasSelectedData}
                                            onClick={() =>
                                                lineOp('row', 'delete')
                                            }
                                        >
                                            <RemoveCircleOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <ToolButton
                                    label="Cols"
                                    tip="Insert columns before the selection"
                                    icon={
                                        <ViewWeekOutlinedIcon fontSize="small" />
                                    }
                                    onClick={() => lineOp('col', 'insert')}
                                    disabled={!hasSelectedData}
                                />
                                <Tooltip title="Delete the selected columns">
                                    <span>
                                        <IconButton
                                            size="small"
                                            aria-label="Delete columns"
                                            disabled={!hasSelectedData}
                                            onClick={() =>
                                                lineOp('col', 'delete')
                                            }
                                        >
                                            <RemoveCircleOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </div>
                            <Divider
                                orientation="vertical"
                                flexItem
                                className={styles.divider}
                            />
                            {/* Editing */}
                            <div className={styles.section}>
                                <ToolButton
                                    label="Clear"
                                    tip="Clear the contents, keeping the formatting"
                                    icon={<BackspaceIcon fontSize="small" />}
                                    onClick={clearCells}
                                    disabled={!hasSelectedData}
                                />
                                <ToolButton
                                    label="Find"
                                    tip="Find and replace"
                                    icon={<SearchIcon fontSize="small" />}
                                    onClick={() => globalStore.requestFind()}
                                />
                            </div>
                        </>
                    ) : null}
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

                {/* The dialog is content, not a modal of its own — the cell
                    context menu wraps it the same way. */}
                <Dialog
                    open={!!cfRange}
                    onClose={() => setCfRange(null)}
                    disableScrollLock
                    disableAutoFocus
                    disableEnforceFocus
                    disableRestoreFocus
                    container={document.body}
                    PaperProps={{sx: {zIndex: 2000, p: 0}}}
                >
                    {cfRange && (
                        <ConditionalFormattingDialog
                            dataSvc={DATA_SERVICE}
                            sheetIdx={cfRange.sheetIdx}
                            range={cfRange}
                            onClose={() => setCfRange(null)}
                        />
                    )}
                </Dialog>

                {composerOpen && (
                    <BlockComposerComponent
                        selectedData={selectedData}
                        close={() => setComposerOpen(false)}
                    />
                )}
            </div>
        )
    }
)
