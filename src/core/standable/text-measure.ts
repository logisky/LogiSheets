/**
 * Text measurement utility
 */

let canvasContext:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null

/**
 * Measure text dimensions using a canvas context.
 */
export function measureText(text: string, font: string): TextMetrics {
    const dpr = window.devicePixelRatio || 1

    const hasDocument =
        typeof document !== 'undefined' &&
        typeof document.createElement === 'function'

    // Use cached canvas context for better performance
    if (!canvasContext) {
        if (hasDocument) {
            const canvas = document.createElement('canvas')
            canvas.width = 100 * dpr
            canvas.height = 100 * dpr
            canvasContext = canvas.getContext('2d')
        } else {
            canvasContext = new OffscreenCanvas(100, 100).getContext('2d')
        }
        // Exactly match main canvas setup for consistent measurement
        if (canvasContext) {
            canvasContext.scale(dpr, dpr)
        }
    }
    if (!canvasContext) return {width: text.length * 8} as TextMetrics

    canvasContext.font = font
    return canvasContext.measureText(text)
}
