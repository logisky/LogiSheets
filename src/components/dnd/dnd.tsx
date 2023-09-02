import styles from './dnd.module.scss'
import { observer, useLocalStore } from 'mobx-react'
import { dndStore } from './store'

const BORDER_WIDTH = 2
const POS = (position: number | null) => `${(position ?? 0) - BORDER_WIDTH}px`
export const DndComponent = observer(() => {
    const store = useLocalStore(() => dndStore)
    console.log('dnd component', store)
    const {
        dragging,
        range,
    } = store
    if (!range) return null
    const { x, y, width, height, draggingX, draggingY } = range
    return (
        <div className={styles.host}>
            <div
                className={styles['dragging-handle']}
                style={{
                    left: POS(x),
                    top: POS(y),
                    width: `${width}px`,
                    height: `${height}px`,
                }}
                data-selector-dnd-handle
            >
                <div
                    className={styles['dragging-mask']}
                    data-selector-dnd-mask
                ></div>
            </div>
            <div
                className={styles.dragging}
                style={{
                    display: dragging ? 'block' : 'none',
                    left: POS(draggingX),
                    top: POS(draggingY),
                    width: `${width}px`,
                    height: `${height}px`,
                }}
            ></div>
        </div>
    )
})
