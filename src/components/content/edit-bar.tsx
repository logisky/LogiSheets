import {
    buildSelectedDataFromCell,
    getFirstCell,
    getSelectedCellRange,
    getSelectedLines,
    SelectedData,
    SelectedLines,
} from '@/components/canvas'
import {toA1notation, parseA1notation} from '@/core'
import {CellInputBuilder, Payload, Transaction} from 'logisheets-web'
import {FC, useEffect, useState} from 'react'
import styles from './edit-bar.module.scss'
import {useInjection} from '@/core/ioc/provider'
import {DataService} from '@/core/data'
import {TYPES} from '@/core/ioc/types'
import {isErrorMessage} from 'packages/web/src/api/utils'
export interface EditBarProps {
    selectedData: SelectedData
    selectedData$: (e: SelectedData) => void
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedData,
    selectedData$,
}) => {
    const dataSvc = useInjection<DataService>(TYPES.Data)
    const [coordinate, setCoordinate] = useState('')
    const [formula, setFormula] = useState('')
    const [isEditing, setIsEditing] = useState(false)

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

    const onFormulaBarClick = () => {
        // If user is trying to modify the formula when multiple cells are selected,
        // focus on the first cell
        const cell = getFirstCell(selectedData)
        selectedData$(buildSelectedDataFromCell(cell.r, cell.c, 'none'))
    }

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
            />
            <div className={styles.middle} />
            <input
                className={styles.formula}
                onChange={(e) => formulaTextChange(e.target.value)}
                onClick={() => onFormulaBarClick()}
                value={formula}
            />
        </div>
    )
}
