/**
 * Standard data classes for the worker.
 * These are simplified versions of the classes from the original codebase.
 */
import type { Value, Style, Font, RowInfo, ColInfo, Color, CtFontName, CtUnderlineProperty, Border, Fill, CtCellProtection, Alignment, MergeCell } from "logisheets-web";
export declare function ptToPx(pt: number): number;
export declare function pxToPt(px: number): number;
export declare function widthToPx(w: number): number;
export declare function pxToWidth(px: number): number;
export declare function shallowCopy(curr: any, target: any): void;
export declare class Range {
    static fromMergeCell(mergeCell: MergeCell): Range;
    get width(): number;
    get height(): number;
    get startRow(): number;
    get startCol(): number;
    get endRow(): number;
    get endCol(): number;
    setStartRow(startRow: number): this;
    setStartCol(startCol: number): this;
    setEndRow(endRow: number): this;
    setEndCol(endCol: number): this;
    reset(): void;
    cover(range: Range): boolean;
    equals(other: Range): boolean;
    private _startRow;
    private _startCol;
    private _endRow;
    private _endCol;
}
export declare class StandardColor {
    static fromRgb(rgb: string): StandardColor;
    static fromCtColor(color?: Color): StandardColor;
    static from(r: number, g: number, b: number, a?: number): StandardColor;
    css(): string;
    rgb(): string;
    setAlpha(alpha: number): void;
    private _red?;
    private _green?;
    private _blue?;
    private _alpha;
    private _valid;
}
export type FontSizeUnit = "px" | "pt";
export declare class StandardFont implements Font {
    static from(font: Font): StandardFont;
    get size(): number;
    name: CtFontName;
    underline?: CtUnderlineProperty;
    fontSizeUnit: FontSizeUnit;
    lineHeight: string;
    standardColor: StandardColor;
    bold: boolean;
    sz: number;
    condense: boolean;
    italic: boolean;
    outline: boolean;
    shadow: boolean;
    strike: boolean;
    extend: boolean;
    toCssFont(): string;
}
export declare class StandardStyle implements Style {
    protection: CtCellProtection;
    border: Border;
    font: Font;
    fill: Fill;
    alignment: Alignment;
    formatter: string;
    from(style: Style): this;
    getFont(): StandardFont;
}
export declare class StandardValue {
    cellValueOneof?: {
        $case: "str";
        str: string;
    } | {
        $case: "number";
        number: number;
    } | {
        $case: "bool";
        bool: boolean;
    } | {
        $case: "error";
        error: string;
    };
    get value(): string | number | boolean;
    get valueStr(): string;
    from(value: Value): this;
}
export declare class StandardCell {
    style?: StandardStyle;
    value?: StandardValue;
    formula: string;
    diyCellId?: number;
    blockId?: number;
    setStyle(style?: StandardStyle): void;
    getFormattedText(): string;
    getText(): string;
    getNumber(): number | undefined;
}
export declare class StandardRowInfo implements RowInfo {
    readonly idx: number;
    constructor(idx: number);
    height: number;
    hidden: boolean;
    get pt(): number;
    get px(): number;
    static from(rowInfo: RowInfo): StandardRowInfo;
}
export declare class StandardColInfo implements ColInfo {
    readonly idx: number;
    constructor(idx: number);
    hidden: boolean;
    width: number;
    get px(): number;
    get pt(): number;
    static from(colInfo: ColInfo): StandardColInfo;
}
