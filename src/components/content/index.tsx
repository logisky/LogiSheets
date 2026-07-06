import {EngineCanvas} from '@/components/engine-canvas'
import {useState, useEffect} from 'react'
import {observer} from 'mobx-react-lite'
import styles from './content.module.scss'
import {EditBarComponent} from './edit-bar'
import {SheetsTabComponent} from '@/components/sheets-tab'
import {Grid} from 'logisheets-engine'
import {CellLayout, SelectedData} from 'logisheets-engine'
import {useDiffLayer} from '@/components/diff-layer'
import {SpreadsheetView} from '@/components/spreadsheet-view'
import {ActiveViewBadge} from '@/components/spreadsheet-view/active-view-badge'
import {FormulaEditReminder} from '@/components/formula-edit-reminder'
import {globalStore} from '@/store'
// import {DiffLayerTestPanel} from '@/components/diff-layer/DiffLayerTestPanel'

export interface ContentProps {
    selectedData$: (cell: SelectedData) => void
    selectedData: SelectedData
    grid: Grid | null
    setGrid: (grid: Grid | null) => void
    cellLayouts: CellLayout[]
    activeSheet: number
    setActiveSheet: (sheet: number) => void
}

export const ContentComponent = observer(function ContentComponent({
    grid,
    setGrid,
    selectedData$,
    selectedData,
    activeSheet,
    setActiveSheet,
    cellLayouts,
}: ContentProps) {
    const [selectedDataContentChanged, setSelectedDataContentChanged] =
        useState({})
    const diffLayer = useDiffLayer()

    // While the main view is active, publish its selection context so the top
    // edit bar targets it. (Secondary views publish their own.)
    useEffect(() => {
        if (globalStore.activeViewId !== 'main') return
        globalStore.setActiveViewContext({
            selectedData,
            sheetIdx: activeSheet,
            setSelection: selectedData$,
        })
    }, [selectedData, activeSheet, selectedData$, globalStore.activeViewId])

    const mainCanvas = (
        <EngineCanvas
            selectedData={selectedData}
            selectedData$={selectedData$}
            activeSheet={activeSheet}
            activeSheet$={setActiveSheet}
            selectedDataContentChanged$={setSelectedDataContentChanged}
            grid={grid}
            setGrid={setGrid}
            cellLayouts={cellLayouts}
            diffState={
                globalStore.diffLayerEnabled ? diffLayer.diffState : undefined
            }
        />
    )
    return (
        <div className={styles.host} style={{position: 'relative'}}>
            <FormulaEditReminder />
            <EditBarComponent
                selectedData={selectedData}
                selectedData$={selectedData$}
                selectedDataContentChanged={selectedDataContentChanged}
            />
            {globalStore.splitView ? (
                // Split: main and second view are symmetric panes (canvas +
                // its own sheet-tab bar), so the tab bars line up.
                <div className={styles.middle}>
                    <div
                        className={styles.pane}
                        onPointerDownCapture={() =>
                            globalStore.setActiveViewId('main')
                        }
                    >
                        <div className={styles.paneCanvas}>
                            {mainCanvas}
                            <ActiveViewBadge
                                active={globalStore.activeViewId === 'main'}
                            />
                        </div>
                        <SheetsTabComponent
                            activeSheet={activeSheet}
                            activeSheet$={setActiveSheet}
                            grid={grid}
                        />
                    </div>
                    <SpreadsheetView viewId="view-2" />
                </div>
            ) : (
                // Single view: canvas fills the middle, sheet-tab bar below.
                <>
                    <div className={styles.middle}>
                        <div className={styles.canvas}>{mainCanvas}</div>
                    </div>
                    <SheetsTabComponent
                        activeSheet={activeSheet}
                        activeSheet$={setActiveSheet}
                        grid={grid}
                    />
                </>
            )}
        </div>
    )
})
