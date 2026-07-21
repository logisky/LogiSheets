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

    // Note the `+ 1`: a cell's bottom/right border is stored one slot past the
    // cell (it's the top/left of the next cell), and drawn by the *next*
    // row/col's iteration. Without the extra pass the last visible row's bottom
    // border and last visible column's right border are never drawn.
    for (let row = data.fromRow; row <= data.toRow + 1; row++) {
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

    for (let col = data.fromCol; col <= data.toCol + 1; col++) {
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

    this._ctx.font = font.toCssFont();
    this._ctx.textAlign = textAlign;
    this._ctx.fillStyle = font.standardColor.css();

    const lineHeight = font.size * 1.3;
    const wrap = alignment?.wrapText === true;

    // Wrapped cells break into multiple lines that fit the cell width (and
    // honor any manual `\n`). Unwrapped cells keep the single-line path.
    if (wrap && box.width > 4) {
      const lines = this._wrapText(t, box.width - 4);
      const totalH = lines.length * lineHeight;
      let startY: number;
      switch (alignment?.vertical) {
        case "top":
          startY = box.position.startRow + 2;
          break;
        case "bottom":
          startY = box.position.endRow - 2 - totalH;
          break;
        default:
          startY = (box.position.startRow + box.position.endRow) / 2 - totalH / 2;
          break;
      }
      if (render) {
        this._ctx.save();
        this._clipToBox(box);
        this._ctx.textBaseline = "top";
        lines.forEach((line, i) => {
          this._ctx!.fillText(line, tx, startY + i * lineHeight);
        });
        this._ctx.restore();
      }
      return totalH;
    }

    const [ty, textBaseline] = box.textY(alignment?.vertical);
    this._ctx.textBaseline = textBaseline;

    if (render) {
      // Clip to the cell so overflowing text does not spill into neighbors.
      this._ctx.save();
      this._clipToBox(box);
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
      this._ctx.restore();
    }

    // Return estimated height
    return lineHeight;
  }

  /** Clip the context to a cell's pixel rect (so its text can't overflow). */
  private _clipToBox(box: Box): void {
    if (!this._ctx) return;
    this._ctx.beginPath();
    this._ctx.rect(
      box.position.startCol,
      box.position.startRow,
      box.width,
      box.height,
    );
    this._ctx.clip();
  }

  /**
   * Break `text` into lines that each fit `maxWidth` (canvas px), honoring
   * manual line breaks. Wraps on spaces where possible; a single token wider
   * than the cell is broken by characters (so CJK, which has no spaces, wraps
   * per-character). Requires `this._ctx.font` to already be set.
   */
  private _wrapText(text: string, maxWidth: number): string[] {
    if (!this._ctx) return [text];
    const measure = (s: string) => this._ctx!.measureText(s).width;
    const lines: string[] = [];

    for (const paragraph of text.split("\n")) {
      if (paragraph === "") {
        lines.push("");
        continue;
      }
      const words = paragraph.split(" ");
      let line = "";
      // Place a word into the (empty) current line, breaking it by characters
      // if it alone is wider than the cell.
      const placeFresh = (word: string) => {
        if (measure(word) <= maxWidth) {
          line = word;
          return;
        }
        let chunk = "";
        for (const ch of word) {
          if (chunk !== "" && measure(chunk + ch) > maxWidth) {
            lines.push(chunk);
            chunk = "";
          }
          chunk += ch;
        }
        line = chunk;
      };
      words.forEach((word) => {
        if (line === "") {
          placeFresh(word);
          return;
        }
        const candidate = `${line} ${word}`;
        if (measure(candidate) <= maxWidth) {
          line = candidate;
          return;
        }
        lines.push(line);
        line = "";
        placeFresh(word);
      });
      lines.push(line);
    }
    return lines;
  }
}
