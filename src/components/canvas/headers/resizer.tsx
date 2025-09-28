import React, {useRef, useState} from 'react'

export interface HeaderResizerProps {
    orientation: 'row' | 'col'
    // absolute position inside the header container
    x: number
    y: number
    // length of the handle line (height for col, width for row)
    length: number
    // optional thickness in px
    thickness?: number
    // live resize delta callback (in px)
    onResize?: (deltaPx: number) => void
    // commit resize delta callback (in px)
    onResizeEnd?: (deltaPx: number) => void
}

// A lightweight, reusable resizer handle for headers.
// It does not perform any data mutations itself; use the callbacks to apply changes.
export const HeaderResizer: React.FC<HeaderResizerProps> = ({
    orientation,
    x,
    y,
    length,
    thickness = 6,
    onResize,
    onResizeEnd,
}) => {
    const startRef = useRef<{x: number; y: number} | null>(null)
    const [dragging, setDragging] = useState(false)
    const [delta, setDelta] = useState(0)

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        startRef.current = {x: e.clientX, y: e.clientY}
        setDragging(true)

        const onMove = (me: MouseEvent) => {
            if (!startRef.current) return
            const dx = me.clientX - startRef.current.x
            const dy = me.clientY - startRef.current.y
            const d = orientation === 'col' ? dx : dy
            setDelta(d)
            onResize?.(d)
        }
        const onUp = (ue: MouseEvent) => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            if (!startRef.current) return
            const dx = ue.clientX - startRef.current.x
            const dy = ue.clientY - startRef.current.y
            const d = orientation === 'col' ? dx : dy
            onResizeEnd?.(d)
            startRef.current = null
            setDragging(false)
            setDelta(0)
        }

        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    // The draggable handle
    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        left: orientation === 'col' ? x - thickness / 2 : x,
        top: orientation === 'row' ? y - thickness / 2 : y,
        width: orientation === 'col' ? thickness : length,
        height: orientation === 'col' ? length : thickness,
        cursor: orientation === 'col' ? 'col-resize' : 'row-resize',
        zIndex: 3,
    }

    // Baseline (original) guide
    const baseGuideStyle: React.CSSProperties = {
        position: 'absolute',
        left: orientation === 'col' ? x - 1 : 0,
        top: orientation === 'row' ? y - 1 : 0,
        width: orientation === 'col' ? 2 : length,
        height: orientation === 'col' ? length : 2,
        background: 'rgba(0,0,0,0.15)',
        pointerEvents: 'none',
        zIndex: 2,
        display: dragging ? 'block' : 'none',
    }

    // Current (moving) guide
    const currGuideStyle: React.CSSProperties = {
        position: 'absolute',
        left: orientation === 'col' ? x + delta - 1 : 0,
        top: orientation === 'row' ? y + delta - 1 : 0,
        width: orientation === 'col' ? 2 : length,
        height: orientation === 'col' ? length : 2,
        background: 'rgba(31, 187, 125, 0.8)',
        pointerEvents: 'none',
        zIndex: 2,
        display: dragging ? 'block' : 'none',
    }

    // Pixel info badge
    const badgeStyle: React.CSSProperties = {
        position: 'absolute',
        left: orientation === 'col' ? x + delta + 6 : 4,
        top: orientation === 'row' ? y + delta + 6 : 4,
        padding: '2px 6px',
        borderRadius: 3,
        fontSize: 11,
        color: '#fff',
        background: 'rgba(31, 187, 125, 0.85)',
        pointerEvents: 'none',
        zIndex: 4,
        display: dragging ? 'inline-block' : 'none',
    }

    const badgeText = `${Math.round(delta * 10) / 10}px`

    return (
        <>
            {/* Guides shown during dragging */}
            <div style={baseGuideStyle} />
            <div style={currGuideStyle} />
            <div style={badgeStyle}>{badgeText}</div>
            {/* Actual draggable handle */}
            <div style={handleStyle} onMouseDown={onMouseDown} />
        </>
    )
}

export default HeaderResizer
