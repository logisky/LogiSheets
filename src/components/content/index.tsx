import {SelectedCell, CanvasComponent} from '@/components/canvas'
import {FC, useState} from 'react'
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
    const [activeSheet, activeSheet$] = useState<number>(0)
    return (
        <div className={styles.host}>
            <EditBarComponent
                selectedCell={selectedCell}
                selectedCell$={selectedCell$}
            />
            <div className={styles.middle}>
                <div className={styles.canvas}>
                    <CanvasComponent
                        selectedCell={selectedCell}
                        selectedCell$={selectedCell$}
                        activeSheet={activeSheet}
                        activeSheet$={activeSheet$}
                    />
                </div>
            </div>
            <SheetsTabComponent
                activeSheet={activeSheet}
                activeSheet$={activeSheet$}
            />
        </div>
    )
}
