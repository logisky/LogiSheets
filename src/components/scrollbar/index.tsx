import styles from './scrollbar.module.scss'
import {CSSProperties, useEffect, useRef, useState, FC} from 'react'
import type {
    MouseEvent as ReactMouseEvent,
    WheelEvent as ReactWheelEvent,
} from 'react'

export interface ScrollbarProps {
    // document total length
    totalLength: number
    // current document position (0..totalLength)
    position: number
    // current visible viewport length
    visibleLength: number
    // orientation of the scrollbar
    orientation: 'x' | 'y'
    onChange: (position: number) => void
    onBlur: () => void
}

export const Scrollbar: FC<ScrollbarProps> = ({
    totalLength,
    position,
    visibleLength,
    orientation,
    onChange,
    onBlur,
}) => {
    if (totalLength < visibleLength) {
        totalLength = visibleLength + 200
    }

    const containerRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const thumbRef = useRef<HTMLSpanElement>(null)
    const [thumbStyle, setThumbStyle] = useState<CSSProperties>()
    const [visible, setVisible] = useState(false)
    const hideTimerRef = useRef<number | null>(null)

    useEffect(() => {
        const ro = new ResizeObserver(() => renderThumb())
        const el = trackRef.current
        if (el) ro.observe(el)
        renderThumb()
        return () => ro.disconnect()
    }, [totalLength, visibleLength, position, orientation])

    // Auto show on new data/position then hide after delay
    useEffect(() => {
        // show now
        setVisible(true)
        // clear previous timer
        if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
        // hide later
        hideTimerRef.current = window.setTimeout(() => {
            setVisible(false)
        }, 800)
        return () => {
            if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
        }
    }, [totalLength, visibleLength, position, orientation])

    const renderThumb = () => {
        const track = trackRef.current
        if (!track) return

        const ratio = totalLength === 0 ? 0 : visibleLength / totalLength
        const posRatio = totalLength === 0 ? 0 : position / totalLength

        const style: CSSProperties = {}
        if (orientation === 'x') {
            const containerLength = track.clientWidth
            const thumbLength = Math.max(containerLength * ratio, 20)
            style.width = thumbLength >= containerLength ? 0 : px(thumbLength)
            const left = posRatio * containerLength
            if (left + thumbLength > containerLength) style.right = 0
            else style.left = px(left)
        } else {
            const containerLength = track.clientHeight
            const thumbLength = Math.max(containerLength * ratio, 20)
            style.height = thumbLength >= containerLength ? 0 : px(thumbLength)
            const top = posRatio * containerLength
            if (top + thumbLength > containerLength) style.bottom = 0
            else style.top = px(top)
        }
        setThumbStyle(style)
    }

    const onThumbMouseDown = (mde: ReactMouseEvent<HTMLSpanElement>) => {
        mde.stopPropagation()
        mde.preventDefault()
        const start = orientation === 'x' ? mde.clientX : mde.clientY
        const startDocPos = position
        const move = (mme: MouseEvent) => {
            mme.preventDefault()
            mme.stopPropagation()
            const end = orientation === 'x' ? mme.clientX : mme.clientY
            const diff = end - start
            applyDelta(startDocPos, diff)
        }
        const up = () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
            onBlur()
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
        const delta = orientation === 'x' ? e.deltaX : e.deltaY
        // keep visible during wheel
        setVisible(true)
        if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = window.setTimeout(() => setVisible(false), 800)
        applyDelta(position, delta)
    }

    const applyDelta = (startDocPos: number, deltaPx: number) => {
        const track = trackRef.current
        const thumb = thumbRef.current
        if (!track) return
        const totalPx =
            orientation === 'x' ? track.clientWidth : track.clientHeight
        const thumbPx =
            orientation === 'x'
                ? thumb?.offsetWidth ?? 0
                : thumb?.offsetHeight ?? 0
        const oldRatio = totalPx === 0 ? 0 : startDocPos / totalLength
        const oldStartPx = totalPx * oldRatio
        let newStartPx = oldStartPx + deltaPx
        if (newStartPx + thumbPx > totalPx) newStartPx = totalPx - thumbPx
        if (newStartPx < 0) newStartPx = 0
        const newRatio = totalPx === 0 ? 0 : newStartPx / totalPx
        const newDocPos = clamp(
            newRatio * totalLength,
            0,
            totalLength - visibleLength
        )
        onChange(newDocPos)
    }

    const hostClass = `${styles.host} ${
        orientation === 'x' ? styles.x : styles.y
    } ${visible ? styles.visible : ''}`

    return (
        <div
            ref={containerRef}
            className={hostClass}
            onWheel={onWheel}
            onMouseEnter={() => {
                setVisible(true)
                if (hideTimerRef.current)
                    window.clearTimeout(hideTimerRef.current)
            }}
            onMouseLeave={() => {
                if (hideTimerRef.current)
                    window.clearTimeout(hideTimerRef.current)
                hideTimerRef.current = window.setTimeout(
                    () => setVisible(false),
                    300
                )
            }}
        >
            <div ref={trackRef} className={styles.track}>
                <span
                    ref={thumbRef}
                    className={styles.thumb}
                    style={thumbStyle}
                    onMouseDown={onThumbMouseDown}
                />
            </div>
        </div>
    )
}

function px(n: number) {
    return `${n}px`
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
}
