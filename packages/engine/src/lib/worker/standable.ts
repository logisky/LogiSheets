/**
 * Standard data classes for the worker.
 * These are simplified versions of the classes from the original codebase.
 */

import type {
  Value,
  Style,
  Font,
  RowInfo,
  ColInfo,
  Color,
  CtFontName,
  CtUnderlineProperty,
  Border,
  Fill,
  CtCellProtection,
  Alignment,
  PatternFill,
  MergeCell,
} from "logisheets-web";
import * as SSF from "ssf";

// ============================================================================
// Unit Conversion Functions
// ============================================================================

const DEFAULT_PPI = 96;
const PPI = DEFAULT_PPI;

export function ptToPx(pt: number): number {
  return Math.round(((pt * PPI) / 72) * 100) / 100;
}

export function pxToPt(px: number): number {
  return Math.round(((px * 72) / PPI) * 100) / 100;
}

export function widthToPx(w: number): number {
  return w * 7;
}

export function pxToWidth(px: number): number {
  return px / 7;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function shallowCopy(curr: any, target: any): void {
  if (typeof curr !== "object" || typeof target !== "object") return;
  for (const key in curr) {
    if (Object.prototype.hasOwnProperty.call(curr, key)) {
      target[key] = curr[key];
    }
  }
}

// ============================================================================
// Range Class
// ============================================================================

export class Range {
  static fromMergeCell(mergeCell: MergeCell): Range {
    return new Range()
      .setEndCol(mergeCell.endCol)
      .setStartCol(mergeCell.startCol)
      .setEndRow(mergeCell.endRow)
      .setStartRow(mergeCell.startRow);
  }

  get width(): number {
    return this._endCol - this._startCol;
  }

  get height(): number {
    return this._endRow - this._startRow;
  }

  get startRow(): number {
    return this._startRow;
  }

  get startCol(): number {
    return this._startCol;
  }

  get endRow(): number {
    return this._endRow;
  }

  get endCol(): number {
    return this._endCol;
  }

  setStartRow(startRow: number): this {
    this._startRow = startRow;
    return this;
  }

  setStartCol(startCol: number): this {
    this._startCol = startCol;
    return this;
  }

  setEndRow(endRow: number): this {
    this._endRow = endRow;
    return this;
  }

  setEndCol(endCol: number): this {
    this._endCol = endCol;
    return this;
  }

  reset(): void {
    this.setEndCol(0).setEndRow(0).setStartCol(0).setStartRow(0);
  }

  cover(range: Range): boolean {
    return (
      this._startRow <= range._startRow &&
      this._startCol <= range._startCol &&
      this._endRow >= range._endRow &&
      this._endCol >= range._endCol
    );
  }

  equals(other: Range): boolean {
    return (
      other._startRow === this._startRow &&
      other._startCol === this._startCol &&
      other._endCol === this._endCol &&
      other._endRow === this._endRow
    );
  }

  private _startRow = 0;
  private _startCol = 0;
  private _endRow = 0;
  private _endCol = 0;
}

// ============================================================================
// StandardColor Class
// ============================================================================

const ALPHA = 255;

export class StandardColor {
  static fromRgb(rgb: string): StandardColor {
    const color = new StandardColor();
    if (rgb === "") return color;
    color._red = parseInt(rgb.slice(0, 2), 16);
    color._green = parseInt(rgb.slice(2, 4), 16);
    color._blue = parseInt(rgb.slice(4, 6), 16);
    return color;
  }

  static fromCtColor(color?: Color): StandardColor {
    if (color === undefined) {
      return new StandardColor();
    }
    const result = new StandardColor();
    result._red = color.red;
    result._green = color.green;
    result._blue = color.blue;
    if (color.alpha) result._alpha = color.alpha;
    return result;
  }

  static from(r: number, g: number, b: number, a = 1): StandardColor {
    const color = new StandardColor();
    color._red = r;
    color._green = g;
    color._blue = b;
    color._alpha = ALPHA * a;
    return color;
  }

  css(): string {
    const alpha = this._alpha / ALPHA;
    if (!this._valid()) return "transparent";
    return `rgba(${this._red}, ${this._green}, ${this._blue}, ${alpha})`;
  }

  rgb(): string {
    if (!this._valid()) return "";
    const transfer = (num: number) => num.toString(16).padStart(2, "0");
    const r = transfer(this._red ?? 0);
    const g = transfer(this._green ?? 0);
    const b = transfer(this._blue ?? 0);
    return `${r}${g}${b}`;
  }

  setAlpha(alpha: number): void {
    this._alpha = alpha;
  }

  private _red?: number;
  private _green?: number;
  private _blue?: number;
  private _alpha = ALPHA;

  private _valid(): boolean {
    return (
      this._red !== undefined &&
      this._green !== undefined &&
      this._blue !== undefined
    );
  }
}

// ============================================================================
// StandardFont Class
// ============================================================================

const DEFAULT_FONT_SIZE = 10;

export type FontSizeUnit = "px" | "pt";

export class StandardFont implements Font {
  static from(font: Font): StandardFont {
    const f = new StandardFont();
    if (font.color === null) f.standardColor = StandardColor.from(0, 0, 0);
    else f.standardColor = StandardColor.fromCtColor(font.color);
    shallowCopy(font, f);
    f.fontSizeUnit = "pt";
    if (font.sz === 0) {
      f.fontSizeUnit = "px";
      f.sz = DEFAULT_FONT_SIZE;
    }
    return f;
  }

  get size(): number {
    return this.sz;
  }

  name: CtFontName = { val: "Arial" };
  underline?: CtUnderlineProperty;
  fontSizeUnit: FontSizeUnit = "px";
  lineHeight = "100%";
  standardColor = StandardColor.from(0, 0, 0, 1);
  bold = false;
  sz = 10;
  condense = false;
  italic = false;
  outline = false;
  shadow = false;
  strike = false;
  extend = false;

  toCssFont(): string {
    const fontStyle = this.italic ? "italic" : "normal";
    const fontVariant = "normal";
    const fontWeight = this.bold ? "bold" : "normal";
    const fontSize = `${this.size}${this.fontSizeUnit}`;
    const fontFamily = this.name;
    const lineHeight = this.lineHeight;
    return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily.val}`;
  }
}

// ============================================================================
// StandardStyle Class
// ============================================================================

export class StandardStyle implements Style {
  protection!: CtCellProtection;
  border!: Border;
  font!: Font;
  fill!: Fill;
  alignment!: Alignment;
  formatter = "";

  from(style: Style): this {
    shallowCopy(style, this);
    return this;
  }

  getFont(): StandardFont {
    if (!this.font) return new StandardFont();
    return StandardFont.from(this.font);
  }
}

// ============================================================================
// StandardValue Class
// ============================================================================

export class StandardValue {
  cellValueOneof?:
    | { $case: "str"; str: string }
    | { $case: "number"; number: number }
    | { $case: "bool"; bool: boolean }
    | { $case: "error"; error: string };

  get value(): string | number | boolean {
    if (this.cellValueOneof?.$case === "str") return this.cellValueOneof.str;
    else if (this.cellValueOneof?.$case === "bool")
      return this.cellValueOneof.bool;
    else if (this.cellValueOneof?.$case === "error")
      return this.cellValueOneof.error;
    else if (this.cellValueOneof?.$case === "number")
      return this.cellValueOneof.number;
    else return "";
  }

  get valueStr(): string {
    return this.value.toString();
  }

  from(value: Value): this {
    if (value === "empty") {
      this.cellValueOneof = undefined;
      return this;
    }
    if (value.type === "str")
      this.cellValueOneof = { $case: "str", str: value.value as string };
    else if (value.type === "bool")
      this.cellValueOneof = { $case: "bool", bool: value.value as boolean };
    else if (value.type === "number")
      this.cellValueOneof = {
        $case: "number",
        number: value.value as number,
      };
    else if (value.type === "error")
      this.cellValueOneof = { $case: "error", error: value.value as string };
    return this;
  }
}

// ============================================================================
// StandardCell Class
// ============================================================================

export class StandardCell {
  style?: StandardStyle;
  value?: StandardValue;
  formula = "";
  diyCellId?: number;
  blockId?: number;

  setStyle(style?: StandardStyle): void {
    this.style = style;
  }

  getFormattedText(): string {
    const num = this.getNumber();
    if (num !== undefined) {
      const fmt = this.style?.formatter ?? "";
      // No format string (or 'general' which ssf interprets identically
      // to no format) → fall back to default JS stringification so we
      // don't accidentally show extra precision or scientific notation.
      if (fmt && fmt.toLowerCase() !== "general") {
        try {
          return SSF.format(fmt, num);
        } catch {
          return String(num);
        }
      }
      return String(num);
    }
    return this.getText();
  }

  getText(): string {
    return this.value?.valueStr ?? "";
  }

  getNumber(): number | undefined {
    if (this.value?.cellValueOneof?.$case === "number")
      return this.value?.cellValueOneof.number;
    return undefined;
  }
}

// ============================================================================
// StandardRowInfo Class
// ============================================================================

const DEFAULT_CELL_HEIGHT = 25;

export class StandardRowInfo implements RowInfo {
  constructor(public readonly idx: number) {}
  height = DEFAULT_CELL_HEIGHT;
  hidden = false;

  get pt(): number {
    return this.height;
  }

  get px(): number {
    return ptToPx(this.height);
  }

  static from(rowInfo: RowInfo): StandardRowInfo {
    const rInfo = new StandardRowInfo(rowInfo.idx);
    shallowCopy(rowInfo, rInfo);
    return rInfo;
  }
}

// ============================================================================
// StandardColInfo Class
// ============================================================================

const DEFAULT_CELL_WIDTH = 6;

export class StandardColInfo implements ColInfo {
  constructor(public readonly idx: number) {}
  hidden = false;
  width = DEFAULT_CELL_WIDTH;

  get px(): number {
    return widthToPx(this.width);
  }

  get pt(): number {
    return this.width;
  }

  static from(colInfo: ColInfo): StandardColInfo {
    const cInfo = new StandardColInfo(colInfo.idx);
    shallowCopy(colInfo, cInfo);
    return cInfo;
  }
}
