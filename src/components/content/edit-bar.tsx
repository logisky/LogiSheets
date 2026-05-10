import {
    buildSelectedDataFromCell,
    getSelectedCellRange,
} from 'logisheets-engine'
import {Cell, ErrorMessage} from 'logisheets-engine'
import {toA1notation, parseA1notation} from '@/core'
import {
    SelectedData,
    getFirstCell,
    CellInputBuilder,
    Payload,
} from 'logisheets-engine'
import {tx} from '@/core/transaction'
import {FC, useEffect, useState, useRef, useCallback, useMemo} from 'react'
import styles from './edit-bar.module.scss'
import {useEngine} from '@/core/engine/provider'
import {isErrorMessage} from 'logisheets-engine'
import {TransformOutlined} from '@mui/icons-material'
import {IconButton, Tooltip} from '@mui/material'
import {
    FormulaEditor,
    FormulaEditorRef,
    FormulaDisplayInfo,
    FormulaFunction,
} from '@logisheets/formula-editor'
import {getAllFormulas} from '@/core/snippet'

export interface EditBarProps {
    selectedData: SelectedData
    selectedData$: (e: SelectedData) => void
    selectedDataContentChanged: object
}

// Convert LogiSheets formula snippets into the FormulaFunction shape the
// editor's autocomplete expects. Cached because snippets are static.
let cachedFormulaFunctions: FormulaFunction[] | null = null
function getFormulaFunctions(): FormulaFunction[] {
    if (!cachedFormulaFunctions) {
        cachedFormulaFunctions = getAllFormulas().map((s) => ({
            name: s.name,
            description: s.description,
            args: s.args.map((a) => ({
                argName: a.argName,
                description: a.description,
                startRepeated: a.startRepeated,
            })),
            argCount: s.argCount,
        }))
    }
    return cachedFormulaFunctions
}

