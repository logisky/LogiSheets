import { ScrollEvent } from './scroll_event'
import styles from './scrollbar.module.scss'
import { CSSProperties, MouseEvent, useEffect, useRef, useState, WheelEvent, FC } from 'react'
import { Subscription } from 'rxjs'
import { EventType, on } from 'global/events'

export * from './scroll_event'
export type ScrollbarType = 'x' | 'y'
export interface ScrollbarProps {
    containerLength?: number
    scrollDistance?: number
    setScrollDistance?: (scrollDistance: number) => void
    containerTotalLength?: number
    /**
     * y-scrollbar padding-top, pixel
     */
    paddingTop?: number
    /**
     * x-scrollbar padding-left, pixel
     */
    paddingLeft?: number
    minThumbLength?: number
    maxThumbRadio?: number
    direction?: ScrollbarType
    mouseWheelMove$?: (e: ScrollEvent) => void
    mousemove$?: (e: ScrollEvent) => void
}

export const ScrollbarComponent: FC<ScrollbarProps> = ({
    containerLength = 0,
    scrollDistance = 0,
    setScrollDistance,
    containerTotalLength = 0,
    paddingTop = 0,
    paddingLeft = 0,
    minThumbLength = 20,
    maxThumbRadio = 80,
    direction = 'x',
    mouseWheelMove$,
    mousemove$,
}) => {
    const moving = useRef(false)
    const _thumbEl = useRef<HTMLSpanElement>(null)
    const _containerEl = useRef<HTMLDivElement>(null)
    const _thumbContainerEl = useRef<HTMLDivElement>(null)
    const [thumbStyle, setThumbStyle] = useState<CSSProperties>()

    useEffect(() => {
        const _render = () => {
            /**
             * TODO(minglong): need show scrollbar when hover?
             */
            const thumbContainer = _thumbContainerEl.current!
            /**
             * The difference between clientHeight, offsetHeight, scrollHeight, offsetTop, and scrollTop
             * https://www.programmersought.com/article/76801676023/
             */
            const scrollRadio = scrollDistance / containerTotalLength
            const thumbRadio = containerLength / containerTotalLength
            const newThumbStyle: CSSProperties = {}
            if (xScrollbar()) {
                const containerLength = thumbContainer.offsetWidth
                const thumbWidth = containerLength * thumbRadio
                const thumbLength = Math.max(thumbWidth, minThumbLength)
                newThumbStyle.width = toPx(thumbLength)
                const left = scrollRadio * containerLength
                if (left + thumbLength > containerLength) {
                    newThumbStyle.right = 0
                } else
                    newThumbStyle.left = toPx(left)
            } else {
                const containerLength = thumbContainer.offsetHeight
                const thumbHeight = thumbContainer.offsetHeight * thumbRadio
                const thumbLength = Math.max(thumbHeight, minThumbLength)
                newThumbStyle.height = toPx(thumbLength)
                const top = scrollRadio * containerLength
                if (top + thumbLength > containerLength) {
                    newThumbStyle.bottom = 0
                } else
                    newThumbStyle.top = toPx(top)
            }
            setThumbStyle(newThumbStyle)
        }
        if (!moving.current)
            _render()
    }, [
        containerLength,
        scrollDistance,
        containerTotalLength,
        paddingTop,
        paddingLeft,
        minThumbLength,
        maxThumbRadio,
        direction,
    ])

    const xScrollbar = () => {
        return direction === 'x'
    }
    const thumbMouseDown = (mde: MouseEvent) => {
        mde.stopPropagation()
        const totalLength = _containerLength()
        const thumbLength = _thumbLength()
        let startPosition = xScrollbar() ? mde.clientX : mde.clientY
        moving.current = true
        const sub = new Subscription()
        sub.add(on(window, EventType.MOUSE_MOVE).subscribe(mme => {
            mme.preventDefault()
            mme.stopPropagation()
            const endPosition = xScrollbar() ? mme.clientX : mme.clientY
            let moved = endPosition - startPosition
            const oldScrollRadio = scrollDistance / containerTotalLength
            const oldStart = totalLength * oldScrollRadio
            if (moved + totalLength * oldScrollRadio + thumbLength >= totalLength)
                if (moved > 0)
                    moved = totalLength - thumbLength - oldStart
                else
                    return
            if ((moved + totalLength * oldScrollRadio) <= 0)
                if (moved < 0)
                    moved = -oldStart
                else
                    return
            if (moved === 0)
                return
            let newScrollDistance = 0
            if (scrollDistance + containerTotalLength * (moved / totalLength) < 0) {
                startPosition = xScrollbar() ? mde.clientX : mde.clientY
            }
            else {
                newScrollDistance = scrollDistance + containerTotalLength * (moved / totalLength)
                startPosition += moved
            }
            setScrollDistance?.(newScrollDistance)
            const scrollEvent = new ScrollEvent()
            scrollEvent.delta = containerTotalLength * (moved / totalLength)
            scrollEvent.scrollDistance = newScrollDistance
            scrollEvent.trust = true
            scrollEvent.type = direction
            mousemove$?.(scrollEvent)
        }))
        sub.add(on(window, EventType.MOUSE_UP).subscribe(() => {
            moving.current = false
            sub.unsubscribe()
        }))
    }
    const thumbHostMouseWheel = (e: WheelEvent) => {
        const totalLength = _containerLength()
        const thumbLength = _thumbLength()
        let moved = xScrollbar() ? e.deltaX : e.deltaY
        const oldScrollRadio = scrollDistance / containerTotalLength
        const startPosition = totalLength * oldScrollRadio
        if (moved + totalLength * oldScrollRadio + thumbLength >= totalLength)
            if (moved > 0)
                moved = totalLength - thumbLength - startPosition
            else
                return
        if ((moved + totalLength * oldScrollRadio) <= 0)
            if (moved < 0)
                moved = -startPosition
            else
                return
        if (moved === 0)
            return
        const newScrollRadio = Math.abs(moved / totalLength)
        const newScrollDistance = containerTotalLength * newScrollRadio
        const scrollEvent = new ScrollEvent()
        scrollEvent.delta = scrollDistance - newScrollDistance
        scrollEvent.scrollDistance = scrollDistance
        scrollEvent.trust = true
        scrollEvent.type = direction
        mouseWheelMove$?.(scrollEvent)
    }


    const _containerLength = () => {
        return xScrollbar() ?
            _thumbContainerEl.current!.offsetWidth :
            _thumbContainerEl.current!.offsetHeight
    }

    const _thumbLength = () => {
        return xScrollbar() ? _thumbEl.current!.offsetWidth :
            _thumbEl.current!.offsetHeight
    }
    return (
        <div className={`${styles.host} ${xScrollbar() ? styles['x-scrollbar'] : styles['y-scrollbar']}`} >
            <div className={styles["edit-scrollbar"]} ref={_containerEl} style={{
                paddingTop: toPx(paddingTop),
                height: `calc(100% - ${toPx(paddingTop)})`,
                paddingLeft: toPx(paddingLeft),
                width: `calc(100% - ${toPx(paddingLeft)})`,
            }}>
                <div
                    className={styles["thumb_container"]}
                    ref={_thumbContainerEl}
                    onWheel={e => thumbHostMouseWheel(e)}
                >
                    <span
                        className={styles["thumb"]}
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
