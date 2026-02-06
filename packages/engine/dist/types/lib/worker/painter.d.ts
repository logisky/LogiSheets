/**
 * Painter - handles canvas rendering operations.
 */
import type { CellView } from "./view_manager";
import type { AppropriateHeight } from "./types";
import { RenderCell } from "./render";
export declare class Painter {
    private _canvas?;
    private _ctx?;
    private _showWatermark;
    setCanvas(canvas: OffscreenCanvas): void;
    setShowWatermark(show: boolean): void;
    render(resp: CellView, anchorX: number, anchorY: number): void;
    getAppropriateHeights(resp: CellView, anchorX: number, anchorY: number): AppropriateHeight[];
    renderContent(resp: CellView, anchorX: number, anchorY: number): void;
    renderCell(renderCell: RenderCell, anchorX: number, anchorY: number, render?: boolean): number;
    renderMergeCells(resp: CellView, anchorX: number, anchorY: number): void;
    renderGrid(data: CellView, anchorX: number, anchorY: number): void;
    private _borderLine;
    private _fill;
    private _text;
    private renderWatermark;
}
