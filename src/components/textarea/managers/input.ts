import { Text, Texts, History } from '../defs';
import { Selection } from '../defs';
import { useLocalStore } from 'mobx-react';
import {
  ClipboardMetaData,
  ClipboardStoredMetaData,
  CompositionStartEvent,
  KeyboardEventCode,
  MIMES,
  StandardKeyboardEvent
} from '@/core/events';
import {
  Position,
  ClipboardDataToCopy,
  TextAreaInput,
  TextAreaInputHost,
  TextAreaState,
  PagedScreenReaderStrategy,
  TypeData
} from '../input';
import { AccessibilitySupport } from '@/core/document';
import { Range } from '@/core/standable';
import { Subscription } from 'rxjs';
import { textareaStore as _textareaStore } from '../stores';
import { FormEvent, RefObject, SyntheticEvent, useEffect, useRef } from 'react';
import { EventType, internalTextareaStore } from './store';
import { Box, PainterService, TextAttr } from '@/core/painter';
import { autorun } from 'mobx';
import { isFirefox, isMac } from '@/core/platform';
import { shallowCopy } from '@/core';

export interface UseInputManagerProps {
  textareaElement: RefObject<HTMLTextAreaElement>;
  renderTextElement: RefObject<HTMLCanvasElement>;
}

