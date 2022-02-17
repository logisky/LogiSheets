import { RootContainer } from './container'
import styles from './root.module.scss'
import { WsCommponent } from './ws'


export const SpreadsheetRoot = () => {
    return (
        <div className={styles.host}>
            {
                STAND_ALONE ? <RootContainer></RootContainer> : <WsCommponent></WsCommponent>
            }
        </div>
    );
}
