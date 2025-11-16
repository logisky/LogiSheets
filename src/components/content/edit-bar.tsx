import {
    buildSelectedDataFromCell,
    getFirstCell,
    getSelectedCellRange,
    SelectedData,
} from '@/components/canvas'
import {toA1notation, parseA1notation} from '@/core'
import {CellInputBuilder, Payload, Transaction} from 'logisheets-web'
import {FC, useEffect, useState, useRef, KeyboardEvent} from 'react'
import styles from './edit-bar.module.scss'
import {useInjection} from '@/core/ioc/provider'
import {DataServiceImpl as DataService} from '@/core/data'
import {TYPES} from '@/core/ioc/types'
import {isErrorMessage} from 'packages/web/src/api/utils'
import {CANVAS_ID} from '@/components/canvas/store'
export interface EditBarProps {
    selectedData: SelectedData
    selectedData$: (e: SelectedData) => void
    selectedDataContentChanged: object
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedData,
    selectedData$,
    selectedDataContentChanged,
}) => {
    const dataSvc = useInjection<DataService>(TYPES.Data)
    const [coordinate, setCoordinate] = useState('')
    const [formula, setFormula] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const formulaInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const selectedCell = getSelectedCellRange(selectedData)
        if (!selectedCell) return
        const {startRow: row, startCol: col} = selectedCell
        const cell = dataSvc.getCellInfo(dataSvc.getCurrentSheetIdx(), row, col)
        cell.then((c) => {
            if (isErrorMessage(c)) return
            setFormula(c.getFormula() || c.getText())
        })
    }, [selectedDataContentChanged])

    useEffect(() => {
        if (isEditing) return
        const selectedCell = getSelectedCellRange(selectedData)
        if (!selectedCell) return
        const {startRow: row, startCol: col} = selectedCell
        const notation = toA1notation(col)
        setCoordinate(`${notation}${row + 1}`)
        const cell = dataSvc.getCellInfo(dataSvc.getCurrentSheetIdx(), row, col)
        cell.then((c) => {
            if (isErrorMessage(c)) return
            setFormula(c.getFormula() || c.getText())
        })
    }, [selectedData, isEditing])

    const formulaTextChange = (newText: string) => {
        const cell = getFirstCell(selectedData)
        const payload: Payload = {
            type: 'cellInput',
            value: new CellInputBuilder()
                .sheetIdx(dataSvc.getCurrentSheetIdx())
                .row(cell.r)
                .col(cell.c)
                .content(newText)
                .build(),
        }
        dataSvc.handleTransaction(new Transaction([payload], true))
    }

    const locationChange = (newText: string) => {
        const result = parseA1notation(newText)
        setIsEditing(false)
        if (!result) {
            const cell = getFirstCell(selectedData)
            setCoordinate(`${toA1notation(cell.c)}${cell.r + 1}`)
            return
        }
        selectedData$(
            buildSelectedDataFromCell(result.rs, result.cs, 'editbar')
        )
    }

    const commitFormula = () => {
        if (!formula) return
        // commit buffered text when leaving the input or pressing Enter
        formulaTextChange(formula)
        setIsEditing(false)
        // refocus back to the grid by re-emitting the (first) cell selection
        const cell = getFirstCell(selectedData)
        selectedData$(buildSelectedDataFromCell(cell.r, cell.c, 'editbar'))
        // explicitly focus canvas in next frame to ensure focus returns
        requestAnimationFrame(() => {
            const el = document.getElementById(
                CANVAS_ID
            ) as HTMLCanvasElement | null
            el?.focus({preventScroll: true})
        })
    }

    const onFormulaKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            commitFormula()
            // ensure the input loses focus so grid can regain focus
            formulaInputRef.current?.blur()
        }
        if (e.key === 'Escape') {
            // cancel edits and restore current cell content
            setIsEditing(false)
            const selectedCell = getSelectedCellRange(selectedData)
            if (!selectedCell) return
            const {startRow: row, startCol: col} = selectedCell
            const cell = dataSvc.getCellInfo(
                dataSvc.getCurrentSheetIdx(),
                row,
                col
            )
            cell.then((c) => {
                if (isErrorMessage(c)) return
                setFormula(c.getFormula() || c.getText())
            })
            formulaInputRef.current?.blur()
            const cellPos = getFirstCell(selectedData)
            selectedData$(
                buildSelectedDataFromCell(cellPos.r, cellPos.c, 'editbar')
            )
            requestAnimationFrame(() => {
                const el = document.getElementById(
                    CANVAS_ID
                ) as HTMLCanvasElement | null
                el?.focus({preventScroll: true})
            })
        }
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
            <input
                className={styles.formula}
                ref={formulaInputRef}
                onChange={(e) => {
                    setIsEditing(true)
                    setFormula(e.target.value)
                }}
                onKeyDown={onFormulaKeyDown}
                onBlur={() => {
                    commitFormula()
                }}
                value={formula}
                disabled={!hasSelectedData}
            />
        </div>
    )
}
