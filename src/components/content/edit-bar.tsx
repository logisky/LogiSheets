import {SelectedCell} from '@/components/canvas'
import {toA1notation, parseA1notation} from '@/core'
import {CellInputBuilder} from '@logisheets_bg'
import {FC, useEffect, useState} from 'react'
import styles from './edit-bar.module.scss'
import {useInjection} from '@/core/ioc/provider'
import {Backend, SheetService} from '@/core/data'
import {TYPES} from '@/core/ioc/types'
export interface EditBarProps {
    selectedCell: SelectedCell
    selectedCell$: (e: SelectedCell) => void
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedCell,
    selectedCell$,
}) => {
    const sheetSvc = useInjection<SheetService>(TYPES.Sheet)
    const backendSvc = useInjection<Backend>(TYPES.Backend)
    const [coordinate, setCoordinate] = useState('')
    const [formula, setFormula] = useState('')
    useEffect(() => {
        const {row, col} = selectedCell
        const notation = toA1notation(selectedCell.col)
        setCoordinate(`${notation}${row + 1}`)
        const cell = sheetSvc.getCell(row, col)
        if (cell === undefined) return
        if (cell.formula === '') setFormula(cell.getText())
        else setFormula(cell.getFormular())
    }, [selectedCell])
    const formulaTextChange = (newText: string) => {
        const payload = new CellInputBuilder()
            .sheetIdx(sheetSvc.getActiveSheet())
            .row(selectedCell.row)
            .col(selectedCell.col)
            .input(newText)
            .build()
        backendSvc.sendTransaction([payload], true)
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
            ></input>
            <div className={styles.middle}></div>
            <input
                className={styles.formula}
                onChange={(e) => formulaTextChange(e.target.value)}
                value={formula}
            ></input>
        </div>
    )
}
