import { BaseInfo } from '../cursor';
import { useLocalStore } from 'mobx-react';
import { Text, Selection } from '../defs';
import { getNewSize, getTwoDimensionalTexts } from './input';
import { KeyboardEventCode, StandardKeyboardEvent } from '@/core/events';
import { MouseEvent, RefObject, useEffect, useRef, useState } from 'react';
import { autorun, reaction, runInAction } from 'mobx';
import { textareaStore } from '../stores';
import { InternalTextareaStore, internalTextareaStore } from './store';
import { CanvasAttr, PainterService } from '@/core/painter';

export const useCursor = (selectionEl: RefObject<HTMLCanvasElement>) => {
  const textarea = useLocalStore(() => textareaStore);
  const context = textarea.context;
  const store = useLocalStore(() => internalTextareaStore);
  const _painterSvc = new PainterService();

  const _startCursor = useRef<BaseInfo>();

  useEffect(() => {
    reaction(
      () => ({ editing: textarea.editing, context: textarea.context }),
      (data) => {
        if (!data.editing) {
          runInAction(() => {
            store.showCursor = false;
          });
        } else {
          const position = getCursorInfoByPosition(
            data.context.textareaOffsetX,
            data.context.textareaOffsetY
          );
          store.setCursor({
            showCursor: true,
            curosrColumn: position.column,
            cursorHeight: data.context.cellHeight,
            cursorLineNumber: position.lineNumber,
            cursorX: position.x,
            cursorY: position.y
          });
        }
      }
    );
  });

  useEffect(() => {
    if (!selectionEl.current) return;
    initSelection(selectionEl.current);
  }, [selectionEl.current]);

  // 将单元格内输入内容拉平成一行之后，算cursor的位置
  const getCursorInOneLine = () => {
    const texts = getTwoDimensionalTexts(store.texts);
    let result = 0;
    const { cursorLineNumber: lineNumber, curosrColumn: column } = store;
    texts.forEach((eachLine, line) => {
      if (line > lineNumber) return;
      if (line < lineNumber) {
        const length = eachLine.reduce((a, b) => a + b.char.length, 0);
        result += length;
      } else result += column;
    });
    return result;
  };
  const getCursorInfoByOneLineCoordinate = (cursor: number) => {
    const texts = getTwoDimensionalTexts(store.texts);
    let currIndex = 0;
    let lineNumber = 0,
      column = 0;
    for (let line = 0; line < texts.length; line++) {
      const eachLine = texts[line];
      const lineLength = eachLine.reduce((a, b) => a + b.char.length, 0);
      const index = lineLength + currIndex;
      if (index < cursor) {
        currIndex += lineLength;
        continue;
      } else if (index >= cursor) {
        lineNumber = line;
        column = cursor - currIndex;
        break;
      } else return;
    }
    return getCursorInfoByCoordinate(lineNumber, column);
  };
  // 根据坐标获取光标的pixel位置
  const getCursorInfoByCoordinate = (line: number, column: number) => {
    const baseInfo = new BaseInfo();
    baseInfo.column = column;
    baseInfo.lineNumber = line;
    baseInfo.y = line * context.lineHeight();
    const texts = getTwoDimensionalTexts(store.texts);
    let x = 0;
    for (let i = 0; i < texts[line].length && i < column; i++) {
      x += texts[line][i].width();
    }
    baseInfo.x = x;
    return baseInfo;
  };
  /**
   * 如果offsetX为-1，则cursorX为当前行的最后
   * 如果offsetY为-1，则cursorY为最后一行
   */
  const getCursorInfoByPosition = (offsetX: number, offsetY: number) => {
    const lineNumber = Math.floor(offsetY / context.lineHeight());
    const baseInfo = new BaseInfo();
    baseInfo.lineNumber = lineNumber;
    baseInfo.y = lineNumber * context.lineHeight();
    const texts = getTwoDimensionalTexts(store.texts);
    if (texts.length === 0) return baseInfo;
    if (offsetY === -1) baseInfo.y = (texts.length - 1) * context.lineHeight();
    let currLineTexts = texts[lineNumber];
    if (currLineTexts === undefined) {
      const l = texts.length - 1;
      baseInfo.lineNumber = l;
      baseInfo.y = l * context.lineHeight();
      currLineTexts = texts[l];
    }
    if (offsetX === -1) {
      let x = 0;
      currLineTexts.forEach((t) => {
        x += t.width();
      });
      baseInfo.x = x;
      baseInfo.column = currLineTexts.length;
      return baseInfo;
    }
    let column = 0;
    let x = 0;
    for (let i = 0; i < currLineTexts.length; i += 1) {
      const t = currLineTexts[i];
      if (t === undefined) continue;
      if (t.width() + x >= offsetX) {
        const half = t.width() / 2;
        if (x + half >= offsetX) column = i;
        else {
          column = i + 1;
          x += t.width();
        }
        break;
      }
      x += t.width();
      column = i + 1;
    }
    baseInfo.column = column;
    baseInfo.x = x;
    return baseInfo;
  };
  const type = (added: readonly Text[], removed: readonly Text[]) => {
    let x = store.cursorX;
    let y = store.cursorY;
    const [maxWidth] = getNewSize(store.texts, textarea.context.lineHeight());
    removed.forEach((t) => {
      if (t.isEof) {
        y -= context.lineHeight();
        x = maxWidth;
        return;
      }
      x -= t.width();
    });
    added.forEach((t) => {
      if (t.isEof) {
        y += context.lineHeight();
        x = 0;
        return;
      }
      x += t.width();
    });
    _update(getCursorInfoByPosition(x, y));
    _resetSelection();
  };

  const keydown = (e: StandardKeyboardEvent) => {
    const {
      cursorX,
      cursorY,
      cursorLineNumber: lineNumber,
      curosrColumn: column
    } = store;
    const texts = getTwoDimensionalTexts(store.texts);
    if (e.keyCodeId === KeyboardEventCode.ARROW_RIGHT) {
      const next = texts[lineNumber][column];
      if (next === undefined) return;
      const newCursor = getCursorInfoByPosition(
        cursorX + next.width(),
        cursorY
      );
      if (newCursor.x === cursorX) return;
      _update(newCursor);
    } else if (e.keyCodeId === KeyboardEventCode.ARROW_LEFT) {
      if (column === 0) return;
      const last = texts[lineNumber][column - 1];
      const newCursor = getCursorInfoByPosition(
        cursorX - last.width(),
        cursorY
      );
      if (newCursor.x === cursorX) return;
      _update(newCursor);
    } else if (e.keyCodeId === KeyboardEventCode.ARROW_DOWN) {
      const next = texts[lineNumber + 1];
      if (next === undefined) return;
      const newCursor = getCursorInfoByPosition(
        cursorX,
        cursorY + context.lineHeight()
      );
      _update(newCursor);
    } else if (e.keyCodeId === KeyboardEventCode.ARROW_UP) {
      if (lineNumber === 0) return;
      const newCursor = getCursorInfoByPosition(
        cursorX,
        cursorY - context.lineHeight()
      );
      _update(newCursor);
    } else if (e.keyCodeId === KeyboardEventCode.ENTER) blur();
    else if (e.keyCodeId === KeyboardEventCode.ESCAPE) blur();
    if (e.isKeyBinding) return;
    _painterSvc.clear();
    _resetSelection();
  };

  const focus = () => {
    _update();
  };

  const blur = () => {
    const resetCursor = new BaseInfo();
    _update(resetCursor);
  };

  const mousedown = (e: MouseEvent) => {
    const [x, y] = context.getOffset(e.clientX, e.clientY);
    const cursor = getCursorInfoByPosition(x, y);
    _update(cursor);
    _startCursor.current = cursor;
    _resetSelection();
  };
  const setCursor = (cursor: number) => {
    const cursorInfo = getCursorInfoByOneLineCoordinate(cursor);
    _update(cursorInfo);
  };
  const _update = (_cursor?: BaseInfo) => {
    if (_cursor !== undefined) {
      runInAction(() => {
        store.showCursor = true;
        store.cursorX = _cursor.x;
        store.cursorY = _cursor.y;
      });
    }
  };

  // selection

  const initSelection = (canvas: HTMLCanvasElement) => {
    _painterSvc.setupCanvas(canvas, 0, 0);
    _resetSelection();
  };

  const _resetSelection = () => {
    runInAction(() => {
      store.selection = new Selection();
      _drawSelection();
    });
  };

  const mousemove = (e: MouseEvent) => {
    const [x, y] = context.getOffset(e.clientX, e.clientY);
    let curr = getCursorInfoByPosition(x, y);
    const startCursor = _startCursor.current;
    if (!curr || !startCursor) return;
    if (startCursor.biggerThan(curr)) {
      const tmp = curr;
      curr = startCursor;
      _startCursor.current = tmp;
    }
    const selection = new Selection();
    selection.startX = startCursor.x;
    selection.startY = startCursor.y;
    selection.startColumn = startCursor.column;
    selection.startLineNumber = startCursor.lineNumber;
    selection.endX = curr.x;
    selection.endY = curr.y;
    selection.endColumn = curr.column;
    selection.endLineNumber = curr.lineNumber;
    if (!curr.equal(startCursor)) {
      runInAction(() => {
        store.selection = selection;
      });
      _drawSelection();
    }
  };

  const getSelection = () => {
    const sel = store.selection;
    if (
      sel.startColumn === sel.endColumn &&
      sel.startLineNumber === sel.endLineNumber
    )
      return;
    return sel;
  };

  const _drawSelection = () => {
    const selection = getSelection();
    if (selection === undefined) return;
    const [totalWidth, totalHeight] = getNewSize(
      store.texts,
      textarea.context.lineHeight()
    );
    _painterSvc.setupCanvas(undefined, totalWidth, totalHeight);
    _painterSvc.save();
    const selAttr = new CanvasAttr();
    selAttr.fillStyle = 'rgba(0,0,0,0.38)';
    _painterSvc.attr(selAttr);
    const height = context.lineHeight();
    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;
    if (startLine === endLine) {
      const x = selection.startX;
      const y = selection.startY;
      const width = selection.endX - x;
      _painterSvc.fillRect(x, y, width, height);
      return;
    }
    for (let i = startLine; i <= endLine; i += 1) {
      let x = 0;
      const y = selection.startY + (i - startLine) * height;
      let width = 0;
      if (i === startLine) {
        x = selection.startX;
        width = totalWidth - selection.startX;
      } else {
        x = 0;
        width = i === endLine ? selection.endX : totalWidth;
      }
      _painterSvc.fillRect(x, y, width, height);
    }
    _painterSvc.restore();
  };
  _drawSelection();
};

// 将单元格内输入内容拉平成一行之后，算cursor的位置
export const getCursorInOneLine = (store: InternalTextareaStore) => {
  const texts = getTwoDimensionalTexts(store.texts);
  let result = 0;
  const { cursorLineNumber: lineNumber, curosrColumn: column } = store;
  texts.forEach((eachLine, line) => {
    if (line > lineNumber) return;
    if (line < lineNumber) {
      const length = eachLine.reduce((a, b) => a + b.char.length, 0);
      result += length;
    } else result += column;
  });
  return result;
};
