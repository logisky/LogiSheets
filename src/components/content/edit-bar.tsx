import {
    buildSelectedDataFromCell,
    getSelectedCellRange,
} from 'logisheets-engine'
import {Cell, ErrorMessage} from 'logisheets-engine'
import {toA1notation, parseA1notation} from 'logisheets-core'
import {
    SelectedData,
    getFirstCell,
} from 'logisheets-engine'
import {useEffect, useState, useRef, useCallback, useMemo} from 'react'
import {observer} from 'mobx-react-lite'
import {globalStore} from '@/store'
import styles from './edit-bar.module.scss'
import {useEngine, useOps} from '@/core/engine/provider'
import {isErrorMessage} from 'logisheets-engine'
import {TransformOutlined, RuleOutlined} from '@mui/icons-material'
import {IconButton, Tooltip} from '@mui/material'
import {callerRegistry} from 'logisheets-core'
import {isCellUserEditableSync} from '@/core/permissions/field-editable'
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

export const EditBarComponent = observer(function EditBarComponent({
    selectedData: propSelectedData,
    selectedData$: propSelectedData$,
    selectedDataContentChanged,
}: EditBarProps) {
    const engine = useEngine()
    const dataSvc = engine.getDataService()
    const ops = useOps()
    // Target the active view: the edit bar reads/writes the view the user
    // last focused (highlighted), not always the main one. Falls back to the
    // props (main view) before any view has published a context.
    const av = globalStore.activeViewContext
    const selectedData = av?.selectedData ?? propSelectedData
    const sheetIdx = av?.sheetIdx ?? dataSvc.getCurrentSheetIdx()
    const selectedData$ = av?.setSelection ?? propSelectedData$
    const [coordinate, setCoordinate] = useState('')
    // `formulaText` is the editor's source-of-truth string and includes the
    // leading '=' for formulas. `rawValue` is the cell's display text used
    // when the toggle is off.
    const [formulaText, setFormulaText] = useState('')
    const [rawValue, setRawValue] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [showFormula, setShowFormula] = useState(true)
    // `showValidation` overrides the value/formula toggle when true: the
    // input box displays the block field's validation formula (the
    // ephemeral shadow-cell formula used to drive the warning marker).
    // Read-only — there's no way to edit a field's validation from here.
    const [showValidation, setShowValidation] = useState(false)
    const [validationText, setValidationText] = useState('')
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
            .getCellInfo(sheetIdx, row, col)
            .then((c: Cell | ErrorMessage) => {
                if (isErrorMessage(c)) return
                setFormulaText(cellToDisplayText(c))
                setRawValue(c.getText())
            })
    }, [selectedDataContentChanged, dataSvc, sheetIdx, selectedData])

    // Look up the validation formula on the field bound at (sheetIdx, row, col)
    // if any. Returns '' when the cell isn't a block cell, isn't bound, or
    // the field carries no validation.
    const lookupValidation = useCallback(
        async (row: number, col: number): Promise<string> => {
            try {
                const wb = dataSvc.getWorkbook()
                const cellId = await wb.getCellId({
                    sheetIdx,
                    rowIdx: row,
                    colIdx: col,
                })
                if (isErrorMessage(cellId)) return ''
                if (cellId.cellId.type !== 'blockCell') return ''
                const bcid = cellId.cellId.value
                const renderId = callerRegistry.getFieldRenderId(
                    sheetIdx,
                    bcid.blockId,
                    bcid.row,
                    bcid.col
                )
                if (!renderId) return ''
                const info = engine.getBlockManager().fieldManager.get(renderId)
                if (!info) return ''
                // FieldInfo.type is a tagged union; validation only lives on
                // string / number / fieldRef / multiSelectRef variants.
                const t = info.type as {validation?: string}
                return t.validation ?? ''
            } catch {
                return ''
            }
        },
        [dataSvc, engine, sheetIdx]
    )

    useEffect(() => {
        if (isEditing) return
        const selectedCell = getSelectedCellRange(selectedData)
        if (!selectedCell) return
        const {startRow: row, startCol: col} = selectedCell
        const notation = toA1notation(col)
        setCoordinate(`${notation}${row + 1}`)
        dataSvc
            .getCellInfo(sheetIdx, row, col)
            .then((c: Cell | ErrorMessage) => {
                if (isErrorMessage(c)) return
                setFormulaText(cellToDisplayText(c))
                setRawValue(c.getText())
            })
        lookupValidation(row, col).then(setValidationText)
        // Look up the current sheet name for the editor's cell-ref colorer
        // (it uses this to decide which references are local vs. cross-sheet).
        dataSvc
            .getWorkbook()
            .getSheetNameByIdx(sheetIdx)
            .then((name) => {
                if (!isErrorMessage(name)) setSheetName(name)
            })
    }, [selectedData, isEditing, dataSvc, lookupValidation, sheetIdx])

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
            ops.inputCell(sheetIdx, cell.y, cell.x, newText)
        },
        [selectedData, ops, sheetIdx]
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
        if (value !== '') {
            // Guard: block cells whose field is declared
            // `userEditable: false` are not writable from the formula
            // bar either. Engine-side patch would reject anyway; this
            // failing fast here avoids a confusing silent commit
            // (and keeps the cell's previous value visible without a
            // round-trip).
            const cell = getFirstCell(selectedData)
            if (
                isCellUserEditableSync(
                    sheetIdx,
                    cell.y,
                    cell.x,
                    engine.getGrid()
                )
            ) {
                sendCellInput(value)
            }
        }
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
            .getCellInfo(sheetIdx, row, col)
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
            {/* Toggle: show the bound block field's validation formula
                (the shadow-cell expression that drives the warning marker).
                Read-only — purely for debugging. Disabled when no cell is
                selected OR when the selected cell has no validation. */}
            <Tooltip
                title={
                    validationText
                        ? 'Show validation formula'
                        : 'No validation on this cell'
                }
            >
                <span>
                    <IconButton
                        size="small"
                        sx={{p: 0.4}}
                        color={showValidation ? 'primary' : 'default'}
                        onClick={() => setShowValidation((v) => !v)}
                        disabled={!hasSelectedData || !validationText}
                    >
                        <RuleOutlined fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            {!hasSelectedData ? (
                <input className={styles.formula} value="" disabled readOnly />
            ) : showValidation ? (
                <input
                    className={styles.formula}
                    value={validationText}
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
})
