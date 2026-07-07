/**
 * Painter - handles canvas rendering operations.
 */

import type { PatternFill, BorderPr } from "logisheets-web";
import type { CellView } from "./view_manager";
import type { AppropriateHeight } from "./types";
import { RenderCell } from "./render";
import {
  Range,
  StandardColor,
  StandardStyle,
  StandardCell,
  StandardFont,
} from "./standable";
import { BorderHelper } from "./border_helper";

// ============================================================================
// Helper Functions
// ============================================================================

// Canvas context is already scaled by DPR upstream (ctx.scale(dpr, dpr)),
// so all drawing uses CSS pixel coordinates directly.
function thinLineWidth(): number {
  return 0.5;
}

// ============================================================================
// Canvas Attribute Classes
// ============================================================================

class CanvasAttr {
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;
  font?: StandardFont;
}

class Box {
  position = new Range();

  get width(): number {
    return this.position.endCol - this.position.startCol;
  }

  get height(): number {
    return this.position.endRow - this.position.startRow;
  }

  textX(horizontal?: string): [number, CanvasTextAlign] {
    const { startCol, endCol } = this.position;
    switch (horizontal) {
      case "center":
        return [(startCol + endCol) / 2, "center"];
      case "right":
        return [endCol - 2, "end"];
      case "left":
      case "general":
      default:
        return [startCol + 2, "start"];
    }
  }

  textY(vertical?: string): [number, CanvasTextBaseline] {
    const { startRow, endRow } = this.position;
    switch (vertical) {
      case "top":
        return [startRow + 2, "top"];
      case "bottom":
        return [endRow - 2, "bottom"];
      case "center":
      default:
        return [(startRow + endRow) / 2, "middle"];
    }
  }
}

// Excel's "general" horizontal alignment, derived from the cell value
// type: numbers right, booleans/errors centered, everything else (text,
// empty) left.
function defaultHorizontalAlign(info: StandardCell): string {
  switch (info.value?.cellValueOneof?.$case) {
    case "number":
      return "right";
    case "bool":
    case "error":
      return "center";
    default:
      return "left";
  }
}

// ============================================================================
// Painter Class
// ============================================================================

export class Painter {
  private _canvas?: OffscreenCanvas;
  private _ctx?: OffscreenCanvasRenderingContext2D;

  public setCanvas(canvas: OffscreenCanvas): void {
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d") ?? undefined;
  }

  public render(resp: CellView, anchorX: number, anchorY: number): void {
    if (!this._ctx) return;
    this._ctx.save();
    this.renderContent(resp, anchorX, anchorY);
    this.renderMergeCells(resp, anchorX, anchorY);
    this.renderGrid(resp, anchorX, anchorY);
    this._ctx.restore();
  }

  public getAppropriateHeights(
    resp: CellView,
    anchorX: number,
    anchorY: number,
  ): AppropriateHeight[] {
    const heights = Array.from({ length: resp.rows.length }, () => ({
      height: 0,
      row: 0,
      col: 0,
    }));
    resp.cells.forEach((cell) => {
      if (cell.skipRender) return;
      const height = this.renderCell(cell, anchorX, anchorY, false);
      const { startRow } = cell.coordinate;
      const row = startRow - resp.rows[0].coordinate.startRow;
      if (heights[row].height < height) {
        heights[row].height = height;
        heights[row].col = cell.coordinate.startCol;
        heights[row].row = cell.coordinate.startRow;
      }
    });
    return heights;
  }

  public renderContent(resp: CellView, anchorX: number, anchorY: number): void {
    resp.cells.forEach((cell) => {
      if (cell.skipRender) return;
      this.renderCell(cell, anchorX, anchorY);
    });
  }

  public renderCell(
    renderCell: RenderCell,
    anchorX: number,
    anchorY: number,
    render = true,
  ): number {
    const { position, info } = renderCell;
    const style = info?.style;
    const box = new Box();
    box.position = new Range()
      .setEndRow(position.endRow - anchorY)
      .setStartRow(position.startRow - anchorY)
      .setEndCol(position.endCol - anchorX)
      .setStartCol(position.startCol - anchorX);

    if (render) {
      this._fill(box, style);
      if (info) {
        return this._text(box, info);
      }
    } else {
      if (!info) return 0;
      return this._text(box, info, false);
    }
    return 0;
  }

  public renderMergeCells(
    resp: CellView,
    anchorX: number,
    anchorY: number,
  ): void {
    resp.mergeCells.forEach((c) => {
      this.renderCell(c, anchorX, anchorY, true);
    });
  }

  public renderGrid(data: CellView, anchorX: number, anchorY: number): void {
    if (!this._ctx) return;

    const borderHelper = new BorderHelper(data);

    for (let row = data.fromRow; row <= data.toRow; row++) {
      const border = borderHelper.generateRowBorder(row);
      border.forEach((b) => {
        if (!b.pr) return;
        const { start, from, to } = b;
        this._borderLine(
          b.pr,
          true,
          start - anchorY,
          from - anchorX,
          to - anchorX,
        );
      });
    }

    for (let col = data.fromCol; col <= data.toCol; col++) {
      const border = borderHelper.generateColBorder(col);
      border.forEach((b) => {
        if (!b.pr) return;
        this._borderLine(
          b.pr,
          false,
          b.start - anchorX,
          b.from - anchorY,
          b.to - anchorY,
        );
      });
    }
  }

