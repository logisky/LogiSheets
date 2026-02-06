/**
 * Object Pool for managing reusable objects.
 * This improves performance by avoiding frequent object creation/destruction.
 */
import type { CellView } from "./view_manager";
import { RenderCell } from "./render";
import { Range, StandardCell, StandardStyle, StandardValue } from "./standable";
export declare class Pool {
    getRenderCell(): RenderCell;
    releaseRenderCell(c: RenderCell): void;
    getRange(): Range;
    releaseRange(r: Range): void;
    getStandardValue(): StandardValue;
    releaseStandardValue(v: StandardValue): void;
    getStandardStyle(): StandardStyle;
    releaseStandardStyle(s: StandardStyle): void;
    getStandardCell(): StandardCell;
    releaseStandardCell(c: StandardCell): void;
    releaseCellView(v: CellView): void;
    private _renderCells;
    private _ranges;
    private _standardCells;
    private _standardValues;
    private _standardStyles;
    private _cellViews;
}
