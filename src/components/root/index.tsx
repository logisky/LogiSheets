import {RootContainer} from './container'
import styles from './root.module.scss'
import {ErrorBoundary} from '@/ui/error'
import {NotificatonComponent} from '@/ui/notification'
import {SettingContext, Settings} from '@/core/settings'
import {GlobalContext, GlobalStore} from '@/store'
import {useRef} from 'react'

export const SpreadsheetRoot = () => {
    const globalStore = useRef(new GlobalStore())

    return (
        <div className={styles.host}>
            <GlobalContext.Provider value={globalStore}>
                <ErrorBoundary>
                    <SettingContext.Provider value={new Settings()}>
                        <RootContainer />
                    </SettingContext.Provider>
                </ErrorBoundary>
            </GlobalContext.Provider>
            <NotificatonComponent />
        </div>
    )
}
