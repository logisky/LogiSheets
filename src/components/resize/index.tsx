import Styles from './resizer.module.scss'
import {FC} from 'react'
export interface ResizerProps {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly hoverText: string
    readonly movingHeight: number
    readonly movingWidth: number
    readonly active: boolean
    readonly movingX: number
    readonly movingY: number
    readonly type: 'row' | 'col'
}
export const ResizerComponent: FC<ResizerProps> = ({
    x,
    y,
    height,
    width,
    hoverText,
    movingHeight,
    movingWidth,
    movingX,
    movingY,
    active,
    type,
}) => {
    return (
        <div
            className={`${Styles.host}`}
            style={{
                left: `${x}px`,
                top: `${y}px`,
                opacity: active ? 1 : 0,
            }}
        >
            <div
                className={Styles.trigger}
                style={{
                    height: `${height}px`,
                    width: `${width}px`,
                    left: type === 'col' ? `${-width / 2}px` : 0,
                    top: type === 'row' ? `${-height / 2}px` : 0,
                    cursor: type === 'row' ? 'row-resize' : 'col-resize',
                }}
            ></div>
            <div
                className={Styles['hover-text']}
                style={{
                    left: type === 'row' ? `${width}px` : 0,
                    top: type === 'col' ? `${height}px` : 0,
                }}
            >
                {hoverText}
            </div>
            <div
                className={Styles.moving}
                style={{
                    width: `${movingWidth}px`,
                    height: `${movingHeight}px`,
                    left: `${movingX}px`,
                    top: `${movingY}px`,
                }}
            ></div>
        </div>
    )
}