export const useInputManager = (props: UseInputManagerProps) => {
  const { renderTextElement, textareaElement } = props;
  const inputRef = useRef<TextAreaInput>();
  const accessibilitySupport = useRef(AccessibilitySupport.DISABLED);
  const store = useLocalStore(() => internalTextareaStore);
  const textareaStore = useLocalStore(() => _textareaStore);
  const _history = useRef(new History());
  const _painterSvc = useRef(new PainterService());
  const lastKeydownRef = useRef<StandardKeyboardEvent>();

  useEffect(() => {
    const sub = store.obs().subscribe((data) => {
      const { type, e } = data;
      console.log('type', type, e);
      if (type === 'keydown') {
        const _e = e.nativeEvent as KeyboardEvent;
        const keyboardEvent = new StandardKeyboardEvent(_e);
        lastKeydownRef.current = keyboardEvent;
        onKeydown(keyboardEvent);
      } else if (type === 'compositionstart')
        onCompositionStart(e.nativeEvent as CompositionEvent);
      else if (type === 'compositionupdate')
        onCompositionUpdate(e.nativeEvent as CompositionEvent);
      else if (type === 'compositionend')
        onCompositionEnd(e.nativeEvent as CompositionEvent);
      else if (type === 'input') onInput(e.nativeEvent as InputEvent);
    });
    return () => {
      sub.unsubscribe();
    };
  }, []);
  const onInput = (e: InputEvent) => {
    console.log('oninput', e.target);
  };
  const onKeydown = (e: StandardKeyboardEvent) => {
    if (e.keyCodeId === KeyboardEventCode.BACKSPACE) {
      const { cursorLineNumber, curosrColumn, selection } = store;
      if (cursorLineNumber === 0 && curosrColumn === 0) return;
      const removed: Text[] = [];
      if (selection !== undefined)
        removed.push(
          ...remove(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          )
        );
      else
        removed.push(
          ...remove(
            cursorLineNumber,
            curosrColumn - 1,
            cursorLineNumber,
            curosrColumn - 1
          )
        );
    } else if (e.keyCodeId === KeyboardEventCode.ENTER) store.emit('blur');
  };
  const onCompositionStart = (e: CompositionEvent) => {
    if (store.isDoingComposition) return;
    store.isDoingComposition = true;
    const { start: selectionStart, end: selectionEnd } = store.selection;
    const plainValue = store.texts.getPlainText();
    const lastKeydown = lastKeydownRef.current;
    store.selection = new Selection();
  };
  const onCompositionUpdate = (e: CompositionEvent) => {
    console.log('not implement');
  };
  const onCompositionEnd = (e: CompositionEvent) => {
    console.log('not implement');
  };

  useEffect(() => {
    if (textareaStore.editing && renderTextElement.current)
      drawText(renderTextElement.current);
  }, [textareaElement.current, renderTextElement]);

  const getNewSize = (): readonly [width: number, height: number] => {
    const texts = getTwoDimensionalTexts(store.texts);
    const baseHeight = textareaStore.context.lineHeight();
    const height = baseHeight * texts.length;
    const widths = texts.map((ts) =>
      ts.map((t) => t.width()).reduce((p, c) => p + c)
    );
    const width = Math.max(...widths);
    return [width, height];
  };

  const drawText = (canvas?: HTMLCanvasElement) => {
    const [width, height] = getNewSize();
    const paddingRight = 10;
    _painterSvc.current.setupCanvas(canvas, width + paddingRight, height);
    const texts = getTwoDimensionalTexts(store.texts);
    const baseHeight = textareaStore.context.lineHeight();
    texts.forEach((ts, i) => {
      const y = i * baseHeight;
      let x = 0;
      ts.forEach((t) => {
        const position = new Range()
          .setStartRow(y)
          .setEndRow(y + textareaStore.context.lineHeight())
          .setStartCol(x)
          .setEndCol(x + t.width() + 2);
        const box = new Box();
        box.position = position;
        const attr = new TextAttr();
        attr.setFont(t.font);
        _painterSvc.current.text(t.char, attr, box);
        x += t.width();
      });
    });
  };

  const undo = () => {
    let texts = _history.current.undo();
    if (texts === undefined) texts = store.texts;
    drawText();
    return texts.getPlainText();
  };

  const redo = () => {
    let texts = _history.current.redo();
    if (texts === undefined) texts = store.texts;
    drawText();
    return texts.getPlainText();
  };

  const remove = (
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ) => {
    const [start, end] = _twoDimensionalToOneDimensinal(
      startLine,
      startColumn,
      endLine,
      endColumn
    );
    const r = store.texts.remove(start, end);
    drawText();
    return r;
  };

  const replace = (
    content: string,
    start: number,
    count: number
  ): readonly [added: readonly Text[], removed: readonly Text[]] => {
    const eof = textareaStore.context.eof;
    const newTexts = Texts.from(content, eof);
    const removed = store.texts.replace(newTexts, start, count);
    _history.current.add(store.texts);
    drawText();
    return [newTexts.texts, removed];
  };

  const add = (content: string, line: number, column: number) => {
    const eof = textareaStore.context.eof;
    const newTexts = Texts.from(content, eof);
    const [start] = _twoDimensionalToOneDimensinal(line, column, line, column);
    store.texts.add(newTexts, start);
    drawText();
    return newTexts.texts;
  };

  const getText = (
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): readonly Text[] => {
    const [start, end] = _twoDimensionalToOneDimensinal(
      startLine,
      startColumn,
      endLine,
      endColumn
    );
    return store.texts.texts.slice(start, end);
  };
  const _twoDimensionalToOneDimensinal = (
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): readonly [start: number, end: number] => {
    const texts = getTwoDimensionalTexts(store.texts);
    if (texts.length === 0) return [0, 0];
    let [start, end] = [0, 0];
    for (let i = 0; i <= startLine; i += 1)
      if (i === startLine) start += startColumn;
      else start += texts[i].length;
    for (let i = 0; i <= endLine; i += 1)
      if (i === endLine) end += endColumn;
      else end += texts[i].length;
    return [start, end];
  };
};

/**
 * Except eof.
 */
export const getTwoDimensionalTexts = (
  texts: Texts
): readonly (readonly Text[])[] => {
  const _texts: Text[][] = [];
  let currTexts: Text[] = [];
  texts.texts.forEach((t) => {
    currTexts.push(t);
    if (t.isEof) {
      _texts.push(currTexts);
      currTexts = [];
    }
  });
  if (currTexts.length !== 0) _texts.push(currTexts);
  return _texts;
};

export const getNewSize = (
  texts: Texts,
  lineHeight: number
): readonly [width: number, height: number] => {
  const _texts = getTwoDimensionalTexts(texts);
  const height = lineHeight * _texts.length;
  const widths = _texts.map((ts) =>
    ts.map((t) => t.width()).reduce((p, c) => p + c)
  );
  const width = Math.max(...widths);
  return [width, height];
};
