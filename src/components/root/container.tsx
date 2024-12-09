import {TopBar} from '@/components/top-bar'
import {useState} from 'react'
import {ContentComponent} from '@/components/content'
import {BottomBarComponent} from '@/components/bottom-bar'
import {SelectedCell} from '@/components/canvas'
import {DEBUG} from '@/core'
import {SETTINGS} from '@/core/settings'
import styles from './root.module.scss'
export const RootContainer = () => {
    const [selectedCell, setSelectedCell] = useState<SelectedCell>({
        row: 0,
        col: 0,
        source: 'none',
    })
    return (
        <div className={styles.host}>
            {DEBUG ? <div className="debug-toolbar" /> : null}
            <div style={{height: SETTINGS.topBar}}>
                <TopBar selectedCell={selectedCell} />
            </div>
            <div className={styles.content}>
                <ContentComponent
                    selectedCell$={setSelectedCell}
                    selectedCell={selectedCell}
                />
            </div>
            <div style={{height: SETTINGS.bottomBar}}>
                <BottomBarComponent />
            </div>
        </div>
    )
}
