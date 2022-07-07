import { RootContainer } from './container'
import styles from './root.module.scss'
import { WsCommponent } from './ws'
import {ErrorBoundary} from '@/ui/error'
import {NotificatonComponent} from '@/ui/notification'


export const SpreadsheetRoot = () => {
    return (
        <div className={styles.host}>
            <ErrorBoundary>
                {
                    STAND_ALONE ? <RootContainer></RootContainer> : <WsCommponent></WsCommponent>
                }
            </ErrorBoundary>
            <NotificatonComponent></NotificatonComponent>
        </div>
    )
}