// Build the editor display string from a Cell. Formulas keep their leading
// '=' so the editor's tokenizer treats them as formulas, and so the same
// string can be committed back via CellInput unchanged.
function cellToDisplayText(c: Cell): string {
    const f = c.getFormula()
    return f ? `=${f}` : c.getText()
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedData,
    selectedData$,
    selectedDataContentChanged,
}) => {
    const engine = useEngine()
    const dataSvc = engine.getDataService()
    const [coordinate, setCoordinate] = useState('')
    // `formulaText` is the editor's source-of-truth string and includes the
    // leading '=' for formulas. `rawValue` is the cell's display text used
    // when the toggle is off.
    const [formulaText, setFormulaText] = useState('')
    const [rawValue, setRawValue] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [showFormula, setShowFormula] = useState(true)
    const [sheetName, setSheetName] = useState('')
    const editorRef = useRef<FormulaEditorRef>(null)

    const formulaFunctions = useMemo(() => getFormulaFunctions(), [])
    // Set when Escape is pressed so the synthetic blur fired by refocusing
    // the grid doesn't accidentally commit. Reset inside commitFormula on
    // its first guarded call.
    const cancellingRef = useRef(false)

    useEffect(() => {
        const selectedCell = getSelectedCellRange(selectedData)
        if (!selectedCell) return
        const {startRow: row, startCol: col} = selectedCell
        dataSvc
            .getCellInfo(dataSvc.getCurrentSheetIdx(), row, col)
            .then((c: Cell | ErrorMessage) => {
                if (isErrorMessage(c)) return
                setFormulaText(cellToDisplayText(c))
                setRawValue(c.getText())
            })
    }, [selectedDataContentChanged, dataSvc])

    useEffect(() => {
        if (isEditing) return
        const selectedCell = getSelectedCellRange(selectedData)
        if (!selectedCell) return
        const {startRow: row, startCol: col} = selectedCell
        const notation = toA1notation(col)
        setCoordinate(`${notation}${row + 1}`)
        dataSvc
            .getCellInfo(dataSvc.getCurrentSheetIdx(), row, col)
            .then((c: Cell | ErrorMessage) => {
                if (isErrorMessage(c)) return
                setFormulaText(cellToDisplayText(c))
                setRawValue(c.getText())
            })
        // Look up the current sheet name for the editor's cell-ref colorer
        // (it uses this to decide which references are local vs. cross-sheet).
        dataSvc
            .getWorkbook()
            .getSheetNameByIdx(dataSvc.getCurrentSheetIdx())
            .then((name) => {
                if (!isErrorMessage(name)) setSheetName(name)
            })
    }, [selectedData, isEditing, dataSvc])

    // Backend tokenization: the editor calls this on every change to get
    // syntax highlighting + cell-ref info.
    const getDisplayUnits = useCallback(
        async (formula: string): Promise<FormulaDisplayInfo | undefined> => {
            const result = await dataSvc
                .getWorkbook()
                .getDisplayUnitsOfFormula(formula)
            if (isErrorMessage(result)) return undefined
            return result
        },
        [dataSvc]
    )

    const sendCellInput = useCallback(
        (newText: string) => {
            const cell = getFirstCell(selectedData)
            const payload: Payload = {
                type: 'cellInput',
                value: new CellInputBuilder()
                    .sheetIdx(dataSvc.getCurrentSheetIdx())
                    .row(cell.y)
                    .col(cell.x)
                    .content(newText)
                    .build(),
            }
            dataSvc.handleTransaction(tx([payload], true))
        },
        [selectedData, dataSvc]
    )

    const refocusGrid = () => {
        const cell = getFirstCell(selectedData)
        selectedData$(buildSelectedDataFromCell(cell.y, cell.x, 'editbar'))
        requestAnimationFrame(() => {
            const el = document.querySelector(
                '.host canvas'
            ) as HTMLCanvasElement | null
            el?.focus({preventScroll: true})
        })
    }

    const commitFormula = (value: string) => {
        if (cancellingRef.current) {
            cancellingRef.current = false
            return
        }
        // Mirror the previous behavior: don't fire CellInput if the buffer is
        // empty (e.g., user opened the bar but typed nothing).
        if (value !== '') sendCellInput(value)
        setIsEditing(false)
        refocusGrid()
    }

    const cancelEdit = () => {
        cancellingRef.current = true
        setIsEditing(false)
        const selectedCell = getSelectedCellRange(selectedData)
        if (!selectedCell) {
            refocusGrid()
            return
        }
        const {startRow: row, startCol: col} = selectedCell
        dataSvc
            .getCellInfo(dataSvc.getCurrentSheetIdx(), row, col)
            .then((c) => {
                if (isErrorMessage(c)) return
                setFormulaText(cellToDisplayText(c))
            })
        refocusGrid()
    }

    const locationChange = (newText: string) => {
        const result = parseA1notation(newText)
        setIsEditing(false)
        if (!result) {
            const cell = getFirstCell(selectedData)
            setCoordinate(`${toA1notation(cell.x)}${cell.y + 1}`)
            return
        }
        selectedData$(
            buildSelectedDataFromCell(result.rs, result.cs, 'editbar')
        )
    }

    const onToggleShowFormularOrValue = () => {
        setShowFormula(!showFormula)
    }

    const hasSelectedData = selectedData && selectedData.data !== undefined

    return (
        <div className={styles.host}>
            <input
                className={styles.a1notation}
                value={coordinate}
                onChange={(e) => {
                    setCoordinate(e.target.value)
                    setIsEditing(true)
                }}
                onBlur={(e) => locationChange(e.target.value)}
                disabled={!hasSelectedData}
            />
            <div className={styles.middle} />
            <Tooltip title="Show formula or value">
                <IconButton
                    size="small"
                    sx={{p: 0.4}}
                    color={showFormula ? 'primary' : 'default'}
                    onClick={onToggleShowFormularOrValue}
                    disabled={!hasSelectedData}
                >
                    <TransformOutlined fontSize="small" />
                </IconButton>
            </Tooltip>
            {!hasSelectedData ? (
                // No selection → degrade to a plain disabled <input>.
                // FormulaEditor's CodeMirror DOM stays focusable even with
                // `readOnly: true`, so swapping the slot is the simplest way
                // to actually block clicks (matches the pre-refactor UX).
                <input
                    className={styles.formula}
                    value=""
                    disabled
                    readOnly
                />
            ) : showFormula ? (
                <div className={styles.formula}>
                    <FormulaEditor
                        ref={editorRef}
                        value={formulaText}
                        onChange={(v) => {
                            setIsEditing(true)
                            setFormulaText(v)
                        }}
                        // Enter just blurs the editor; the blur handler is
                        // the single commit path. This way Enter on the bar
                        // = "commit + return to grid", and the *next* Enter
                        // (now on the canvas) advances the selection down,
                        // matching the user's expected flow. Wiring commit
                        // to both onSubmit and onBlur would fire CellInput
                        // twice on every Enter.
                        onSubmit={() => editorRef.current?.blur()}
                        onBlur={commitFormula}
                        onCancel={cancelEdit}
                        getDisplayUnits={getDisplayUnits}
                        formulaFunctions={formulaFunctions}
                        sheetName={sheetName}
                        config={{
                            fontSize: 12,
                            lineHeight: 1.2,
                            placeholder: '',
                            showBorder: false,
                        }}
                        style={{
                            // Override the editor's default
                            // `minHeight = fontSize*lineHeight + 8` so it
                            // sits inside the 24px edit-bar without pushing
                            // the row taller.
                            minHeight: 0,
                            height: '100%',
                            width: '100%',
                        }}
                    />
                </div>
            ) : (
                <input className={styles.formula} value={rawValue} readOnly />
            )}
        </div>
    )
}
