import {Toolbar} from '@/components/toolbar'
import {useEffect, useState} from 'react'
import {ContentComponent} from '@/components/content'
import {SelectedData} from '@/components/canvas'
import {DEBUG} from '@/core'
import {SETTINGS} from '@/core/settings'
import styles from './root.module.scss'
import {BlockView} from '../block-view'
export const RootContainer = () => {
    const [selectedData, setSelectedData] = useState<SelectedData>({
        source: 'none',
    })
    const [isBlockViewVisible, setBlockViewVisible] = useState(false)

    return (
        <div className={styles.container}>
            <div className={styles.host}>
                {DEBUG ? <div className="debug-toolbar" /> : null}
                <div style={{height: SETTINGS.topBar}}>
                    <Toolbar selectedData={selectedData} />
                </div>
                <div className={styles.content}>
                    <ContentComponent
                        selectedData$={setSelectedData}
                        selectedData={selectedData}
                    />
                </div>
            </div>
            {isBlockViewVisible && (
                <div className={styles['block-view-container']}>
                    <BlockView />
                </div>
            )}
        </div>
    )
}
