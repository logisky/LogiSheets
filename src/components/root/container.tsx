import {Toolbar} from '@/components/toolbar'
import {useCallback, useEffect, useRef, useState} from 'react'
import {ContentComponent} from '@/components/content'
import {SETTINGS} from '@/core/settings'
import styles from './root.module.scss'
import {CraftPanel} from '../craft-panel'
import {Grid} from 'logisheets-engine'
import {IconButton} from '@mui/material'
import {ChevronLeft} from '@mui/icons-material'
import {CellLayout, SelectedData} from 'logisheets-engine'
import {parseCraftDeepLink} from '@/core/craft-deeplink'
export const RootContainer = () => {
    const [craftDeepLink] = useState(() => parseCraftDeepLink())
    const [selectedData, setSelectedData] = useState<SelectedData>({
        source: 'none',
    })
    // Some crafts (e.g. fuse-beads, which paints cells) don't want a cell
    // selection at all — the highlight box just gets in the way. The active
    // craft opts in via `window.setSelectionSuppressed(true)` (injected by the
    // craft panel); while on, every selection is forced to the empty "none"
    // state. A ref keeps the guarded setter stable across renders.
    const [suppressSelection, setSuppressSelection] = useState(false)
    const suppressSelectionRef = useRef(suppressSelection)
    suppressSelectionRef.current = suppressSelection
    const applySelectedData = useCallback((d: SelectedData) => {
        setSelectedData(suppressSelectionRef.current ? {source: 'none'} : d)
    }, [])
    // When suppression turns on, drop any existing selection immediately.
    useEffect(() => {
        if (suppressSelection) setSelectedData({source: 'none'})
    }, [suppressSelection])
    const [grid, setGrid] = useState<Grid | null>(null)
    const [isCraftPanelVisible, setCraftPanelVisible] = useState(
        !!craftDeepLink
    )

    const [cellLayouts, setCellLayouts] = useState<CellLayout[]>([])
    const [activeSheet, setActiveSheet] = useState(0)

    return (
        <div className={styles.container}>
            <div className={styles.host}>
                <div style={{height: SETTINGS.topBar}}>
                    <Toolbar
                        selectedData={selectedData}
                        setGrid={setGrid}
                        setActiveSheet={setActiveSheet}
                    />
                </div>
                <div className={styles.content}>
                    <ContentComponent
                        selectedData$={applySelectedData}
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
                        // Sit just below the toolbar so the reopen handle
                        // doesn't overlap the top-right toolbar controls.
                        top: SETTINGS.topBar,
                        zIndex: 10,
                    }}
                >
                    <IconButton
                        size="medium"
                        color="default"
                        aria-label="Open craft panel"
                        onClick={() => setCraftPanelVisible(true)}
                    >
                        <ChevronLeft />
                    </IconButton>
                </div>
            ) : null}
            <CraftPanel
                open={isCraftPanelVisible}
                initialCraftSrc={craftDeepLink?.iframeSrc}
                setSelectedData={applySelectedData}
                selectedData={selectedData}
                setSelectionSuppressed={setSuppressSelection}
                onClose={() => {
                    setCraftPanelVisible(false)
                }}
                setCellLayouts={setCellLayouts}
                setActiveSheet={setActiveSheet}
            />
        </div>
    )
}
