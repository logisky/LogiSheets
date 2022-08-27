import {SelectedCell, CanvasComponent} from '@/components/canvas'
import {FC} from 'react'
import styles from './content.module.scss'
import {EditBarComponent} from './edit-bar'
import {SheetsTabComponent} from '@/components/sheets-tab'

export interface ContentProps {
    selectedCell$: (cell: SelectedCell) => void
    selectedCell: SelectedCell
}

export const ContentComponent: FC<ContentProps> = ({
    selectedCell$,
    selectedCell,
}) => {
    return (
        <div className={styles.host}>
            <EditBarComponent selectedCell={selectedCell}></EditBarComponent>
            <div className={styles.middle}>
                <div className={styles.canvas}>
                    <CanvasComponent
                        selectedCell$={selectedCell$}
                    ></CanvasComponent>
                </div>
            </div>
            <SheetsTabComponent></SheetsTabComponent>
        </div>
    )
}
