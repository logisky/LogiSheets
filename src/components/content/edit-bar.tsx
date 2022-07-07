import { SelectedCell } from '@/components/canvas'
import { toA1notation } from '@/common'
import { FC, useEffect, useState } from 'react'
import styles from './edit-bar.module.scss'
import { useInjection } from '@/core/ioc/provider'
import { SheetService } from '@/core/data'
import { TYPES } from '@/core/ioc/types'
export interface EditBarProps {
    selectedCell: SelectedCell
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedCell,
}) => {
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const [coordinate, setCoordinate] = useState('')
    const [formula, setFormula] = useState('')
    useEffect(() => {
        const { row, col } = selectedCell
        const notation = toA1notation(selectedCell.col)
        setCoordinate(`${notation}${row + 1}`)
        const cell = SHEET_SERVICE.getCell(row, col)
        if (cell === undefined)
            return
        if (cell.formula === '')
            setFormula(cell.getText())
        else
            setFormula(cell.getFormular())
    }, [selectedCell])
    const textChange = (newText: string) => {
        console.log(newText)
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
