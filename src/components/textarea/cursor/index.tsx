import {FC} from 'react'
import styles from './cursor.module.scss'

export interface CursorProps {
    height?: number
    x?: number
    y?: number
}

export const CursorComponent: FC<CursorProps> = ({
    height = 0,
    x = 0,
    y = 0,
}) => {
    return (
        <div
            className={`${styles.host} ${styles['logisheets-cursor-smooth']}`}
            style={{
                height: `${height}px`,
                left: `${x}px`,
                top: `${y}px`,
            }}
        />
    )
}

export * from './cursor-info'
