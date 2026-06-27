/**
 * Object Pool for managing reusable objects.
 * This improves performance by avoiding frequent object creation/destruction.
 */

import type { CellView } from "./view_manager";
import { RenderCell } from "./render";
import { Range, StandardCell, StandardStyle, StandardValue } from "./standable";

const RENDER_CELL_COUNT = 5000;
const RANGE_COUNT = 6000;
const CACHE_NUMBER = 2;

export class Pool {
  getRenderCell(): RenderCell {
    if (this._renderCells.length > 0) {
      return this._renderCells.pop() as RenderCell;
    }
    return new RenderCell();
  }

  releaseRenderCell(c: RenderCell): void {
    c.reset();
    this.releaseRange(c.position);
    this.releaseRange(c.coordinate);
    if (c.info) {
      this.releaseStandardCell(c.info);
    }
    this._renderCells.push(c);
  }

  getRange(): Range {
    if (this._ranges.length > 0) return this._ranges.pop() as Range;
    return new Range();
  }

  releaseRange(r: Range): void {
    r.reset();
    this._ranges.push(r);
  }

  getStandardValue(): StandardValue {
    if (this._standardValues.length > 0) {
      return this._standardValues.pop() as StandardValue;
    }
    return new StandardValue();
  }

  releaseStandardValue(v: StandardValue): void {
    v.cellValueOneof = undefined;
    this._standardValues.push(v);
  }

  getStandardStyle(): StandardStyle {
    if (this._standardStyles.length > 0) {
      return this._standardStyles.pop() as StandardStyle;
    }
    return new StandardStyle();
  }

  releaseStandardStyle(s: StandardStyle): void {
    this._standardStyles.push(s);
  }

  getStandardCell(): StandardCell {
    if (this._standardCells.length > 0) {
      return this._standardCells.pop() as StandardCell;
    }
    return new StandardCell();
  }

  releaseStandardCell(c: StandardCell): void {
    if (c.value) this.releaseStandardValue(c.value);
    if (c.style) this.releaseStandardStyle(c.style);
    this._standardCells.push(c);
  }

  releaseCellView(v: CellView): void {
    if (this._cellViews.length >= CACHE_NUMBER) {
      const cellView = this._cellViews.pop() as CellView;
      cellView.rows.forEach((c) => {
        this.releaseRenderCell(c);
      });
      cellView.cols.forEach((c) => {
        this.releaseRenderCell(c);
      });
      cellView.cells.forEach((c) => {
        this.releaseRenderCell(c);
      });
    }
    this._cellViews.push(v);
  }

  private _renderCells = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new RenderCell(),
  );

  private _ranges = Array.from({ length: RANGE_COUNT }, () => new Range());
  private _standardCells = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new StandardCell(),
  );
  private _standardValues = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new StandardValue(),
  );
  private _standardStyles = Array.from(
    { length: RENDER_CELL_COUNT },
    () => new StandardStyle(),
  );

  private _cellViews: CellView[] = [];
}
