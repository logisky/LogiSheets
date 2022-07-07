import { FC } from 'react'
import styles from './dnd.module.scss'

const BORDER_WIDTH = 2
const POS = (position: number | null) => `${(position ?? 0) - BORDER_WIDTH}px`
export interface DndProps {
    dragging: boolean
    x: number
    y: number
    width: number
    height: number
    draggingX?: number
    draggingY?: number
}

export const DndComponent: FC<DndProps> = ({
    dragging,
    x = -1,
    y = -1,
    width = -1,
    height = -1,
    draggingX = -1,
    draggingY = -1,
}) => {
    return (
        <div className={styles.host}>
            <div className={styles['dragging-handle']} style={{
                left: POS(x),
                top: POS(y),
                width: `${width}px`,
                height: `${height}px`,
            }} data-selector-dnd-handle>
                <div className={styles['dragging-mask']} data-selector-dnd-mask></div>
            </div>
            <div className={styles.dragging} style={{
                display: dragging ? 'block' : 'none',
                left: POS(draggingX),
                top: POS(draggingY),
                width: `${width}px`,
                height: `${height}px`,
            }}></div>
        </div>
    )
}
