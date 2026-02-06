import {Toolbar} from '@/components/toolbar'
import {useState} from 'react'
import {ContentComponent} from '@/components/content'
import {SETTINGS} from '@/core/settings'
import styles from './root.module.scss'
import {CraftPanel} from '../craft-panel'
import {Grid} from 'logisheets-engine'
import {IconButton} from '@mui/material'
import {ChevronLeft} from '@mui/icons-material'
import {CellLayout, SelectedData} from 'logisheets-engine'
export const RootContainer = () => {
    const [selectedData, setSelectedData] = useState<SelectedData>({
        source: 'none',
    })
    const [grid, setGrid] = useState<Grid | null>(null)
    const [isCraftPanelVisible, setCraftPanelVisible] = useState(false)

    const [cellLayouts, setCellLayouts] = useState<CellLayout[]>([])
    const [activeSheet, setActiveSheet] = useState(0)
    const [canvasKey, setCanvasKey] = useState(0)

    return (
        <div className={styles.container}>
            <div className={styles.host}>
                <div style={{height: SETTINGS.topBar}}>
                    <Toolbar selectedData={selectedData} setGrid={setGrid} />
                </div>
                <div className={styles.content}>
                    <ContentComponent
                        key={canvasKey}
                        selectedData$={setSelectedData}
                        selectedData={selectedData}
                        grid={grid}
                        setGrid={setGrid}
                        cellLayouts={cellLayouts}
                        activeSheet={activeSheet}
                        setActiveSheet={setActiveSheet}
                    />
                </div>
            </div>
            {!isCraftPanelVisible ? (
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: SETTINGS.blockViewTop,
                        zIndex: 10,
                    }}
                >
                    <IconButton
                        size="medium"
                        color="default"
                        onClick={() => setCraftPanelVisible(true)}
                    >
                        <ChevronLeft />
                    </IconButton>
                </div>
            ) : null}
            {isCraftPanelVisible ? (
                <div className={styles['block-view-container']}>
                    <CraftPanel
                        setSelectedData={setSelectedData}
                        selectedData={selectedData}
                        onClose={() => {
                            setCraftPanelVisible(false)
                            // Force remount canvas so all layout-related internal
                            // states (anchor, scrollbars, etc.) are reset.
                            setCanvasKey((k) => k + 1)
                        }}
                        setCellLayouts={setCellLayouts}
                        setActiveSheet={setActiveSheet}
                    />
                </div>
            ) : null}
        </div>
    )
}
