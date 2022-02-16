import { TopBar } from 'components/top-bar'
import { useState } from 'react'
import { ContentComponent } from 'components/content'
import { BottomBarComponent } from 'components/bottom-bar'
import { SelectedCell } from 'components/canvas'
import { DEBUG } from 'common'
import { SETTINGS } from 'common/settings'
import styles from './root.module.scss'
export const RootContainer = () => {
    const [selectedCell, setSelectedCell] = useState<SelectedCell>({ row: 0, col: 0 })
    return <div className={styles.host}>
        {DEBUG ? (<div className="debug-toolbar">

        </div>) : null}
        <div style={{ height: SETTINGS.topBar }}>
            <TopBar selectedCell={selectedCell}></TopBar>
        </div>
        <div className={styles.content}>
            <ContentComponent selectedCell$={setSelectedCell} selectedCell={selectedCell}></ContentComponent>
        </div>
        <div style={{ height: SETTINGS.bottomBar }}>
            <BottomBarComponent></BottomBarComponent>
        </div>
    </div>
}