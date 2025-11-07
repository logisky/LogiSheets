import {SelectedData, CanvasComponent} from '@/components/canvas'
import {FC, useState} from 'react'
import styles from './content.module.scss'
import {EditBarComponent} from './edit-bar'
import {SheetsTabComponent} from '@/components/sheets-tab'

export interface ContentProps {
    selectedData$: (cell: SelectedData) => void
    selectedData: SelectedData
}

export const ContentComponent: FC<ContentProps> = ({
    selectedData$,
    selectedData,
}) => {
    const [activeSheet, activeSheet$] = useState<number>(0)
    const [selectedDataContentChanged, setSelectedDataContentChanged] =
        useState({})
    return (
        <div className={styles.host}>
            <EditBarComponent
                selectedData={selectedData}
                selectedData$={selectedData$}
                selectedDataContentChanged={selectedDataContentChanged}
            />
            <div className={styles.middle}>
                <div className={styles.canvas}>
                    <CanvasComponent
                        selectedData={selectedData}
                        selectedData$={selectedData$}
                        activeSheet={activeSheet}
                        activeSheet$={activeSheet$}
                        selectedDataContentChanged$={
                            setSelectedDataContentChanged
                        }
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
