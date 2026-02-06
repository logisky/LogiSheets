/**
 * BorderHelper is used to generate the continuous borders. Drawing borders
 * cell by cell will make the borders discontinuous.
 */
import type { BorderPr } from "logisheets-web";
import type { CellView } from "./view_manager";
export interface BorderSegment {
    pr: BorderPr | undefined;
    from: number;
    to: number;
    start: number;
    coordinateX: number;
    coordinateY: number;
}
export declare class BorderHelper {
    private readonly _data;
    private _rowBorderStore;
    private _colBorderStore;
    constructor(_data: CellView);
    generateRowBorder(r: number): BorderSegment[];
    generateColBorder(c: number): BorderSegment[];
    private _setRowBorder;
    private _setColBorder;
}
