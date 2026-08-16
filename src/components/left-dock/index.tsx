import {ReactNode, useCallback, useRef, useState} from 'react'
import {SETTINGS} from '@/core/settings'
import styles from './left-dock.module.scss'

/** Fixed width of the left dock (px). Keep in sync with the content push in
 *  RootContainer and the panel widths inside. */
export const LEFT_DOCK_WIDTH = 360

interface LeftDockProps {
    watsonOpen: boolean
    craftOpen: boolean
    /** Watson panel content (fills its section). */
    watson: ReactNode
    /** Craft panel content (fills its section). */
    craft: ReactNode
}

/**
 * The left dock: a single fixed-width column that hosts the Watson assistant and
 * the craft panel. Whichever are open stack vertically — one open fills the
 * column; both open split top (Watson) / bottom (craft) with a draggable
 * divider. Only ever pushes the workbook by one column width, regardless of how
 * many are stacked. Each panel keeps its own header/close button; this shell is
 * pure layout.
 */
export const LeftDock = ({watsonOpen, craftOpen, watson, craft}: LeftDockProps) => {
    const bothOpen = watsonOpen && craftOpen
    const anyOpen = watsonOpen || craftOpen
    // Fraction of the column height given to Watson (top) when both are open.
    const [watsonFraction, setWatsonFraction] = useState(0.5)
    const dockRef = useRef<HTMLDivElement | null>(null)
    const draggingRef = useRef(false)

    const onDividerDown = useCallback((e: React.PointerEvent) => {
        draggingRef.current = true
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        e.preventDefault()
    }, [])
    const onDividerMove = useCallback((e: React.PointerEvent) => {
        if (!draggingRef.current) return
        const rect = dockRef.current?.getBoundingClientRect()
        if (!rect || rect.height === 0) return
        const frac = (e.clientY - rect.top) / rect.height
        setWatsonFraction(Math.min(0.85, Math.max(0.15, frac)))
    }, [])
    const onDividerUp = useCallback((e: React.PointerEvent) => {
        draggingRef.current = false
        ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    }, [])

    return (
        <div
            ref={dockRef}
            className={styles.dock}
            style={{
                top: SETTINGS.topBar,
                width: LEFT_DOCK_WIDTH,
                display: anyOpen ? 'flex' : 'none',
            }}
        >
            <div
                className={styles.section}
                style={{
                    display: watsonOpen ? 'flex' : 'none',
                    flexGrow: bothOpen ? watsonFraction : 1,
                    flexBasis: 0,
                    minHeight: 0,
                }}
            >
                {watson}
            </div>

            {bothOpen ? (
                <div
                    className={styles.divider}
                    role="separator"
                    aria-orientation="horizontal"
                    onPointerDown={onDividerDown}
                    onPointerMove={onDividerMove}
                    onPointerUp={onDividerUp}
                />
            ) : null}

            <div
                className={styles.section}
                style={{
                    display: craftOpen ? 'flex' : 'none',
                    flexGrow: bothOpen ? 1 - watsonFraction : 1,
                    flexBasis: 0,
                    minHeight: 0,
                }}
            >
                {craft}
            </div>
        </div>
    )
}
