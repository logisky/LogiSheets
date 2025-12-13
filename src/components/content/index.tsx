import {CanvasComponent} from '@/components/canvas'
import {FC, useState} from 'react'
import styles from './content.module.scss'
import {EditBarComponent} from './edit-bar'
import {SheetsTabComponent} from '@/components/sheets-tab'
import {Grid} from '@/core/worker/types'
import {CellLayout, SelectedData} from 'logisheets-web'

export interface ContentProps {
    selectedData$: (cell: SelectedData) => void
    selectedData: SelectedData
    grid: Grid | null
    setGrid: (grid: Grid | null) => void
    cellLayouts: CellLayout[]
    activeSheet: number
    setActiveSheet: (sheet: number) => void
}

export const ContentComponent: FC<ContentProps> = ({
    grid,
    setGrid,
    selectedData$,
    selectedData,
    activeSheet,
    setActiveSheet,
    cellLayouts,
}) => {
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
                        activeSheet$={setActiveSheet}
                        selectedDataContentChanged$={
                            setSelectedDataContentChanged
                        }
                        grid={grid}
                        setGrid={setGrid}
                        cellLayouts={cellLayouts}
                    />
                </div>
            </div>
            <SheetsTabComponent
                activeSheet={activeSheet}
                activeSheet$={setActiveSheet}
            />
        </div>
    )
}
