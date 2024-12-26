import {SelectedCell} from '@/components/canvas'
import {toA1notation, parseA1notation} from '@/core'
import {CellInputBuilder, Transaction} from 'logisheets-web'
import {FC, useEffect, useState} from 'react'
import styles from './edit-bar.module.scss'
import {useInjection} from '@/core/ioc/provider'
import {DataService} from '@/core/data2'
import {TYPES} from '@/core/ioc/types'
import {isErrorMessage} from 'packages/web/src/api/utils'
export interface EditBarProps {
    selectedCell: SelectedCell
    selectedCell$: (e: SelectedCell) => void
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedCell,
    selectedCell$,
}) => {
    const dataSvc = useInjection<DataService>(TYPES.Data)
    const [coordinate, setCoordinate] = useState('')
    const [formula, setFormula] = useState('')
    useEffect(() => {
        const {row, col} = selectedCell
        const notation = toA1notation(selectedCell.col)
        setCoordinate(`${notation}${row + 1}`)
        const cell = dataSvc.getCellInfo(dataSvc.getCurrentSheetIdx(), row, col)
        cell.then((c) => {
            if (isErrorMessage(c)) return
            console.log(c)
            if (c.getFormula() === '') setFormula(c.getText())
            else setFormula(c.getFormula())
        })
    }, [selectedCell])
    const formulaTextChange = (newText: string) => {
        const payload = new CellInputBuilder()
            .sheetIdx(dataSvc.getCurrentSheetIdx())
            .row(selectedCell.row)
            .col(selectedCell.col)
            .input(newText)
            .build()
        dataSvc.handleTransaction(new Transaction([payload], true))
    }
    const locationChange = (newText: string) => {
        const result = parseA1notation(newText)

        if (!result) {
            return
        }

        selectedCell$({row: result.rs, col: result.cs, source: 'editbar'})
    }
    return (
        <div className={styles.host}>
            <input
                className={styles.a1notation}
                defaultValue={coordinate}
                onBlur={(e) => locationChange(e.target.value)}
            />
            <div className={styles.middle} />
            <input
                className={styles.formula}
                onChange={(e) => formulaTextChange(e.target.value)}
                value={formula}
            />
        </div>
    )
}
