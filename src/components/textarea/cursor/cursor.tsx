import styles from './cursor.module.scss'
import { observer, useLocalStore } from 'mobx-react'
import { internalTextareaStore } from '../managers'

export const CursorComponent = observer(() => {
    const store = useLocalStore(() => internalTextareaStore)
    if (!store.showCursor) return null
    return (
        <div
            className={`${styles.host} ${styles['logi-sheets-cursor-smooth']}`}
            style={{
                height: `${store.cursorHeight}px`,
                left: `${store.cursorX}px`,
                top: `${store.cursorY}px`,
            }}
        ></div>
    )
})