  private _borderLine(
    border: BorderPr,
    horizontal: boolean,
    start: number,
    from: number,
    to: number,
  ): void {
    if (!this._ctx) return;

    const stdColor = StandardColor.fromCtColor(border.color);
    const dot = 1;
    const hair = 0.5;
    const dash = 3;
    const thin = thinLineWidth();
    const medium = 1.5;
    const thick = 3;
    const segments: number[] = [];

    this._ctx.strokeStyle = stdColor.css();
    this._ctx.lineWidth = thin;

    switch (border.style) {
      case "dashed":
        segments.push(dash, dash);
        break;
      case "dashDot":
        segments.push(dash, dot, dot, dot);
        break;
      case "dashDotDot":
        segments.push(dash, dot, dot, dot, dot, dot);
        break;
      case "dotted":
        segments.push(dot, dot);
        break;
      case "hair":
        segments.push(hair, hair);
        break;
      case "medium":
        this._ctx.lineWidth = medium;
        break;
      case "mediumDashed":
        this._ctx.lineWidth = medium;
        segments.push(dash, dash);
        break;
      case "mediumDashDot":
        this._ctx.lineWidth = medium;
        segments.push(dash, dot, dot, dot);
        break;
      case "mediumDashDotDot":
        this._ctx.lineWidth = medium;
        segments.push(dash, dot, dot, dot, dot, dot);
        break;
      case "none":
        return;
      case "slantDashDot":
        return;
      case "thick":
        this._ctx.lineWidth = thick;
        break;
      case "thin":
        this._ctx.lineWidth = thin;
        break;
      default:
        break;
    }

    this._ctx.setLineDash(segments);
    this._ctx.beginPath();
    if (horizontal) {
      this._ctx.moveTo(from, start);
      this._ctx.lineTo(to, start);
    } else {
      this._ctx.moveTo(start, from);
      this._ctx.lineTo(start, to);
    }
    this._ctx.stroke();
    this._ctx.setLineDash([]);
  }

  /**
   * Draw an image inside a cell. Coordinates are canvas (CSS) pixels with the
   * anchor already subtracted. The image is scaled to fit within the cell
   * while preserving its aspect ratio, and centered.
   */
  public renderImage(
    bitmap: ImageBitmap,
    startCol: number,
    startRow: number,
    width: number,
    height: number,
  ): void {
    if (!this._ctx) return;
    if (width <= 0 || height <= 0 || bitmap.width <= 0 || bitmap.height <= 0)
      return;
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const x = startCol + (width - w) / 2;
    const y = startRow + (height - h) / 2;
    this._ctx.drawImage(bitmap, x, y, w, h);
  }

  private _fill(box: Box, style?: StandardStyle): void {
    if (!this._ctx) return;
    const fill = style?.fill;
    if (!fill || !(fill.type === "patternFill")) return;

    const patternFill = fill.value as PatternFill;
    if (patternFill.bgColor) {
      const color = StandardColor.fromCtColor(patternFill.bgColor);
      this._ctx.fillStyle = color.css();
      const { startRow, startCol } = box.position;
      this._ctx.fillRect(startCol, startRow, box.width, box.height);
    }
    if (patternFill.fgColor && patternFill.patternType === "solid") {
      const color = StandardColor.fromCtColor(patternFill.fgColor);
      this._ctx.fillStyle = color.css();
      const { startRow, startCol } = box.position;
      this._ctx.fillRect(startCol, startRow, box.width, box.height);
    }
  }

  private _text(box: Box, info: StandardCell, render = true): number {
    if (!this._ctx) return 0;
    const t = info.getFormattedText();
    if (!t) return 0;

    const font = info.style?.getFont() ?? new StandardFont();
    const alignment = info.style?.alignment;

    // When no explicit horizontal alignment is set (or it's "general"),
    // fall back to Excel's value-type defaults: numbers right-aligned,
    // booleans/errors centered, text left-aligned. For formula cells the
    // computed result type drives this, matching Excel.
    const explicitH = alignment?.horizontal;
    const horizontal =
      explicitH && explicitH !== "general"
        ? explicitH
        : defaultHorizontalAlign(info);

    const [tx, textAlign] = box.textX(horizontal);
    const [ty, textBaseline] = box.textY(alignment?.vertical);

    this._ctx.font = font.toCssFont();
    this._ctx.textAlign = textAlign;
    this._ctx.textBaseline = textBaseline;
    this._ctx.fillStyle = font.standardColor.css();

    if (render) {
      this._ctx.fillText(t, tx, ty);

      // Draw strikethrough line manually (canvas doesn't support text-decoration)
      if (font.strike) {
        const metrics = this._ctx.measureText(t);
        const lineY = ty;
        let lineX = tx;
        if (textAlign === "center") {
          lineX = tx - metrics.width / 2;
        } else if (textAlign === "right") {
          lineX = tx - metrics.width;
        }
        this._ctx.beginPath();
        this._ctx.strokeStyle = font.standardColor.css();
        this._ctx.lineWidth = 1;
        this._ctx.moveTo(lineX, lineY);
        this._ctx.lineTo(lineX + metrics.width, lineY);
        this._ctx.stroke();
      }
    }

    // Return estimated height
    return font.size * 1.3;
  }
}
