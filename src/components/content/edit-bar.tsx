import { SelectedCell } from '@/components/canvas'
import { toA1notation } from '@/core'
import { CellInputBuilder } from '@/api'
import { FC, useEffect, useState } from 'react'
import styles from './edit-bar.module.scss'
import { useInjection } from '@/core/ioc/provider'
import { Backend, SheetService } from '@/core/data'
import { TYPES } from '@/core/ioc/types'
export interface EditBarProps {
    selectedCell: SelectedCell
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedCell,
}) => {
    const sheetSvc = useInjection<SheetService>(TYPES.Sheet)
    const backendSvc = useInjection<Backend>(TYPES.Backend)
    const [coordinate, setCoordinate] = useState('')
    const [formula, setFormula] = useState('')
    useEffect(() => {
        const { row, col } = selectedCell
        const notation = toA1notation(selectedCell.col)
        setCoordinate(`${notation}${row + 1}`)
        const cell = sheetSvc.getCell(row, col)
        if (cell === undefined)
            return
        if (cell.formula === '')
            setFormula(cell.getText())
        else
            setFormula(cell.getFormular())
    }, [selectedCell])
    const textChange = (newText: string) => {
        const payload = new CellInputBuilder()
            .sheetIdx(sheetSvc.getActiveSheet())
            .row(selectedCell.row)
            .col(selectedCell.col)
            .input(newText)
            .build()
        backendSvc.sendTransaction([payload], true)
    }
    return <div className={styles.host}>
        <div className={styles.a1notation}>{coordinate}</div>
        <div className={styles.middle}></div>
        <input className={styles.formula}
            onChange={e => textChange(e.target.value)}
            value={formula}
        ></input>
    </div>
}
