import styles from './scrollbar.module.scss'
import { useLocalStore, observer } from 'mobx-react'
import { autorun } from 'mobx'
import {
    CSSProperties,
    MouseEvent,
    useEffect,
    useRef,
    useState,
    WheelEvent,
} from 'react'
import { xScrollbarStore, yScrollbarStore } from './store'
import { MouseEventInfo, ScrollbarType } from './types'
import { useEventListener } from 'ahooks'

export interface ScrollbarProps {
    direction: ScrollbarType
}

export const ScrollbarComponent = observer((props: ScrollbarProps) => {
    const { direction = 'x' } = props
    const store = useLocalStore(() => direction === 'x' ? xScrollbarStore : yScrollbarStore)
    console.log(store)
    if (store.scrollHeight < store.offsetHeight)
        throw Error(
            `scrollHeight[${store.scrollHeight}] must larger than offsetHeight[${store.offsetHeight}]`
        )
    const thumbEl = useRef<HTMLSpanElement>(null)
    const containerEl = useRef<HTMLDivElement>(null)
    const thumbContainerEl = useRef<HTMLDivElement>(null)
    const mouseEventInfo = useRef<MouseEventInfo>()
    const [thumbStyle, setThumbStyle] = useState<CSSProperties>()

    useEffect(() => {
        autorun(() => {
            const thumbContainer = thumbContainerEl.current
            if (!thumbContainer) return
            /**
             * The difference between clientHeight, offsetHeight, scrollHeight, offsetTop, and scrollTop
             * https://www.programmersought.com/article/76801676023/
             */
            // 除法要注意判断分母是否为0
            let scrollRadio = store.scrollTop / store.scrollHeight
            let thumbRadio = store.offsetHeight / store.scrollHeight
            if (store.scrollHeight === 0) {
                scrollRadio = 0
                thumbRadio = 0
            }
            const containerStyle = getComputedStyle(thumbContainer)
            const newThumbStyle: CSSProperties = {}
            if (isXScrollbar()) {
                const containerLength = parseFloat(containerStyle.width)
                const thumbWidth = containerLength * thumbRadio
                const thumbLength = Math.max(thumbWidth, store.minThumbLength)
                newThumbStyle.width =
                    thumbLength === containerLength ? 0 : toPx(thumbLength)
                const left = scrollRadio * containerLength
                if (left + thumbLength > containerLength) {
                    newThumbStyle.right = 0
                } else newThumbStyle.left = toPx(left)
            } else {
                const containerLength = parseFloat(containerStyle.height)
                const thumbHeight = thumbContainer.offsetHeight * thumbRadio
                const thumbLength = Math.max(thumbHeight, store.minThumbLength)
                newThumbStyle.height =
                    thumbLength === containerLength ? 0 : toPx(thumbLength)
                const top = scrollRadio * containerLength
                if (top + thumbLength > containerLength) {
                    newThumbStyle.bottom = 0
                } else newThumbStyle.top = toPx(top)
            }
            setThumbStyle(newThumbStyle)
        })

    }, [direction])

    const isXScrollbar = () => {
        return direction === 'x'
    }
    useEventListener('mousemove', e => {
        e.preventDefault()
        e.stopPropagation()
        if (!mouseEventInfo.current) return
        const endPosition = isXScrollbar() ? e.clientX : e.clientY
        const moved = endPosition - mouseEventInfo.current.startPosition
        calcScrollDistance(mouseEventInfo.current.startScrollDistance, moved)
    })
    useEventListener('mouseup', () => {
        mouseEventInfo.current = undefined
    })
    const thumbMouseDown = (mde: MouseEvent) => {
        mde.stopPropagation()
        mde.preventDefault()
        mouseEventInfo.current = {
            startPosition: isXScrollbar() ? mde.clientX : mde.clientY,
            startScrollDistance: store.scrollTop,
        }
    }
    const thumbHostMouseWheel = (e: WheelEvent) => {
        const moved = isXScrollbar() ? e.deltaX : e.deltaY
        calcScrollDistance(store.scrollTop, moved)
    }
    const calcScrollDistance = (
        containerScrollDistance: number,
        moved: number
    ) => {
        const totalLength = _containerLength()
        const thumbLength = _thumbLength()
        const oldScrollRadio = containerScrollDistance / store.scrollHeight
        const oldStart = totalLength * oldScrollRadio
        let newStart = oldStart + moved
        if (newStart + thumbLength > totalLength)
            newStart = totalLength - thumbLength
        if (newStart < 0) newStart = 0
        const newScrollRadio = newStart / totalLength
        const newScrollDistance = store.scrollHeight * newScrollRadio
        store.setScrollTop(newScrollDistance)
    }

    const _containerLength = () => {
        return isXScrollbar()
            ? thumbContainerEl.current?.offsetWidth ?? 0
            : thumbContainerEl.current?.offsetHeight ?? 0
    }

    const _thumbLength = () => {
        return isXScrollbar()
            ? thumbEl.current?.offsetWidth ?? 0
            : thumbEl.current?.offsetHeight ?? 0
    }
    return (
        <div
            className={`${styles.host} ${isXScrollbar() ? styles['x-scrollbar'] : styles['y-scrollbar']
                }`}
        >
            <div
                className={styles['edit-scrollbar']}
                ref={containerEl}
                style={{
                    height: '100%',
                    width: '100%',
                }}
            >
                <div
                    className={styles['thumb_container']}
                    ref={thumbContainerEl}
                    onWheel={(e) => thumbHostMouseWheel(e)}
                >
                    <span
                        className={styles['thumb']}
                        ref={thumbEl}
                        style={thumbStyle}
                        onMouseDown={(e) => thumbMouseDown(e)}
                    ></span>
                </div>
            </div>
        </div>
    )
})
const toPx = (num: number) => {
    return `${num}px`
}
