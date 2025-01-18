import {TopBar} from '@/components/top-bar'
import {useState} from 'react'
import {ContentComponent} from '@/components/content'
import {BottomBarComponent} from '@/components/bottom-bar'
import {SelectedData} from '@/components/canvas'
import {DEBUG} from '@/core'
import {SETTINGS} from '@/core/settings'
import styles from './root.module.scss'
export const RootContainer = () => {
    const [selectedData, setSelectedData] = useState<SelectedData>({
        source: 'none',
    })
    return (
        <div className={styles.host}>
            {DEBUG ? <div className="debug-toolbar" /> : null}
            <div style={{height: SETTINGS.topBar}}>
                <TopBar selectedData={selectedData} />
            </div>
            <div className={styles.content}>
                <ContentComponent
                    selectedData$={setSelectedData}
                    selectedData={selectedData}
                />
            </div>
            <div style={{height: SETTINGS.bottomBar}}>
                <BottomBarComponent />
            </div>
        </div>
    )
}
