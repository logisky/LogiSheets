import {FC, useEffect, useRef} from 'react'
import {Grid} from 'logisheets-engine'
import {BlockInterfaceComponent} from '@/components/block-interface'
import {CraftInteractionComponent} from '@/components/craft-interaction'
import {CommentLayer} from '@/components/comment-layer'
import {DataValidationOverlay} from '@/components/data-validation-overlay'
import {TraceLayer} from './trace-layer'

export interface ViewOverlayLayerProps {
    grid: Grid | null
    /** This view's active sheet (for craft-interaction layers). */
    activeSheet: number
    /** Viewport coordinates of this view's canvas top-left (for hover math). */
    canvasStartX: number
    canvasStartY: number
}

/**
 * The complete React overlay layer for a single spreadsheet view:
 *   - block interface (borders, field headers, settings, add-row, and the
 *     interactive cells — bool / enum / datetime / validation / required …)
 *   - craft interactions (radio / multi-select / point & percent allocators /
 *     number slider) bound to block cells
 *
 * It is a positioned box that exactly covers this view's canvas (`inset: 0`)
 * and clips to it — conceptually the same thing the canvas does when it only
 * paints its own visible cells. Containment therefore lives here, in the
 * overlay, NOT in the page layout, so a view's overlays can never bleed into
 * a side-by-side view, and unrelated chrome (e.g. the formula editor) is
 * unaffected.
 *
 * `pointerEvents: none` lets clicks fall through to the canvas on empty
 * areas; every interactive control inside (block cells, craft widgets) sets
 * `pointerEvents: 'auto'` on itself, so they remain clickable.
 *
 * Wheel forwarding: an interactive control would otherwise swallow the wheel
 * event, freezing the canvas scroll while the mouse hovers it. Because the
 * layer is `pointerEvents: none`, only wheels over a control bubble up to it
 * (empty-area wheels hit the canvas directly), so we re-dispatch exactly
 * those to the sibling canvas — scrolling stays smooth everywhere.
 *
 * Reused by every view (main EngineCanvas, second, third, …) so adding a view
 * never means re-implementing overlays, and they all behave identically.
 */
export const ViewOverlayLayer: FC<ViewOverlayLayerProps> = ({
    grid,
    activeSheet,
    canvasStartX,
    canvasStartY,
}) => {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = rootRef.current
        if (!root) return
        const forwardWheel = (e: WheelEvent) => {
            const canvas =
                root.parentElement?.querySelector<HTMLCanvasElement>('canvas')
            if (!canvas) return
            // The wheel landed on an interactive overlay control. Forward it
            // to the engine canvas so the sheet scrolls as if the overlay
            // weren't there.
            e.preventDefault()
            e.stopPropagation()
            canvas.dispatchEvent(
                new WheelEvent('wheel', {
                    deltaX: e.deltaX,
                    deltaY: e.deltaY,
                    deltaZ: e.deltaZ,
                    deltaMode: e.deltaMode,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    cancelable: true,
                })
            )
        }
        // Non-passive so preventDefault() works (React's onWheel is passive).
        root.addEventListener('wheel', forwardWheel, {passive: false})
        return () => root.removeEventListener('wheel', forwardWheel)
    }, [])

    const hasBlocks = !!grid && !!grid.blockInfos && grid.blockInfos.length > 0
    // Root is always mounted (so the wheel-forwarding ref/effect stay stable);
    // the overlay children render only once a grid is available.
    return (
        <div
            ref={rootRef}
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
            }}
        >
            {hasBlocks && grid && (
                <BlockInterfaceComponent
                    grid={grid}
                    canvasStartX={canvasStartX}
                    canvasStartY={canvasStartY}
                />
            )}
            {grid && (
                <CraftInteractionComponent
                    grid={grid}
                    activeSheet={activeSheet}
                />
            )}
            {grid && (
                <CommentLayer
                    grid={grid}
                    activeSheet={activeSheet}
                    canvasStartX={canvasStartX}
                    canvasStartY={canvasStartY}
                />
            )}
            {grid && (
                <DataValidationOverlay grid={grid} activeSheet={activeSheet} />
            )}
            {grid && <TraceLayer grid={grid} activeSheet={activeSheet} />}
        </div>
    )
}
