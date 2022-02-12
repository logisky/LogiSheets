import { SelectedCell } from 'components/canvas'
import { DATA_SERVICE } from 'core/data'
import { toA1notation } from 'global'
import { FC, useEffect, useState } from 'react'
import styles from './edit-bar.module.scss'
export interface EditBarProps {
    selectedCell: SelectedCell
}

export const EditBarComponent: FC<EditBarProps> = ({
    selectedCell,
}) => {
    const [coordinate, setCoordinate] = useState('')
    const [formula, setFormula] = useState('')
    useEffect(() => {
        const { row, col } = selectedCell
        const notation = toA1notation(selectedCell.col)
        setCoordinate(`${notation}${row}`)
        const cell = DATA_SERVICE.sheetSvc.getCell(row, col)
        if (cell === undefined)
            return
        if (cell.formula === '')
            setFormula(cell.getText())
        else
            setFormula(cell.getFormular())
    }, [selectedCell])
    const textChange = (newText: string) => {

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
