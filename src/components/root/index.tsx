import {RootContainer} from './container'
import styles from './root.module.scss'
import {WsCommponent} from './ws'
import {ErrorBoundary} from '@/ui/error'
import {NotificatonComponent} from '@/ui/notification'
import {SettingContext, Settings} from '@/core/settings'
import {GlobalContext, GlobalStore} from '@/store'
import {useEffect, useRef} from 'react'

export const SpreadsheetRoot = () => {
    const globalStore = useRef(new GlobalStore())

    useEffect(() => {
        globalStore.current.purge()
    }, [])
    return (
        <div className={styles.host}>
            <GlobalContext.Provider value={globalStore}>
                <ErrorBoundary>
                    <SettingContext.Provider value={new Settings()}>
                        {STAND_ALONE ? <RootContainer /> : <WsCommponent />}
                    </SettingContext.Provider>
                </ErrorBoundary>
            </GlobalContext.Provider>
            <NotificatonComponent />
        </div>
    )
}
