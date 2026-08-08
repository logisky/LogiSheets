import {useEffect, type RefObject} from 'react'
import {
    hasActiveCraftInputHandler,
    dispatchCraftCanvasEvent,
    type CraftCanvasEvent,
    type CraftCanvasEventType,
} from 'logisheets-core'

// Anything that can resolve a viewport point to a cell for one view. Both the
// Engine (primary view) and a Session (secondary view) satisfy this.
interface HitTester {
    hitTestCell(
        clientX: number,
        clientY: number
    ): {row: number; col: number} | null
    getCurrentSheetIndex(): number
}

// Events delivered from the container element itself (they target the canvas).
const CONTAINER_MOUSE: CraftCanvasEventType[] = [
    'mousedown',
    'click',
    'dblclick',
    'contextmenu',
]

/**
 * Route a view's canvas mouse/keyboard events to the ACTIVE craft before the
 * engine sees them, letting the craft decide (synchronously) whether the engine
 * should still handle each one.
 *
 * How it works: capture-phase listeners fire before the engine's own handlers
 * (which sit on the canvas and on `window`). When a craft is active and returns
 * "handled", we `stopImmediatePropagation` + `preventDefault` so the event never
 * reaches the engine. When no craft is active — or the craft passes — we touch
 * nothing, so the engine behaves exactly as before.
 *
 * Drag support: the engine tracks drags with `window` listeners, but consuming
 * the initial `mousedown` stops its drag from ever starting. So we mirror that
 * model — once a craft consumes a `mousedown` we forward `mousemove`/`mouseup`
 * from `window` (even off-canvas) until the button releases, so the craft can
 * run its own drag gesture.
 */
export function useCraftInputInterception(
    containerRef: RefObject<HTMLElement | null>,
    hitTester: HitTester | null,
    viewId: string
): void {
    useEffect(() => {
        const container = containerRef.current
        if (!container || !hitTester) return

        const getCanvas = () =>
            container.querySelector<HTMLCanvasElement>('canvas.main-canvas')

        // Set once a craft consumes a mousedown; while true, window
        // mousemove/mouseup are forwarded to the craft regardless of target so
        // a drag that leaves the canvas still tracks.
        let dragging = false

        const buildMouse = (
            type: CraftCanvasEventType,
            e: MouseEvent,
            canvas: HTMLCanvasElement
        ): CraftCanvasEvent => {
            const rect = canvas.getBoundingClientRect()
            const cell = hitTester.hitTestCell(e.clientX, e.clientY)
            const we = e as WheelEvent
            return {
                type,
                clientX: e.clientX,
                clientY: e.clientY,
                offsetX: e.clientX - rect.left,
                offsetY: e.clientY - rect.top,
                viewId,
                sheetIdx: hitTester.getCurrentSheetIndex(),
                row: cell?.row ?? null,
                col: cell?.col ?? null,
                button: e.button,
                buttons: e.buttons,
                deltaX: type === 'wheel' ? we.deltaX : 0,
                deltaY: type === 'wheel' ? we.deltaY : 0,
                key: '',
                code: '',
                altKey: e.altKey,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
                shiftKey: e.shiftKey,
                repeat: false,
            }
        }

        const buildKey = (
            type: CraftCanvasEventType,
            e: KeyboardEvent
        ): CraftCanvasEvent => ({
            type,
            clientX: 0,
            clientY: 0,
            offsetX: 0,
            offsetY: 0,
            viewId,
            sheetIdx: hitTester.getCurrentSheetIndex(),
            row: null,
            col: null,
            button: 0,
            buttons: 0,
            deltaX: 0,
            deltaY: 0,
            key: e.key,
            code: e.code,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            repeat: e.repeat,
        })

        const consume = (e: Event) => {
            e.stopImmediatePropagation()
            e.preventDefault()
        }

        // mousedown / click / dblclick / contextmenu / wheel — on the container,
        // only when the event targets this view's data canvas.
        const onContainerMouse = (e: Event) => {
            if (!hasActiveCraftInputHandler()) return
            const canvas = getCanvas()
            if (!canvas || e.target !== canvas) return
            const me = e as MouseEvent
            const evt = buildMouse(e.type as CraftCanvasEventType, me, canvas)
            const {handled} = dispatchCraftCanvasEvent(evt)
            if (e.type === 'mousedown') {
                // Track drags started by a consuming craft.
                dragging = handled && me.button === 0
                if (handled) {
                    consume(e)
                    // preventDefault suppressed the canvas auto-focus; focus it
                    // ourselves so keydowns still reach this view.
                    canvas.focus({preventScroll: true})
                }
                return
            }
            if (handled) consume(e)
        }

        // mousemove / mouseup — on window, so an in-progress craft drag keeps
        // receiving events after the pointer leaves the canvas.
        const onWindowMouse = (e: Event) => {
            if (!hasActiveCraftInputHandler()) return
            const canvas = getCanvas()
            if (!canvas) return
            const overCanvas = e.target === canvas
            if (!dragging && !overCanvas) return
            const evt = buildMouse(
                e.type as CraftCanvasEventType,
                e as MouseEvent,
                canvas
            )
            const {handled} = dispatchCraftCanvasEvent(evt)
            if (e.type === 'mouseup') dragging = false
            if (handled) consume(e)
        }

        const onKey = (e: Event) => {
            if (!hasActiveCraftInputHandler()) return
            const canvas = getCanvas()
            if (!canvas || e.target !== canvas) return
            const evt = buildKey(e.type as CraftCanvasEventType, e as KeyboardEvent)
            const {handled} = dispatchCraftCanvasEvent(evt)
            if (handled) consume(e)
        }

        const cap = true
        CONTAINER_MOUSE.forEach((t) =>
            container.addEventListener(t, onContainerMouse, cap)
        )
        // wheel must be non-passive so preventDefault can block engine scroll.
        container.addEventListener('wheel', onContainerMouse, {
            capture: true,
            passive: false,
        })
        container.addEventListener('keydown', onKey, cap)
        container.addEventListener('keyup', onKey, cap)
        window.addEventListener('mousemove', onWindowMouse, cap)
        window.addEventListener('mouseup', onWindowMouse, cap)

        return () => {
            CONTAINER_MOUSE.forEach((t) =>
                container.removeEventListener(t, onContainerMouse, cap)
            )
            container.removeEventListener('wheel', onContainerMouse, cap)
            container.removeEventListener('keydown', onKey, cap)
            container.removeEventListener('keyup', onKey, cap)
            window.removeEventListener('mousemove', onWindowMouse, cap)
            window.removeEventListener('mouseup', onWindowMouse, cap)
        }
    }, [containerRef, hitTester, viewId])
}
