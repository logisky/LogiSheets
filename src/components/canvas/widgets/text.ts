import { useLocalStore } from 'mobx-react';
import { Cell } from '../defs';
import { StandardKeyboardEvent } from '@/core/events';
import { useEffect, useRef } from 'react';
import { SheetService } from '@/core/data';
import { useInjection } from '@/core/ioc/provider';
import { TYPES } from '@/core/ioc/types';
import { canvasStore as _canvasStore, canvasStore } from '../store';
import { selectorStore } from '@/components/selector';
import { Context, textareaStore } from '@/components/textarea';
import { runInAction } from 'mobx';

export const useText = () => {
  const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet);
  const selector = useLocalStore(() => selectorStore);
  const currText = useRef('');
  const textarea = useLocalStore(() => textareaStore);
  const host = useLocalStore(() => canvasStore);

  const _lastMousedownInfo = useRef<{ time: number; cell: Cell }>({
    time: 0,
    cell: new Cell()
  });

  useEffect(() => {
    const sub = host.obs().subscribe((data) => {
      if (data.type === 'blur') textarea.reset();
      else if (data.type === 'type') currText.current = data.args;
      else if (data.type === 'input') {
      } else if (data.type === 'mousedown') {
        const { e, cell } = data.args;
        mousedown(e, cell);
      }
    });
    return () => {
      sub.unsubscribe();
    };
  }, []);

  const mousedown = (e: KeyboardEvent, startCell = new Cell()) => {
    const now = Date.now();
    const editing = now - _lastMousedownInfo.current.time < 300;
    const lastStartCell = _lastMousedownInfo.current.cell;
    _lastMousedownInfo.current = { time: now, cell: startCell };
    const standardEvent = new StandardKeyboardEvent(e);
    if (
      standardEvent.isKeyBinding ||
      startCell?.type !== 'Cell' ||
      !startCell.equals(lastStartCell) ||
      !host.canvas
    ) {
      textarea.reset();
      return;
    }
    if (!editing) {
      textarea.reset();
      return;
    }
    const {
      height,
      width,
      coordinate: { startRow: row, startCol: col },
      position: { startCol: x, startRow: y }
    } = selector.startCell;
    const info = SHEET_SERVICE.getCell(row, col);
    const text = info?.formula ? info.getFormular() : info?.getText() ?? '';
    const rect = host.canvas.getBoundingClientRect();
    const [clientX, clientY] = [rect.x + x, rect.y + y];
    const context = new Context<Cell>();
    context.text = text;
    context.canvasOffsetX = x;
    context.canvasOffsetY = y;
    context.clientX = clientX ?? -1;
    context.clientY = clientY ?? -1;
    context.cellHeight = height;
    context.cellWidth = width;
    context.textareaOffsetX =
      (event as globalThis.MouseEvent).clientX - clientX;
    context.textareaOffsetY =
      (event as globalThis.MouseEvent).clientY - clientY;
    context.bindingData = selector.startCell;
    runInAction(() => {
      textarea.setEditing(true);
      textarea.setContext(context);
    });
  };
};
