import {Toolbar} from '@/components/toolbar'
import {useState} from 'react'
import {ContentComponent} from '@/components/content'
import {SETTINGS} from '@/core/settings'
import styles from './root.module.scss'
import {BlockView} from '../block-view'
import {Grid} from '@/core/worker/types'
import {IconButton} from '@mui/material'
import {ChevronLeft} from '@mui/icons-material'
import {SelectedData} from 'logisheets-web'
export const RootContainer = () => {
    const [selectedData, setSelectedData] = useState<SelectedData>({
        source: 'none',
    })
    const [grid, setGrid] = useState<Grid | null>(null)
    const [isBlockViewVisible, setBlockViewVisible] = useState(false)

    return (
        <div className={styles.container}>
            <div className={styles.host}>
                <div style={{height: SETTINGS.topBar}}>
                    <Toolbar selectedData={selectedData} setGrid={setGrid} />
                </div>
                <div className={styles.content}>
                    <ContentComponent
                        selectedData$={setSelectedData}
                        selectedData={selectedData}
                        grid={grid}
                        setGrid={setGrid}
                    />
                </div>
            </div>
            {!isBlockViewVisible ? (
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
                        onClick={() => setBlockViewVisible(true)}
                    >
                        <ChevronLeft />
                    </IconButton>
                </div>
            ) : null}
            {isBlockViewVisible ? (
                <div className={styles['block-view-container']}>
                    <BlockView
                        selectedData={selectedData}
                        onClose={() => setBlockViewVisible(false)}
                    />
                </div>
            ) : null}
        </div>
    )
}
