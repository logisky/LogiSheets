import styles from './scrollbar.module.scss'
import { CSSProperties, MouseEvent, useEffect, useRef, useState, WheelEvent, FC } from 'react'
import { Subscription } from 'rxjs'
import { EventType, on } from '@/common/events'

export * from './scroll_event'
export type ScrollbarType = 'x' | 'y'
export interface ScrollbarAttr {
    // 当前canvas的尺寸
    containerLength: number
    // 整个sheet的尺寸
    containerTotalLength: number
    scrollDistance: number
    paddingTop?: number
    paddingBottom?: number
    paddingLeft?: number
    paddingRight?: number
    minThumbLength?: number
    maxThumbRadio?: number
    direction: ScrollbarType
}
export interface ScrollbarProps extends ScrollbarAttr {
    setScrollDistance: (scrollDistance: number) => void
}

export const ScrollbarComponent: FC<ScrollbarProps> = ({
    containerLength = 0,
    scrollDistance = 0,
    setScrollDistance,
    containerTotalLength = 0,
    paddingBottom = 0,
    paddingLeft = 0,
    paddingRight = 0,
    paddingTop = 0,
    minThumbLength = 20,
    direction = 'x',
}) => {
    const _thumbEl = useRef<HTMLSpanElement>(null)
    const _containerEl = useRef<HTMLDivElement>(null)
    const _thumbContainerEl = useRef<HTMLDivElement>(null)
    const [thumbStyle, setThumbStyle] = useState<CSSProperties>()

    useEffect(() => {
        const _render = () => {
            const thumbContainer = _thumbContainerEl.current as HTMLDivElement
            /**
             * The difference between clientHeight, offsetHeight, scrollHeight, offsetTop, and scrollTop
             * https://www.programmersought.com/article/76801676023/
             */
            // 除法要注意判断分母是否为0
            let scrollRadio = scrollDistance / containerTotalLength
            let thumbRadio = containerLength / containerTotalLength
            if (containerTotalLength === 0) {
                scrollRadio = 0
                thumbRadio = 0
            }
            const containerStyle = getComputedStyle(thumbContainer)
            const newThumbStyle: CSSProperties = {}
            if (xScrollbar()) {
                const containerLength = parseFloat(containerStyle.width)
                const thumbWidth = containerLength * thumbRadio
                const thumbLength = Math.max(thumbWidth, minThumbLength)
                newThumbStyle.width = thumbLength === containerLength ? 0 : toPx(thumbLength)
                const left = scrollRadio * containerLength
                if (left + thumbLength > containerLength) {
                    newThumbStyle.right = 0
                } else
                    newThumbStyle.left = toPx(left)
            } else {
                const containerLength = parseFloat(containerStyle.height)
                const thumbHeight = thumbContainer.offsetHeight * thumbRadio
                const thumbLength = Math.max(thumbHeight, minThumbLength)
                newThumbStyle.height = thumbLength === containerLength ? 0 : toPx(thumbLength)
                const top = scrollRadio * containerLength
                if (top + thumbLength > containerLength) {
                    newThumbStyle.bottom = 0
                } else
                    newThumbStyle.top = toPx(top)
            }
            setThumbStyle(newThumbStyle)
        }
        _render()
    }, [
        containerLength,
        scrollDistance,
        containerTotalLength,
        minThumbLength,
        direction,
    ])

    const xScrollbar = () => {
        return direction === 'x'
    }
    const thumbMouseDown = (mde: MouseEvent) => {
        mde.stopPropagation()
        mde.preventDefault()
        const startPosition = xScrollbar() ? mde.clientX : mde.clientY
        const startScollDistance = scrollDistance
        const sub = new Subscription()
        sub.add(on(window, EventType.MOUSE_MOVE).subscribe(mme => {
            mme.preventDefault()
            mme.stopPropagation()
            const endPosition = xScrollbar() ? mme.clientX : mme.clientY
            const moved = endPosition - startPosition
            calcScrollDistance(startScollDistance, moved)
        }))
        sub.add(on(window, EventType.MOUSE_UP).subscribe(() => {
            sub.unsubscribe()
        }))
    }
    const thumbHostMouseWheel = (e: WheelEvent) => {
        const moved = xScrollbar() ? e.deltaX : e.deltaY
        calcScrollDistance(scrollDistance, moved)
    }
    const calcScrollDistance = (
        containerScrollDistance: number,
        moved: number,
    ) => {
        const totalLength = _containerLength()
        const thumbLength = _thumbLength()
        const oldScrollRadio = containerScrollDistance / containerTotalLength
        const oldStart = totalLength * oldScrollRadio
        let newStart = oldStart + moved
        if (newStart + thumbLength > totalLength)
            newStart = (totalLength - thumbLength)
        if (newStart < 0)
            newStart = 0
        const newScrollRadio = newStart / totalLength
        const newScrollDistance = containerTotalLength * newScrollRadio
        setScrollDistance(newScrollDistance)
    }


    const _containerLength = () => {
        return xScrollbar() ?
            _thumbContainerEl.current?.offsetWidth ?? 0 :
            _thumbContainerEl.current?.offsetHeight ?? 0
    }

    const _thumbLength = () => {
        return xScrollbar() ? _thumbEl.current?.offsetWidth ?? 0 :
            _thumbEl.current?.offsetHeight ?? 0
    }
    return (
        <div className={`${styles.host} ${xScrollbar() ? styles['x-scrollbar'] : styles['y-scrollbar']}`} >
            <div className={styles['edit-scrollbar']} ref={_containerEl} style={{
                paddingTop: toPx(paddingTop),
                paddingBottom: toPx(paddingBottom),
                paddingLeft: toPx(paddingLeft),
                paddingRight: toPx(paddingRight),
                height: `calc(100% - ${toPx(paddingTop + paddingBottom)})`,
                width: `calc(100% - ${toPx(paddingLeft + paddingRight)})`,
            }}>
                <div
                    className={styles['thumb_container']}
                    ref={_thumbContainerEl}
                    onWheel={e => thumbHostMouseWheel(e)}
                >
                    <span
                        className={styles['thumb']}
                        ref={_thumbEl}
                        style={thumbStyle}
                        onMouseDown={e => thumbMouseDown(e)}
                    ></span>
                </div>
            </div>
        </div>
    )
}
function toPx(num: number): string {
    return `${num}px`
}
