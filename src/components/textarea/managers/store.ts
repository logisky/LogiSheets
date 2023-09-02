import { makeAutoObservable } from 'mobx';
import { Texts } from '../defs';
import { IContext } from '../stores';
import { Subject } from 'rxjs';
import { ISelection, Selection } from '../defs';
import { SyntheticEvent } from 'react';
export type EventType = keyof HTMLElementEventMap | 'suggest' | 'type';
export interface ICursor {
  showCursor: boolean;
  cursorHeight: number;
  cursorX: number;
  cursorY: number;
  cursorLineNumber: number;
  curosrColumn: number;
}

export class InternalTextareaStore implements ICursor {
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  emit = (type: EventType, e?: any) => {
    this._event.next({ type, e });
  };
  obs = () => {
    return this._event.asObservable();
  };
  isDoingComposition = false;
  texts = new Texts();
  suggesting = false;
  selection: ISelection = new Selection();
  showCursor = false;
  cursorHeight = 0;
  cursorX = 0;
  cursorY = 0;
  cursorLineNumber = -1;
  curosrColumn = -1;
  init(context: IContext) {
    this.texts = Texts.from(context.text, context.eof);
    this.selection = new Selection();
    this.suggesting = false;
    this.isDoingComposition = false;
  }
  setCursor(cursor: ICursor) {
    this.showCursor = cursor.showCursor;
    this.cursorHeight = cursor.cursorHeight;
    this.cursorX = cursor.cursorX;
    this.cursorY = cursor.cursorY;
    this.cursorLineNumber = this.cursorLineNumber;
    this.curosrColumn = this.curosrColumn;
  }
  private _event = new Subject<{ type: EventType; e: SyntheticEvent }>();
}
export const internalTextareaStore = new InternalTextareaStore();
