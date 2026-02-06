/**
 * RenderCell - represents a cell with position and coordinate information for rendering.
 */
import type { CellInfo } from "logisheets-web";
import { Range, StandardCell, StandardStyle, StandardValue } from "./standable";
export declare class RenderCell {
    get width(): number;
    get height(): number;
    setCoordinate(coordinate: Range): this;
    setPosition(position: Range): this;
    setInfo(info: CellInfo, getStandardCell: () => StandardCell, getStandardValue: () => StandardValue, getStandardStyle: () => StandardStyle): this;
    setStandardCell(info?: StandardCell): this;
    setSkipRender(skip: boolean): this;
    reset(): void;
    hidden: boolean;
    /** start/end row/col index */
    coordinate: Range;
    /** start/end row/col pixel distance (position in the whole sheet) */
    position: Range;
    info?: StandardCell;
    skipRender: boolean;
    cover(cell: RenderCell): boolean;
    equals(cell: RenderCell): boolean;
}
