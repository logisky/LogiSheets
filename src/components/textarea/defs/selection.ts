export interface ISelection {
  startX: number;
  startY: number;
  startLineNumber: number;
  startColumn: number;
  endX: number;
  endY: number;
  endLineNumber: number;
  endColumn: number;
  start: number;
  end: number;
}

export class Selection implements ISelection {
  public startX = 0;
  public startY = 0;
  public startLineNumber = 0;
  public startColumn = 0;
  public endX = 0;
  public endY = 0;
  public endLineNumber = 0;
  public endColumn = 0;
  start = 0;
  end = 0;
}
