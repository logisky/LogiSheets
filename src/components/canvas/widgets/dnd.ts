import { useLocalStore } from 'mobx-react';
import { useEffect, useRef } from 'react';
import { autorun, runInAction } from 'mobx';
import { getPosition, getSelector } from './selector';
import { AttributeName } from '@/core/const';
import { match, Cell } from '../defs';
import { Backend, CANVAS_OFFSET, DataService, SheetService } from '@/core/data';
import { useInjection } from '@/core/ioc/provider';
import { TYPES } from '@/core/ioc/types';
// import { selectorStore } from '@/components/selector'
import { dndStore } from '@/components/dnd';
import { canvasStore } from '../store';
interface _Selector {
  readonly start: Cell;
  readonly end?: Cell;
}
export const useDnd = () => {
  const DATA_SERVICE = useInjection<DataService>(TYPES.Data);
  // const selector = useLocalStore(() => selectorStore)
  const canvas = useLocalStore(() => canvasStore);
  const dnd = useLocalStore(() => dndStore);
  const mousedownStart = useRef<{ x: number; y: number }>();

  useEffect(() => {
    const sub = canvas.obs().subscribe((data) => {
      if (data.type === 'mouseup') onMouseUp();
    });
    return () => {
      sub.unsubscribe();
    };
  }, []);
  // useEffect(() => {
  //     autorun(() => {
  //         if (!selector.startCell) clean()
  //         else selectorChange({start: selector.startCell, end: selector.endCell})
  //     })
  // })
  const _setRange = (start?: Cell, end?: Cell) => {
    runInAction(() => {
      // if (!canvas.current) return
      // if (!start) {
      //     dnd.range = undefined
      //     return
      // }
      // const sel = selector
      //     ? getSelector(canvas.current, start, end)
      //     : undefined
      // const newRange = sel ? getPosition(sel) : undefined
      // if (!newRange) dnd.range = undefined
      // else dnd.range = {
      //     x: newRange.startCol,
      //     y: newRange.startRow,
      //     width: newRange.width,
      //     height: newRange.height,
      //     draggingX: newRange.startCol,
      //     draggingY: newRange.startRow
      // }
    });
  };
  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLDivElement;
    const isHandle = target.getAttribute(AttributeName.SELECTOR_DND_HANDLE);
    if (isHandle === null) {
      mousedownStart.current = undefined;
      return false;
    }
    mousedownStart.current = { x: e.clientX, y: e.clientY };
    return true;
  };

  const onMouseMove = (e: MouseEvent, startCell: Cell, end: Cell) => {
    if (!mousedownStart.current) return false;
    if (startCell.type !== 'Cell' || end.type !== 'Cell') return true;
    _setRange(startCell, end);
    return true;
  };

  const onMouseUp = () => {
    _setRange();
  };
  const clean = () => {
    mousedownStart.current = undefined;
    runInAction(() => {
      dnd.range = undefined;
    });
    _setRange();
  };
  const selectorChange = (selector?: _Selector) => {
    selector ? _setRange(selector.start, selector.end) : clean();
  };
  return {
    onMouseDown,
    onMouseMove,
    onMouseUp
  };
};
