import { CSSProperties, MouseEvent, FC } from 'react'
import styles from './dnd.module.scss'
const BORDER_WIDTH = 2
const POS = (position: number | null) => `${(position ?? 0) - BORDER_WIDTH}px`
export interface DndProps {
    x?: number
    y?: number
    width?: number
    height?: number
    draggingX?: number
    draggingY?: number
    mousedown?: (e: MouseEvent) => void
}

export const DndComponent: FC<DndProps> = ({
    x = -1,
    y = -1,
    width = -1,
    height = -1,
    draggingX = -1,
    draggingY = -1,
    mousedown,
}) => {
    const draggingStyle = (): CSSProperties => {
        const invalid = () => {
            if (draggingX === x && draggingY === y)
                return true
            if (draggingX === null || draggingY === null)
                return true
            if (draggingX < 0 || draggingY < 0)
                return true
            return false
        }
        return {
            display: invalid() ? 'none' : 'block',
            left: POS(draggingX),
            top: POS(draggingY),
            width: `${width}px`,
            height: `${height}px`,
        }
    }
    return (
        <div className={`${styles.host}`}>
            <div className={styles.border} style={{
                left: POS(x),
                top: POS(y),
                width: `${width}px`,
                height: `${height}px`,
            }}></div>
            <div className={styles.dragginng} style={draggingStyle()}></div>
        </div>
    )
}
