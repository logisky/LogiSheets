/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";

export const protobufPackage = "protocols";

export enum ShiftType {
  UNSPECIFIED = 0,
  INSERT = 1,
  DELETE = 2,
  UNRECOGNIZED = -1,
}

export function shiftTypeFromJSON(object: any): ShiftType {
  switch (object) {
    case 0:
    case "UNSPECIFIED":
      return ShiftType.UNSPECIFIED;
    case 1:
    case "INSERT":
      return ShiftType.INSERT;
    case 2:
    case "DELETE":
      return ShiftType.DELETE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ShiftType.UNRECOGNIZED;
  }
}

export function shiftTypeToJSON(object: ShiftType): string {
  switch (object) {
    case ShiftType.UNSPECIFIED:
      return "UNSPECIFIED";
    case ShiftType.INSERT:
      return "INSERT";
    case ShiftType.DELETE:
      return "DELETE";
    default:
      return "UNKNOWN";
  }
}

export enum ReadingOrder {
  R_CONTEXT_DEPENDENT = 0,
  R_LEFT_TO_RIGHT = 1,
  R_RIGHT_TO_LEFT = 2,
  UNRECOGNIZED = -1,
}

export function readingOrderFromJSON(object: any): ReadingOrder {
  switch (object) {
    case 0:
    case "R_CONTEXT_DEPENDENT":
      return ReadingOrder.R_CONTEXT_DEPENDENT;
    case 1:
    case "R_LEFT_TO_RIGHT":
      return ReadingOrder.R_LEFT_TO_RIGHT;
    case 2:
    case "R_RIGHT_TO_LEFT":
      return ReadingOrder.R_RIGHT_TO_LEFT;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ReadingOrder.UNRECOGNIZED;
  }
}

export function readingOrderToJSON(object: ReadingOrder): string {
  switch (object) {
    case ReadingOrder.R_CONTEXT_DEPENDENT:
      return "R_CONTEXT_DEPENDENT";
    case ReadingOrder.R_LEFT_TO_RIGHT:
      return "R_LEFT_TO_RIGHT";
    case ReadingOrder.R_RIGHT_TO_LEFT:
      return "R_RIGHT_TO_LEFT";
    default:
      return "UNKNOWN";
  }
}

export enum BorderType {
  DASH_DOT = 0,
  DASH_DOT_DOT = 1,
  DASHED = 2,
  DOTTED = 3,
  DOUBLE = 4,
  HAIR = 5,
  MEDIUM = 6,
  MEDIUM_DASH_DOT = 7,
  MEDIUM_DASH_DOT_DOT = 8,
  MEDIUM_DASHED = 9,
  NONE_BORDER = 10,
  SLANT_DASH_DOT = 11,
  THICK = 12,
  THIN = 13,
  UNRECOGNIZED = -1,
}

export function borderTypeFromJSON(object: any): BorderType {
  switch (object) {
    case 0:
    case "DASH_DOT":
      return BorderType.DASH_DOT;
    case 1:
    case "DASH_DOT_DOT":
      return BorderType.DASH_DOT_DOT;
    case 2:
    case "DASHED":
      return BorderType.DASHED;
    case 3:
    case "DOTTED":
      return BorderType.DOTTED;
    case 4:
    case "DOUBLE":
      return BorderType.DOUBLE;
    case 5:
    case "HAIR":
      return BorderType.HAIR;
    case 6:
    case "MEDIUM":
      return BorderType.MEDIUM;
    case 7:
    case "MEDIUM_DASH_DOT":
      return BorderType.MEDIUM_DASH_DOT;
    case 8:
    case "MEDIUM_DASH_DOT_DOT":
      return BorderType.MEDIUM_DASH_DOT_DOT;
    case 9:
    case "MEDIUM_DASHED":
      return BorderType.MEDIUM_DASHED;
    case 10:
    case "NONE_BORDER":
      return BorderType.NONE_BORDER;
    case 11:
    case "SLANT_DASH_DOT":
      return BorderType.SLANT_DASH_DOT;
    case 12:
    case "THICK":
      return BorderType.THICK;
    case 13:
    case "THIN":
      return BorderType.THIN;
    case -1:
    case "UNRECOGNIZED":
    default:
      return BorderType.UNRECOGNIZED;
  }
}

export function borderTypeToJSON(object: BorderType): string {
  switch (object) {
    case BorderType.DASH_DOT:
      return "DASH_DOT";
    case BorderType.DASH_DOT_DOT:
      return "DASH_DOT_DOT";
    case BorderType.DASHED:
      return "DASHED";
    case BorderType.DOTTED:
      return "DOTTED";
    case BorderType.DOUBLE:
      return "DOUBLE";
    case BorderType.HAIR:
      return "HAIR";
    case BorderType.MEDIUM:
      return "MEDIUM";
    case BorderType.MEDIUM_DASH_DOT:
      return "MEDIUM_DASH_DOT";
    case BorderType.MEDIUM_DASH_DOT_DOT:
      return "MEDIUM_DASH_DOT_DOT";
    case BorderType.MEDIUM_DASHED:
      return "MEDIUM_DASHED";
    case BorderType.NONE_BORDER:
      return "NONE_BORDER";
    case BorderType.SLANT_DASH_DOT:
      return "SLANT_DASH_DOT";
    case BorderType.THICK:
      return "THICK";
    case BorderType.THIN:
      return "THIN";
    default:
      return "UNKNOWN";
  }
}

export enum UnderlineType {
  DOUBLE_U = 0,
  DOUBLE_ACCOUNTING = 1,
  NONE = 2,
  SINGLE = 3,
  SINGLE_ACCOUNTING = 4,
  UNRECOGNIZED = -1,
}

export function underlineTypeFromJSON(object: any): UnderlineType {
  switch (object) {
    case 0:
    case "DOUBLE_U":
    case "DoubleU":
      return UnderlineType.DOUBLE_U;
    case 1:
    case "DOUBLE_ACCOUNTING":
    case "DoubleAccounting":
      return UnderlineType.DOUBLE_ACCOUNTING;
    case 2:
    case "NONE":
    case "None":
      return UnderlineType.NONE;
    case 3:
    case "SINGLE":
    case "Single":
      return UnderlineType.SINGLE;
    case 4:
    case "SINGLE_ACCOUNTING":
    case "SingleAccounting":
      return UnderlineType.SINGLE_ACCOUNTING;
    case -1:
    case "UNRECOGNIZED":
    default:
      return UnderlineType.UNRECOGNIZED;
  }
}

export function underlineTypeToJSON(object: UnderlineType): string {
  switch (object) {
    case UnderlineType.DOUBLE_U:
      return "DOUBLE_U";
      return "DoubleU";
    case UnderlineType.DOUBLE_ACCOUNTING:
      return "DoubleAccounting";
    case UnderlineType.NONE:
      return "None";
    case UnderlineType.SINGLE:
      return "Single";
    case UnderlineType.SINGLE_ACCOUNTING:
      return "SINGLEAccounting";
    default:
      return "UNKNOWN";
  }
}

export enum PatternFillType {
  DARK_DOWN = 0,
  DARK_GRAY = 1,
  DARK_GRID = 2,
  DARK_HORIZONTAL = 3,
  DARK_TRELLIS = 4,
  DARK_UP = 5,
  DARK_VERTICAL = 6,
  GRAY0625 = 7,
  GRAY125 = 8,
  LIGHT_DOWN = 9,
  LIGHT_GRAY = 10,
  LIGHT_GRID = 11,
  LIGHT_HORIZONTAL = 12,
  LIGHT_TRELLIS = 13,
  LIGHT_UP = 14,
  LIGHT_VERTICAL = 15,
  MEDIUM_GRAY = 16,
  NONE_PATTERN_FILL = 17,
  SOLID = 18,
  UNRECOGNIZED = -1,
}

export function patternFillTypeFromJSON(object: any): PatternFillType {
  switch (object) {
    case 0:
    case "DARK_DOWN":
    case "DarkDown":
      return PatternFillType.DARK_DOWN;
    case 1:
    case "DARK_GRAY":
    case "DarkGray":
      return PatternFillType.DARK_GRAY;
    case 2:
    case "DARK_GRID":
    case "DarkGrid":
      return PatternFillType.DARK_GRID;
    case 3:
    case "DARK_HORIZONTAL":
    case "DarkHorizontal":
      return PatternFillType.DARK_HORIZONTAL;
    case 4:
    case "DARK_TRELLIS":
    case "DarkThrellis":
      return PatternFillType.DARK_TRELLIS;
    case 5:
    case "DARK_UP":
    case "DarkUp":
      return PatternFillType.DARK_UP;
    case 6:
    case "DARK_VERTICAL":
    case "DarkVertical":
      return PatternFillType.DARK_VERTICAL;
    case 7:
    case "GRAY0625":
    case "Gray0625":
      return PatternFillType.GRAY0625;
    case 8:
    case "GRAY125":
    case "Gray125":
      return PatternFillType.GRAY125;
    case 9:
    case "LIGHT_DOWN":
    case "LightDown":
      return PatternFillType.LIGHT_DOWN;
    case 10:
    case "LIGHT_GRAY":
    case "LightGray":
      return PatternFillType.LIGHT_GRAY;
    case 11:
    case "LIGHT_GRID":
    case "LightGrid":
      return PatternFillType.LIGHT_GRID;
    case 12:
    case "LIGHT_HORIZONTAL":
    case "Light":
      return PatternFillType.LIGHT_HORIZONTAL;
    case 13:
    case "LIGHT_TRELLIS":
    case "LightTrellis":
      return PatternFillType.LIGHT_TRELLIS;
    case 14:
    case "LIGHT_UP":
    case "LightUp":
      return PatternFillType.LIGHT_UP;
    case 15:
    case "LIGHT_VERTICAL":
    case "LightVertical":
      return PatternFillType.LIGHT_VERTICAL;
    case 16:
    case "MEDIUM_GRAY":
    case "MediumGray":
      return PatternFillType.MEDIUM_GRAY;
    case 17:
    case "NONE_PATTERN_FILL":
    case "NonePatternFill":
      return PatternFillType.NONE_PATTERN_FILL;
    case 18:
    case "SOLID":
    case "Solid":
      return PatternFillType.SOLID;
    case -1:
    case "UNRECOGNIZED":
    case "Unrecognized":
    default:
      return PatternFillType.UNRECOGNIZED;
  }
}

export function patternFillTypeToJSON(object: PatternFillType): string {
  switch (object) {
    case PatternFillType.DARK_DOWN:
      return "DARK_DOWN";
    case PatternFillType.DARK_GRAY:
      return "DARK_GRAY";
    case PatternFillType.DARK_GRID:
      return "DARK_GRID";
    case PatternFillType.DARK_HORIZONTAL:
      return "DARK_HORIZONTAL";
    case PatternFillType.DARK_TRELLIS:
      return "DARK_TRELLIS";
    case PatternFillType.DARK_UP:
      return "DARK_UP";
    case PatternFillType.DARK_VERTICAL:
      return "DARK_VERTICAL";
    case PatternFillType.GRAY0625:
      return "GRAY0625";
    case PatternFillType.GRAY125:
      return "GRAY125";
    case PatternFillType.LIGHT_DOWN:
      return "LIGHT_DOWN";
    case PatternFillType.LIGHT_GRAY:
      return "LIGHT_GRAY";
    case PatternFillType.LIGHT_GRID:
      return "LIGHT_GRID";
    case PatternFillType.LIGHT_HORIZONTAL:
      return "LIGHT_HORIZONTAL";
    case PatternFillType.LIGHT_TRELLIS:
      return "LIGHT_TRELLIS";
    case PatternFillType.LIGHT_UP:
      return "LIGHT_UP";
    case PatternFillType.LIGHT_VERTICAL:
      return "LIGHT_VERTICAL";
    case PatternFillType.MEDIUM_GRAY:
      return "MEDIUM_GRAY";
    case PatternFillType.NONE_PATTERN_FILL:
      return "NONE_PATTERN_FILL";
    case PatternFillType.SOLID:
      return "SOLID";
    default:
      return "UNKNOWN";
  }
}

export enum BorderLocation {
  LEFT = 0,
  RIGHT = 1,
  TOP = 2,
  BOTTOM = 3,
  DIAGONAL = 4,
  VERTICAL = 5,
  HORIZONTAL = 6,
  UNRECOGNIZED = -1,
}

export function borderLocationFromJSON(object: any): BorderLocation {
  switch (object) {
    case 0:
    case "LEFT":
      return BorderLocation.LEFT;
    case 1:
    case "RIGHT":
      return BorderLocation.RIGHT;
    case 2:
    case "TOP":
      return BorderLocation.TOP;
    case 3:
    case "BOTTOM":
      return BorderLocation.BOTTOM;
    case 4:
    case "DIAGONAL":
      return BorderLocation.DIAGONAL;
    case 5:
    case "VERTICAL":
      return BorderLocation.VERTICAL;
    case 6:
    case "HORIZONTAL":
      return BorderLocation.HORIZONTAL;
    case -1:
    case "UNRECOGNIZED":
    default:
      return BorderLocation.UNRECOGNIZED;
  }
}

export function borderLocationToJSON(object: BorderLocation): string {
  switch (object) {
    case BorderLocation.LEFT:
      return "LEFT";
    case BorderLocation.RIGHT:
      return "RIGHT";
    case BorderLocation.TOP:
      return "TOP";
    case BorderLocation.BOTTOM:
      return "BOTTOM";
    case BorderLocation.DIAGONAL:
      return "DIAGONAL";
    case BorderLocation.VERTICAL:
      return "VERTICAL";
    case BorderLocation.HORIZONTAL:
      return "HORIZONTAL";
    default:
      return "UNKNOWN";
  }
}

export interface ClientSend {
  clientSendOneof?:
    | { $case: "transaction"; transaction: Transaction }
    | { $case: "displayRequest"; displayRequest: DisplayRequest }
    | { $case: "openFile"; openFile: OpenFile };
  eventSource: EventSource | undefined;
  fileId: string;
}

export interface EventSource {
  userId: string;
  actionId: string;
}

/** Message sent by the server. */
export interface ServerSend {
  serverSendOneof?:
    | { $case: "displayResponse"; displayResponse: DisplayResponse }
    | { $case: "sheetUpdated"; sheetUpdated: SheetUpdated };
}

export interface SheetUpdated {
  /** The index of the sheet that has been updated on the server side. */
  index: number[];
  /**
   * Specified whose and which action causes this update.
   * Generated by user id and action.
   */
  eventSource: EventSource | undefined;
}

export interface OpenFile {
  fileId: string;
  content: Uint8Array;
  name: string;
}

/**
 * A transaction contains serveral payloads indicating some atomic changes on a
 * workbook. These atomic changes will be all withdrawed when client `undo`.
 * Priority:
 * - undo
 * - redo
 * - payloads
 */
export interface Transaction {
  payloads: Payload[];
  undo: boolean;
  redo: boolean;
  /** If this transaction is undoable. Meaningless if `undo` or `redo` is true. */
  undoable: boolean;
}

/**
 * Client tells Server that it wants to display/prepare to display this area.
 * Server will prepare data for it.
 */
export interface DisplayRequest {
  sheetIdx: number;
  /**
   * Server would find out the patch for incremental updating the data in the
   * client according to this.
   */
  version: number;
}

/** Notify the client that the sheet bar has updated as the content delivered. */
export interface SheetNames {
  sheetNames: string[];
}

export interface Comment {
  row: number;
  col: number;
  author: string;
  content: string;
}

export interface MergeCell {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SheetMergeCells {
  idx: number;
  mergeCells: MergeCell[];
}

export interface SheetComments {
  idx: number;
  comment: Comment[];
}

export interface RowInfo {
  idx: number;
  height: number;
  hidden: boolean;
}

export interface ColInfo {
  idx: number;
  /** Specifies the width (in twentieths of a point) of this text column. */
  width: number;
  hidden: boolean;
}

export interface SheetRowInfo {
  sheetIdx: number;
  info: RowInfo[];
  defaultHeight: number;
}

export interface SheetColInfo {
  sheetIdx: number;
  info: ColInfo[];
  defaultWidth: number;
}

export interface DisplayResponse {
  patches: DisplayPatch[];
}

export interface DisplayPatch {
  displayPatchOneof?:
    | { $case: "values"; values: SheetValues }
    | { $case: "styles"; styles: SheetStyles }
    | { $case: "rowInfo"; rowInfo: SheetRowInfo }
    | { $case: "colInfo"; colInfo: SheetColInfo }
    | { $case: "sheetNames"; sheetNames: SheetNames }
    | { $case: "mergeCells"; mergeCells: SheetMergeCells }
    | { $case: "comments"; comments: SheetComments }
    | { $case: "blocks"; blocks: SheetBlocks };
}

export interface SheetBlocks {
  sheetIdx: number;
  blockInfo: BlockInfo[];
}

export interface BlockInfo {
  blockId: number;
  rowStart: number;
  colStart: number;
  rowCnt: number;
  colCnt: number;
}

export interface SheetStyles {
  sheetIdx: number;
  styles: CellStyle[];
}

export interface SheetValues {
  sheetIdx: number;
  values: CellValue[];
}

export interface Value {
  cellValueOneof?:
    | { $case: "str"; str: string }
    | { $case: "number"; number: number }
    | { $case: "bool"; bool: boolean }
    | { $case: "error"; error: string };
}

export interface CellStyle {
  /**
   * If row or col equals 0. It means this is the default style for this row
   * or col.
   */
  row: number;
  col: number;
  style: Style | undefined;
}

export interface CellValue {
  /** 1-based. */
  row: number;
  /** 1-based. */
  col: number;
  value: Value | undefined;
  formula: string;
}

export interface Payload {
  payloadOneof?:
    | { $case: "cellInput"; cellInput: CellInput }
    | { $case: "rowShift"; rowShift: RowShift }
    | { $case: "columnShift"; columnShift: ColumnShift }
    | { $case: "sheetRename"; sheetRename: SheetRename }
    | { $case: "sheetShift"; sheetShift: SheetShift }
    | { $case: "styleUpdate"; styleUpdate: StyleUpdate }
    | { $case: "createBlock"; createBlock: CreateBlock }
    | { $case: "moveBlock"; moveBlock: MoveBlock }
    | { $case: "blockInput"; blockInput: BlockInput }
    | { $case: "blockStyleUpdate"; blockStyleUpdate: BlockStyleUpdate }
    | { $case: "lineShiftInBlock"; lineShiftInBlock: LineShiftInBlock }
    | { $case: "setRowHeight"; setRowHeight: SetRowHeight }
    | { $case: "setColWidth"; setColWidth: SetColWidth }
    | { $case: "setRowVisible"; setRowVisible: SetRowVisible }
    | { $case: "setColVisible"; setColVisible: SetColVisible };
}

export interface SetRowHeight {
  sheetIdx: number;
  row: number;
  height: number;
}

export interface SetColWidth {
  sheetIdx: number;
  col: number;
  width: number;
}

export interface SetRowVisible {
  sheetIdx: number;
  row: number;
  visible: boolean;
}

export interface SetColVisible {
  sheetIdx: number;
  col: number;
  visible: boolean;
}

export interface CreateBlock {
  sheetIdx: number;
  id: number;
  masterRow: number;
  masterCol: number;
  rowCnt: number;
  colCnt: number;
}

export interface MoveBlock {
  sheetIdx: number;
  id: number;
  newMasterRow: number;
  newMasterCol: number;
}

export interface BlockInput {
  sheetIdx: number;
  id: number;
  row: number;
  col: number;
  input: string;
}

export interface BlockStyleUpdate {
  sheetIdx: number;
  id: number;
  row: number;
  col: number;
  payloads: StyleUpdatePayload[];
}

export interface LineShiftInBlock {
  sheetIdx: number;
  id: number;
  idx: number;
  cnt: number;
  horizontal: boolean;
  insert: boolean;
}

export interface SheetRename {
  oldName: string;
  newName: string;
}

export interface CellInput {
  sheetIdx: number;
  row: number;
  col: number;
  /**
   * Auto refer the input type.
   * If it starts with "=", we will refer it as a formula input.
   */
  input: string;
}

export interface RowShift {
  sheetIdx: number;
  start: number;
  count: number;
  type: ShiftType;
}

export interface ColumnShift {
  sheetIdx: number;
  start: number;
  count: number;
  type: ShiftType;
}

export interface SheetShift {
  sheetIdx: number;
  type: ShiftType;
}

export interface Style {
  border: Border | undefined;
  font: Font | undefined;
  fill: PatternFill | undefined;
  alignment: Alignment | undefined;
  formatter: string;
}

export interface Alignment {
  horizontal: Alignment_Horizontal;
  indent: number;
  justifyLastLine: boolean;
  readingOrder: ReadingOrder;
  relativeIndent: number;
  shrinkToFit: boolean;
  /** range 0 to 180 */
  textRotation: number;
  vertical: Alignment_Vertical;
  wrapText: boolean;
}

export enum Alignment_Horizontal {
  H_UNSPECIFIED = 0,
  H_CENTER = 1,
  H_CENTER_CONTINUOUS = 2,
  H_DISTRIBUTED = 3,
  H_FILL = 4,
  H_GENERAL = 5,
  H_JUSTIFY = 6,
  H_LEFT = 7,
  H_RIGHT = 8,
  UNRECOGNIZED = -1,
}

export function alignment_HorizontalFromJSON(
  object: any
): Alignment_Horizontal {
  switch (object) {
    case 0:
    case "H_UNSPECIFIED":
      return Alignment_Horizontal.H_UNSPECIFIED;
    case 1:
    case "H_CENTER":
      return Alignment_Horizontal.H_CENTER;
    case 2:
    case "H_CENTER_CONTINUOUS":
      return Alignment_Horizontal.H_CENTER_CONTINUOUS;
    case 3:
    case "H_DISTRIBUTED":
      return Alignment_Horizontal.H_DISTRIBUTED;
    case 4:
    case "H_FILL":
      return Alignment_Horizontal.H_FILL;
    case 5:
    case "H_GENERAL":
      return Alignment_Horizontal.H_GENERAL;
    case 6:
    case "H_JUSTIFY":
      return Alignment_Horizontal.H_JUSTIFY;
    case 7:
    case "H_LEFT":
      return Alignment_Horizontal.H_LEFT;
    case 8:
    case "H_RIGHT":
      return Alignment_Horizontal.H_RIGHT;
    case -1:
    case "UNRECOGNIZED":
    default:
      return Alignment_Horizontal.UNRECOGNIZED;
  }
}

export function alignment_HorizontalToJSON(
  object: Alignment_Horizontal
): string {
  switch (object) {
    case Alignment_Horizontal.H_UNSPECIFIED:
      return "H_UNSPECIFIED";
    case Alignment_Horizontal.H_CENTER:
      return "H_CENTER";
    case Alignment_Horizontal.H_CENTER_CONTINUOUS:
      return "H_CENTER_CONTINUOUS";
    case Alignment_Horizontal.H_DISTRIBUTED:
      return "H_DISTRIBUTED";
    case Alignment_Horizontal.H_FILL:
      return "H_FILL";
    case Alignment_Horizontal.H_GENERAL:
      return "H_GENERAL";
    case Alignment_Horizontal.H_JUSTIFY:
      return "H_JUSTIFY";
    case Alignment_Horizontal.H_LEFT:
      return "H_LEFT";
    case Alignment_Horizontal.H_RIGHT:
      return "H_RIGHT";
    default:
      return "UNKNOWN";
  }
}

export enum Alignment_Vertical {
  V_UNSPECIFIED = 0,
  V_BOTTOM = 1,
  V_CENTER = 2,
  V_DISTRIBUTED = 3,
  V_JUSTIFY = 4,
  V_TOP = 5,
  UNRECOGNIZED = -1,
}

export function alignment_VerticalFromJSON(object: any): Alignment_Vertical {
  switch (object) {
    case 0:
    case "V_UNSPECIFIED":
      return Alignment_Vertical.V_UNSPECIFIED;
    case 1:
    case "V_BOTTOM":
      return Alignment_Vertical.V_BOTTOM;
    case 2:
    case "V_CENTER":
      return Alignment_Vertical.V_CENTER;
    case 3:
    case "V_DISTRIBUTED":
      return Alignment_Vertical.V_DISTRIBUTED;
    case 4:
    case "V_JUSTIFY":
      return Alignment_Vertical.V_JUSTIFY;
    case 5:
    case "V_TOP":
      return Alignment_Vertical.V_TOP;
    case -1:
    case "UNRECOGNIZED":
    default:
      return Alignment_Vertical.UNRECOGNIZED;
  }
}

export function alignment_VerticalToJSON(object: Alignment_Vertical): string {
  switch (object) {
    case Alignment_Vertical.V_UNSPECIFIED:
      return "V_UNSPECIFIED";
    case Alignment_Vertical.V_BOTTOM:
      return "V_BOTTOM";
    case Alignment_Vertical.V_CENTER:
      return "V_CENTER";
    case Alignment_Vertical.V_DISTRIBUTED:
      return "V_DISTRIBUTED";
    case Alignment_Vertical.V_JUSTIFY:
      return "V_JUSTIFY";
    case Alignment_Vertical.V_TOP:
      return "V_TOP";
    default:
      return "UNKNOWN";
  }
}

export interface Border {
  left: BorderPr | undefined;
  right: BorderPr | undefined;
  top: BorderPr | undefined;
  bottom: BorderPr | undefined;
  diagonal: BorderPr | undefined;
  vertical: BorderPr | undefined;
  horizontal: BorderPr | undefined;
  diagonalUp: boolean;
  diagonalDown: boolean;
  outline: boolean;
}

export interface BorderPr {
  color: string;
  type: BorderType;
}

export interface Font {
  bold: boolean;
  italic: boolean;
  underline: UnderlineType;
  /** Empty means default */
  color: string;
  /** Size of the text font, where font-size is a decimal font size in points. */
  size: number;
  name: string;
  outline: boolean;
  shadow: boolean;
  strike: boolean;
  condense: boolean;
}

export interface PatternFill {
  fgColor: string;
  bgColor: string;
  type: PatternFillType;
}

export interface SetFontBold {
  bold: boolean;
}

export interface SetFontItalic {
  italic: boolean;
}

export interface SetFontUnderline {
  underline: UnderlineType;
}

export interface SetFontColor {
  color: string;
}

export interface SetFontSize {
  size: number;
}

export interface SetFontName {
  name: string;
}

export interface SetFontOutline {
  outline: boolean;
}

export interface SetFontShadow {
  shadow: boolean;
}

export interface SetFontStrike {
  strike: boolean;
}

export interface SetFontCondense {
  condense: boolean;
}

export interface SetBorderDiagonalUp {
  diagonalUp: boolean;
}

export interface SetBorderDiagonalDown {
  diagonalDown: boolean;
}

export interface SetBorderOutline {
  outline: boolean;
}

export interface SetPatternFill {
  patternFill: PatternFill | undefined;
}

export interface SetLeftBorderColor {
  color: string;
}

export interface SetRightBorderColor {
  color: string;
}

export interface SetTopBorderColor {
  color: string;
}

export interface SetBottomBorderColor {
  color: string;
}

export interface SetLeftBorderType {
  bt: BorderType;
}

export interface SetRightBorderType {
  bt: BorderType;
}

export interface SetTopBorderType {
  bt: BorderType;
}

export interface SetBottomBorderType {
  bt: BorderType;
}

export interface StyleUpdatePayload {
  stylePayloadOneof?:
    | { $case: "setFontBold"; setFontBold: SetFontBold }
    | { $case: "setFontItalic"; setFontItalic: SetFontItalic }
    | { $case: "setFontUnderline"; setFontUnderline: SetFontUnderline }
    | { $case: "setFontColor"; setFontColor: SetFontColor }
    | { $case: "setFontSize"; setFontSize: SetFontSize }
    | { $case: "setFontName"; setFontName: SetFontName }
    | { $case: "setFontOutline"; setFontOutline: SetFontOutline }
    | { $case: "setFontShadow"; setFontShadow: SetFontShadow }
    | { $case: "setFontStrike"; setFontStrike: SetFontStrike }
    | { $case: "setFontCondense"; setFontCondense: SetFontCondense }
    | { $case: "setBorderDiagonalUp"; setBorderDiagonalUp: SetBorderDiagonalUp }
    | {
        $case: "setBorderDiagonalDown";
        setBorderDiagonalDown: SetBorderDiagonalDown;
      }
    | { $case: "setBorderOutline"; setBorderOutline: SetBorderOutline }
    | { $case: "setLeftBorderColor"; setLeftBorderColor: SetLeftBorderColor }
    | { $case: "setRightBorderColor"; setRightBorderColor: SetRightBorderColor }
    | { $case: "setTopBorderColor"; setTopBorderColor: SetTopBorderColor }
    | {
        $case: "setBottomBorderColor";
        setBottomBorderColor: SetBottomBorderColor;
      }
    | { $case: "setLeftBorderType"; setLeftBorderType: SetLeftBorderType }
    | { $case: "setRightBorderType"; setRightBorderType: SetRightBorderType }
    | { $case: "setTopBorderType"; setTopBorderType: SetTopBorderType }
    | { $case: "setBottomBorderType"; setBottomBorderType: SetBottomBorderType }
    | { $case: "setPatternFill"; setPatternFill: SetPatternFill };
}

export interface StyleUpdate {
  sheetIdx: number;
  row: number;
  col: number;
  payloads: StyleUpdatePayload[];
}

function createBaseClientSend(): ClientSend {
  return { clientSendOneof: undefined, eventSource: undefined, fileId: "" };
}

export const ClientSend = {
  encode(
    message: ClientSend,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.clientSendOneof?.$case === "transaction") {
      Transaction.encode(
        message.clientSendOneof.transaction,
        writer.uint32(10).fork()
      ).ldelim();
    }
    if (message.clientSendOneof?.$case === "displayRequest") {
      DisplayRequest.encode(
        message.clientSendOneof.displayRequest,
        writer.uint32(18).fork()
      ).ldelim();
    }
    if (message.clientSendOneof?.$case === "openFile") {
      OpenFile.encode(
        message.clientSendOneof.openFile,
        writer.uint32(26).fork()
      ).ldelim();
    }
    if (message.eventSource !== undefined) {
      EventSource.encode(
        message.eventSource,
        writer.uint32(34).fork()
      ).ldelim();
    }
    if (message.fileId !== "") {
      writer.uint32(42).string(message.fileId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ClientSend {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseClientSend();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.clientSendOneof = {
            $case: "transaction",
            transaction: Transaction.decode(reader, reader.uint32()),
          };
          break;
        case 2:
          message.clientSendOneof = {
            $case: "displayRequest",
            displayRequest: DisplayRequest.decode(reader, reader.uint32()),
          };
          break;
        case 3:
          message.clientSendOneof = {
            $case: "openFile",
            openFile: OpenFile.decode(reader, reader.uint32()),
          };
          break;
        case 4:
          message.eventSource = EventSource.decode(reader, reader.uint32());
          break;
        case 5:
          message.fileId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ClientSend {
    return {
      clientSendOneof: isSet(object.transaction)
        ? {
            $case: "transaction",
            transaction: Transaction.fromJSON(object.transaction),
          }
        : isSet(object.displayRequest)
        ? {
            $case: "displayRequest",
            displayRequest: DisplayRequest.fromJSON(object.displayRequest),
          }
        : isSet(object.openFile)
        ? { $case: "openFile", openFile: OpenFile.fromJSON(object.openFile) }
        : undefined,
      eventSource: isSet(object.eventSource)
        ? EventSource.fromJSON(object.eventSource)
        : undefined,
      fileId: isSet(object.fileId) ? String(object.fileId) : "",
    };
  },

  toJSON(message: ClientSend): unknown {
    const obj: any = {};
    message.clientSendOneof?.$case === "transaction" &&
      (obj.transaction = message.clientSendOneof?.transaction
        ? Transaction.toJSON(message.clientSendOneof?.transaction)
        : undefined);
    message.clientSendOneof?.$case === "displayRequest" &&
      (obj.displayRequest = message.clientSendOneof?.displayRequest
        ? DisplayRequest.toJSON(message.clientSendOneof?.displayRequest)
        : undefined);
    message.clientSendOneof?.$case === "openFile" &&
      (obj.openFile = message.clientSendOneof?.openFile
        ? OpenFile.toJSON(message.clientSendOneof?.openFile)
        : undefined);
    message.eventSource !== undefined &&
      (obj.eventSource = message.eventSource
        ? EventSource.toJSON(message.eventSource)
        : undefined);
    message.fileId !== undefined && (obj.fileId = message.fileId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ClientSend>, I>>(
    object: I
  ): ClientSend {
    const message = createBaseClientSend();
    if (
      object.clientSendOneof?.$case === "transaction" &&
      object.clientSendOneof?.transaction !== undefined &&
      object.clientSendOneof?.transaction !== null
    ) {
      message.clientSendOneof = {
        $case: "transaction",
        transaction: Transaction.fromPartial(
          object.clientSendOneof.transaction
        ),
      };
    }
    if (
      object.clientSendOneof?.$case === "displayRequest" &&
      object.clientSendOneof?.displayRequest !== undefined &&
      object.clientSendOneof?.displayRequest !== null
    ) {
      message.clientSendOneof = {
        $case: "displayRequest",
        displayRequest: DisplayRequest.fromPartial(
          object.clientSendOneof.displayRequest
        ),
      };
    }
    if (
      object.clientSendOneof?.$case === "openFile" &&
      object.clientSendOneof?.openFile !== undefined &&
      object.clientSendOneof?.openFile !== null
    ) {
      message.clientSendOneof = {
        $case: "openFile",
        openFile: OpenFile.fromPartial(object.clientSendOneof.openFile),
      };
    }
    message.eventSource =
      object.eventSource !== undefined && object.eventSource !== null
        ? EventSource.fromPartial(object.eventSource)
        : undefined;
    message.fileId = object.fileId ?? "";
    return message;
  },
};

function createBaseEventSource(): EventSource {
  return { userId: "", actionId: "" };
}

export const EventSource = {
  encode(
    message: EventSource,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.userId !== "") {
      writer.uint32(10).string(message.userId);
    }
    if (message.actionId !== "") {
      writer.uint32(18).string(message.actionId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EventSource {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEventSource();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.userId = reader.string();
          break;
        case 2:
          message.actionId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): EventSource {
    return {
      userId: isSet(object.userId) ? String(object.userId) : "",
      actionId: isSet(object.actionId) ? String(object.actionId) : "",
    };
  },

  toJSON(message: EventSource): unknown {
    const obj: any = {};
    message.userId !== undefined && (obj.userId = message.userId);
    message.actionId !== undefined && (obj.actionId = message.actionId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<EventSource>, I>>(
    object: I
  ): EventSource {
    const message = createBaseEventSource();
    message.userId = object.userId ?? "";
    message.actionId = object.actionId ?? "";
    return message;
  },
};

function createBaseServerSend(): ServerSend {
  return { serverSendOneof: undefined };
}

export const ServerSend = {
  encode(
    message: ServerSend,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.serverSendOneof?.$case === "displayResponse") {
      DisplayResponse.encode(
        message.serverSendOneof.displayResponse,
        writer.uint32(10).fork()
      ).ldelim();
    }
    if (message.serverSendOneof?.$case === "sheetUpdated") {
      SheetUpdated.encode(
        message.serverSendOneof.sheetUpdated,
        writer.uint32(18).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ServerSend {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseServerSend();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.serverSendOneof = {
            $case: "displayResponse",
            displayResponse: DisplayResponse.decode(reader, reader.uint32()),
          };
          break;
        case 2:
          message.serverSendOneof = {
            $case: "sheetUpdated",
            sheetUpdated: SheetUpdated.decode(reader, reader.uint32()),
          };
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ServerSend {
    return {
      serverSendOneof: isSet(object.displayResponse)
        ? {
            $case: "displayResponse",
            displayResponse: DisplayResponse.fromJSON(object.displayResponse),
          }
        : isSet(object.sheetUpdated)
        ? {
            $case: "sheetUpdated",
            sheetUpdated: SheetUpdated.fromJSON(object.sheetUpdated),
          }
        : undefined,
    };
  },

  toJSON(message: ServerSend): unknown {
    const obj: any = {};
    message.serverSendOneof?.$case === "displayResponse" &&
      (obj.displayResponse = message.serverSendOneof?.displayResponse
        ? DisplayResponse.toJSON(message.serverSendOneof?.displayResponse)
        : undefined);
    message.serverSendOneof?.$case === "sheetUpdated" &&
      (obj.sheetUpdated = message.serverSendOneof?.sheetUpdated
        ? SheetUpdated.toJSON(message.serverSendOneof?.sheetUpdated)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ServerSend>, I>>(
    object: I
  ): ServerSend {
    const message = createBaseServerSend();
    if (
      object.serverSendOneof?.$case === "displayResponse" &&
      object.serverSendOneof?.displayResponse !== undefined &&
      object.serverSendOneof?.displayResponse !== null
    ) {
      message.serverSendOneof = {
        $case: "displayResponse",
        displayResponse: DisplayResponse.fromPartial(
          object.serverSendOneof.displayResponse
        ),
      };
    }
    if (
      object.serverSendOneof?.$case === "sheetUpdated" &&
      object.serverSendOneof?.sheetUpdated !== undefined &&
      object.serverSendOneof?.sheetUpdated !== null
    ) {
      message.serverSendOneof = {
        $case: "sheetUpdated",
        sheetUpdated: SheetUpdated.fromPartial(
          object.serverSendOneof.sheetUpdated
        ),
      };
    }
    return message;
  },
};

function createBaseSheetUpdated(): SheetUpdated {
  return { index: [], eventSource: undefined };
}

export const SheetUpdated = {
  encode(
    message: SheetUpdated,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    writer.uint32(10).fork();
    for (const v of message.index) {
      writer.uint32(v);
    }
    writer.ldelim();
    if (message.eventSource !== undefined) {
      EventSource.encode(
        message.eventSource,
        writer.uint32(18).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetUpdated {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetUpdated();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.index.push(reader.uint32());
            }
          } else {
            message.index.push(reader.uint32());
          }
          break;
        case 2:
          message.eventSource = EventSource.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetUpdated {
    return {
      index: Array.isArray(object?.index)
        ? object.index.map((e: any) => Number(e))
        : [],
      eventSource: isSet(object.eventSource)
        ? EventSource.fromJSON(object.eventSource)
        : undefined,
    };
  },

  toJSON(message: SheetUpdated): unknown {
    const obj: any = {};
    if (message.index) {
      obj.index = message.index.map((e) => Math.round(e));
    } else {
      obj.index = [];
    }
    message.eventSource !== undefined &&
      (obj.eventSource = message.eventSource
        ? EventSource.toJSON(message.eventSource)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetUpdated>, I>>(
    object: I
  ): SheetUpdated {
    const message = createBaseSheetUpdated();
    message.index = object.index?.map((e) => e) || [];
    message.eventSource =
      object.eventSource !== undefined && object.eventSource !== null
        ? EventSource.fromPartial(object.eventSource)
        : undefined;
    return message;
  },
};

function createBaseOpenFile(): OpenFile {
  return { fileId: "", content: new Uint8Array(), name: "" };
}

export const OpenFile = {
  encode(
    message: OpenFile,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    if (message.content.length !== 0) {
      writer.uint32(18).bytes(message.content);
    }
    if (message.name !== "") {
      writer.uint32(26).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OpenFile {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOpenFile();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        case 2:
          message.content = reader.bytes();
          break;
        case 3:
          message.name = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): OpenFile {
    return {
      fileId: isSet(object.fileId) ? String(object.fileId) : "",
      content: isSet(object.content)
        ? bytesFromBase64(object.content)
        : new Uint8Array(),
      name: isSet(object.name) ? String(object.name) : "",
    };
  },

  toJSON(message: OpenFile): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    message.content !== undefined &&
      (obj.content = base64FromBytes(
        message.content !== undefined ? message.content : new Uint8Array()
      ));
    message.name !== undefined && (obj.name = message.name);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<OpenFile>, I>>(object: I): OpenFile {
    const message = createBaseOpenFile();
    message.fileId = object.fileId ?? "";
    message.content = object.content ?? new Uint8Array();
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseTransaction(): Transaction {
  return { payloads: [], undo: false, redo: false, undoable: false };
}

export const Transaction = {
  encode(
    message: Transaction,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    for (const v of message.payloads) {
      Payload.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.undo === true) {
      writer.uint32(16).bool(message.undo);
    }
    if (message.redo === true) {
      writer.uint32(24).bool(message.redo);
    }
    if (message.undoable === true) {
      writer.uint32(32).bool(message.undoable);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Transaction {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTransaction();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.payloads.push(Payload.decode(reader, reader.uint32()));
          break;
        case 2:
          message.undo = reader.bool();
          break;
        case 3:
          message.redo = reader.bool();
          break;
        case 4:
          message.undoable = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Transaction {
    return {
      payloads: Array.isArray(object?.payloads)
        ? object.payloads.map((e: any) => Payload.fromJSON(e))
        : [],
      undo: isSet(object.undo) ? Boolean(object.undo) : false,
      redo: isSet(object.redo) ? Boolean(object.redo) : false,
      undoable: isSet(object.undoable) ? Boolean(object.undoable) : false,
    };
  },

  toJSON(message: Transaction): unknown {
    const obj: any = {};
    if (message.payloads) {
      obj.payloads = message.payloads.map((e) =>
        e ? Payload.toJSON(e) : undefined
      );
    } else {
      obj.payloads = [];
    }
    message.undo !== undefined && (obj.undo = message.undo);
    message.redo !== undefined && (obj.redo = message.redo);
    message.undoable !== undefined && (obj.undoable = message.undoable);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Transaction>, I>>(
    object: I
  ): Transaction {
    const message = createBaseTransaction();
    message.payloads =
      object.payloads?.map((e) => Payload.fromPartial(e)) || [];
    message.undo = object.undo ?? false;
    message.redo = object.redo ?? false;
    message.undoable = object.undoable ?? false;
    return message;
  },
};

function createBaseDisplayRequest(): DisplayRequest {
  return { sheetIdx: 0, version: 0 };
}

export const DisplayRequest = {
  encode(
    message: DisplayRequest,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.version !== 0) {
      writer.uint32(16).uint32(message.version);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DisplayRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDisplayRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.version = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DisplayRequest {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      version: isSet(object.version) ? Number(object.version) : 0,
    };
  },

  toJSON(message: DisplayRequest): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.version !== undefined &&
      (obj.version = Math.round(message.version));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<DisplayRequest>, I>>(
    object: I
  ): DisplayRequest {
    const message = createBaseDisplayRequest();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.version = object.version ?? 0;
    return message;
  },
};

function createBaseSheetNames(): SheetNames {
  return { sheetNames: [] };
}

export const SheetNames = {
  encode(
    message: SheetNames,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    for (const v of message.sheetNames) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetNames {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetNames();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetNames.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetNames {
    return {
      sheetNames: Array.isArray(object?.sheetNames)
        ? object.sheetNames.map((e: any) => String(e))
        : [],
    };
  },

  toJSON(message: SheetNames): unknown {
    const obj: any = {};
    if (message.sheetNames) {
      obj.sheetNames = message.sheetNames.map((e) => e);
    } else {
      obj.sheetNames = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetNames>, I>>(
    object: I
  ): SheetNames {
    const message = createBaseSheetNames();
    message.sheetNames = object.sheetNames?.map((e) => e) || [];
    return message;
  },
};

function createBaseComment(): Comment {
  return { row: 0, col: 0, author: "", content: "" };
}

export const Comment = {
  encode(
    message: Comment,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.row !== 0) {
      writer.uint32(8).uint32(message.row);
    }
    if (message.col !== 0) {
      writer.uint32(16).uint32(message.col);
    }
    if (message.author !== "") {
      writer.uint32(26).string(message.author);
    }
    if (message.content !== "") {
      writer.uint32(34).string(message.content);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Comment {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseComment();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.row = reader.uint32();
          break;
        case 2:
          message.col = reader.uint32();
          break;
        case 3:
          message.author = reader.string();
          break;
        case 4:
          message.content = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Comment {
    return {
      row: isSet(object.row) ? Number(object.row) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      author: isSet(object.author) ? String(object.author) : "",
      content: isSet(object.content) ? String(object.content) : "",
    };
  },

  toJSON(message: Comment): unknown {
    const obj: any = {};
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.col !== undefined && (obj.col = Math.round(message.col));
    message.author !== undefined && (obj.author = message.author);
    message.content !== undefined && (obj.content = message.content);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Comment>, I>>(object: I): Comment {
    const message = createBaseComment();
    message.row = object.row ?? 0;
    message.col = object.col ?? 0;
    message.author = object.author ?? "";
    message.content = object.content ?? "";
    return message;
  },
};

function createBaseMergeCell(): MergeCell {
  return { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
}

export const MergeCell = {
  encode(
    message: MergeCell,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.startRow !== 0) {
      writer.uint32(8).uint32(message.startRow);
    }
    if (message.startCol !== 0) {
      writer.uint32(16).uint32(message.startCol);
    }
    if (message.endRow !== 0) {
      writer.uint32(24).uint32(message.endRow);
    }
    if (message.endCol !== 0) {
      writer.uint32(32).uint32(message.endCol);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MergeCell {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMergeCell();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.startRow = reader.uint32();
          break;
        case 2:
          message.startCol = reader.uint32();
          break;
        case 3:
          message.endRow = reader.uint32();
          break;
        case 4:
          message.endCol = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): MergeCell {
    return {
      startRow: isSet(object.rowStart) ? Number(object.rowStart) : 0,
      startCol: isSet(object.colStart) ? Number(object.colStart) : 0,
      endRow: isSet(object.rowEnd) ? Number(object.rowEnd) : 0,
      endCol: isSet(object.colEnd) ? Number(object.colEnd) : 0,
    };
  },

  toJSON(message: MergeCell): unknown {
    const obj: any = {};
    message.startRow !== undefined &&
      (obj.startRow = Math.round(message.startRow));
    message.startCol !== undefined &&
      (obj.startCol = Math.round(message.startCol));
    message.endRow !== undefined && (obj.endRow = Math.round(message.endRow));
    message.endCol !== undefined && (obj.endCol = Math.round(message.endCol));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<MergeCell>, I>>(
    object: I
  ): MergeCell {
    const message = createBaseMergeCell();
    message.startRow = object.startRow ?? 0;
    message.startCol = object.startCol ?? 0;
    message.endRow = object.endRow ?? 0;
    message.endCol = object.endCol ?? 0;
    return message;
  },
};

function createBaseSheetMergeCells(): SheetMergeCells {
  return { idx: 0, mergeCells: [] };
}

export const SheetMergeCells = {
  encode(
    message: SheetMergeCells,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.idx !== 0) {
      writer.uint32(8).uint32(message.idx);
    }
    for (const v of message.mergeCells) {
      MergeCell.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetMergeCells {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetMergeCells();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.idx = reader.uint32();
          break;
        case 2:
          message.mergeCells.push(MergeCell.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetMergeCells {
    return {
      idx: isSet(object.idx) ? Number(object.idx) : 0,
      mergeCells: Array.isArray(object?.mergeCells)
        ? object.mergeCells.map((e: any) => MergeCell.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SheetMergeCells): unknown {
    const obj: any = {};
    message.idx !== undefined && (obj.idx = Math.round(message.idx));
    if (message.mergeCells) {
      obj.mergeCells = message.mergeCells.map((e) =>
        e ? MergeCell.toJSON(e) : undefined
      );
    } else {
      obj.mergeCells = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetMergeCells>, I>>(
    object: I
  ): SheetMergeCells {
    const message = createBaseSheetMergeCells();
    message.idx = object.idx ?? 0;
    message.mergeCells =
      object.mergeCells?.map((e) => MergeCell.fromPartial(e)) || [];
    return message;
  },
};

function createBaseSheetComments(): SheetComments {
  return { idx: 0, comment: [] };
}

export const SheetComments = {
  encode(
    message: SheetComments,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.idx !== 0) {
      writer.uint32(8).uint32(message.idx);
    }
    for (const v of message.comment) {
      Comment.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetComments {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetComments();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.idx = reader.uint32();
          break;
        case 2:
          message.comment.push(Comment.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetComments {
    return {
      idx: isSet(object.idx) ? Number(object.idx) : 0,
      comment: Array.isArray(object?.comment)
        ? object.comment.map((e: any) => Comment.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SheetComments): unknown {
    const obj: any = {};
    message.idx !== undefined && (obj.idx = Math.round(message.idx));
    if (message.comment) {
      obj.comment = message.comment.map((e) =>
        e ? Comment.toJSON(e) : undefined
      );
    } else {
      obj.comment = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetComments>, I>>(
    object: I
  ): SheetComments {
    const message = createBaseSheetComments();
    message.idx = object.idx ?? 0;
    message.comment = object.comment?.map((e) => Comment.fromPartial(e)) || [];
    return message;
  },
};

function createBaseRowInfo(): RowInfo {
  return { idx: 0, height: 0, hidden: false };
}

export const RowInfo = {
  encode(
    message: RowInfo,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.idx !== 0) {
      writer.uint32(8).uint32(message.idx);
    }
    if (message.height !== 0) {
      writer.uint32(17).double(message.height);
    }
    if (message.hidden === true) {
      writer.uint32(24).bool(message.hidden);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RowInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRowInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.idx = reader.uint32();
          break;
        case 2:
          message.height = reader.double();
          break;
        case 3:
          message.hidden = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RowInfo {
    return {
      idx: isSet(object.idx) ? Number(object.idx) : 0,
      height: isSet(object.height) ? Number(object.height) : 0,
      hidden: isSet(object.hidden) ? Boolean(object.hidden) : false,
    };
  },

  toJSON(message: RowInfo): unknown {
    const obj: any = {};
    message.idx !== undefined && (obj.idx = Math.round(message.idx));
    message.height !== undefined && (obj.height = message.height);
    message.hidden !== undefined && (obj.hidden = message.hidden);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<RowInfo>, I>>(object: I): RowInfo {
    const message = createBaseRowInfo();
    message.idx = object.idx ?? 0;
    message.height = object.height ?? 0;
    message.hidden = object.hidden ?? false;
    return message;
  },
};

function createBaseColInfo(): ColInfo {
  return { idx: 0, width: 0, hidden: false };
}

export const ColInfo = {
  encode(
    message: ColInfo,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.idx !== 0) {
      writer.uint32(8).uint32(message.idx);
    }
    if (message.width !== 0) {
      writer.uint32(17).double(message.width);
    }
    if (message.hidden === true) {
      writer.uint32(24).bool(message.hidden);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ColInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseColInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.idx = reader.uint32();
          break;
        case 2:
          message.width = reader.double();
          break;
        case 3:
          message.hidden = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ColInfo {
    return {
      idx: isSet(object.idx) ? Number(object.idx) : 0,
      width: isSet(object.width) ? Number(object.width) : 0,
      hidden: isSet(object.hidden) ? Boolean(object.hidden) : false,
    };
  },

  toJSON(message: ColInfo): unknown {
    const obj: any = {};
    message.idx !== undefined && (obj.idx = Math.round(message.idx));
    message.width !== undefined && (obj.width = message.width);
    message.hidden !== undefined && (obj.hidden = message.hidden);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ColInfo>, I>>(object: I): ColInfo {
    const message = createBaseColInfo();
    message.idx = object.idx ?? 0;
    message.width = object.width ?? 0;
    message.hidden = object.hidden ?? false;
    return message;
  },
};

function createBaseSheetRowInfo(): SheetRowInfo {
  return { sheetIdx: 0, info: [], defaultHeight: 0 };
}

export const SheetRowInfo = {
  encode(
    message: SheetRowInfo,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    for (const v of message.info) {
      RowInfo.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.defaultHeight !== 0) {
      writer.uint32(25).double(message.defaultHeight);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetRowInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetRowInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.info.push(RowInfo.decode(reader, reader.uint32()));
          break;
        case 3:
          message.defaultHeight = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetRowInfo {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      info: Array.isArray(object?.info)
        ? object.info.map((e: any) => RowInfo.fromJSON(e))
        : [],
      defaultHeight: isSet(object.defaultHeight)
        ? Number(object.defaultHeight)
        : 0,
    };
  },

  toJSON(message: SheetRowInfo): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    if (message.info) {
      obj.info = message.info.map((e) => (e ? RowInfo.toJSON(e) : undefined));
    } else {
      obj.info = [];
    }
    message.defaultHeight !== undefined &&
      (obj.defaultHeight = message.defaultHeight);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetRowInfo>, I>>(
    object: I
  ): SheetRowInfo {
    const message = createBaseSheetRowInfo();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.info = object.info?.map((e) => RowInfo.fromPartial(e)) || [];
    message.defaultHeight = object.defaultHeight ?? 0;
    return message;
  },
};

function createBaseSheetColInfo(): SheetColInfo {
  return { sheetIdx: 0, info: [], defaultWidth: 0 };
}

export const SheetColInfo = {
  encode(
    message: SheetColInfo,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    for (const v of message.info) {
      ColInfo.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.defaultWidth !== 0) {
      writer.uint32(25).double(message.defaultWidth);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetColInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetColInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.info.push(ColInfo.decode(reader, reader.uint32()));
          break;
        case 3:
          message.defaultWidth = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetColInfo {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      info: Array.isArray(object?.info)
        ? object.info.map((e: any) => ColInfo.fromJSON(e))
        : [],
      defaultWidth: isSet(object.defaultWidth)
        ? Number(object.defaultWidth)
        : 0,
    };
  },

  toJSON(message: SheetColInfo): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    if (message.info) {
      obj.info = message.info.map((e) => (e ? ColInfo.toJSON(e) : undefined));
    } else {
      obj.info = [];
    }
    message.defaultWidth !== undefined &&
      (obj.defaultWidth = message.defaultWidth);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetColInfo>, I>>(
    object: I
  ): SheetColInfo {
    const message = createBaseSheetColInfo();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.info = object.info?.map((e) => ColInfo.fromPartial(e)) || [];
    message.defaultWidth = object.defaultWidth ?? 0;
    return message;
  },
};

function createBaseDisplayResponse(): DisplayResponse {
  return { patches: [] };
}

export const DisplayResponse = {
  encode(
    message: DisplayResponse,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    for (const v of message.patches) {
      DisplayPatch.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DisplayResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDisplayResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.patches.push(DisplayPatch.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DisplayResponse {
    return {
      patches: Array.isArray(object?.patches)
        ? object.patches.map((e: any) => DisplayPatch.fromJSON(e))
        : [],
    };
  },

  toJSON(message: DisplayResponse): unknown {
    const obj: any = {};
    if (message.patches) {
      obj.patches = message.patches.map((e) =>
        e ? DisplayPatch.toJSON(e) : undefined
      );
    } else {
      obj.patches = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<DisplayResponse>, I>>(
    object: I
  ): DisplayResponse {
    const message = createBaseDisplayResponse();
    message.patches =
      object.patches?.map((e) => DisplayPatch.fromPartial(e)) || [];
    return message;
  },
};

function createBaseDisplayPatch(): DisplayPatch {
  return { displayPatchOneof: undefined };
}

export const DisplayPatch = {
  encode(
    message: DisplayPatch,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.displayPatchOneof?.$case === "values") {
      SheetValues.encode(
        message.displayPatchOneof.values,
        writer.uint32(10).fork()
      ).ldelim();
    }
    if (message.displayPatchOneof?.$case === "styles") {
      SheetStyles.encode(
        message.displayPatchOneof.styles,
        writer.uint32(18).fork()
      ).ldelim();
    }
    if (message.displayPatchOneof?.$case === "rowInfo") {
      SheetRowInfo.encode(
        message.displayPatchOneof.rowInfo,
        writer.uint32(26).fork()
      ).ldelim();
    }
    if (message.displayPatchOneof?.$case === "colInfo") {
      SheetColInfo.encode(
        message.displayPatchOneof.colInfo,
        writer.uint32(34).fork()
      ).ldelim();
    }
    if (message.displayPatchOneof?.$case === "sheetNames") {
      SheetNames.encode(
        message.displayPatchOneof.sheetNames,
        writer.uint32(42).fork()
      ).ldelim();
    }
    if (message.displayPatchOneof?.$case === "mergeCells") {
      SheetMergeCells.encode(
        message.displayPatchOneof.mergeCells,
        writer.uint32(50).fork()
      ).ldelim();
    }
    if (message.displayPatchOneof?.$case === "comments") {
      SheetComments.encode(
        message.displayPatchOneof.comments,
        writer.uint32(58).fork()
      ).ldelim();
    }
    if (message.displayPatchOneof?.$case === "blocks") {
      SheetBlocks.encode(
        message.displayPatchOneof.blocks,
        writer.uint32(66).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DisplayPatch {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDisplayPatch();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.displayPatchOneof = {
            $case: "values",
            values: SheetValues.decode(reader, reader.uint32()),
          };
          break;
        case 2:
          message.displayPatchOneof = {
            $case: "styles",
            styles: SheetStyles.decode(reader, reader.uint32()),
          };
          break;
        case 3:
          message.displayPatchOneof = {
            $case: "rowInfo",
            rowInfo: SheetRowInfo.decode(reader, reader.uint32()),
          };
          break;
        case 4:
          message.displayPatchOneof = {
            $case: "colInfo",
            colInfo: SheetColInfo.decode(reader, reader.uint32()),
          };
          break;
        case 5:
          message.displayPatchOneof = {
            $case: "sheetNames",
            sheetNames: SheetNames.decode(reader, reader.uint32()),
          };
          break;
        case 6:
          message.displayPatchOneof = {
            $case: "mergeCells",
            mergeCells: SheetMergeCells.decode(reader, reader.uint32()),
          };
          break;
        case 7:
          message.displayPatchOneof = {
            $case: "comments",
            comments: SheetComments.decode(reader, reader.uint32()),
          };
          break;
        case 8:
          message.displayPatchOneof = {
            $case: "blocks",
            blocks: SheetBlocks.decode(reader, reader.uint32()),
          };
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): DisplayPatch {
    return {
      displayPatchOneof: isSet(object.values)
        ? { $case: "values", values: SheetValues.fromJSON(object.values) }
        : isSet(object.styles)
        ? { $case: "styles", styles: SheetStyles.fromJSON(object.styles) }
        : isSet(object.rowInfo)
        ? { $case: "rowInfo", rowInfo: SheetRowInfo.fromJSON(object.rowInfo) }
        : isSet(object.colInfo)
        ? { $case: "colInfo", colInfo: SheetColInfo.fromJSON(object.colInfo) }
        : isSet(object.sheetNames)
        ? {
            $case: "sheetNames",
            sheetNames: SheetNames.fromJSON(object.sheetNames),
          }
        : isSet(object.mergeCells)
        ? {
            $case: "mergeCells",
            mergeCells: SheetMergeCells.fromJSON(object.mergeCells),
          }
        : isSet(object.comments)
        ? {
            $case: "comments",
            comments: SheetComments.fromJSON(object.comments),
          }
        : isSet(object.blocks)
        ? { $case: "blocks", blocks: SheetBlocks.fromJSON(object.blocks) }
        : undefined,
    };
  },

  toJSON(message: DisplayPatch): unknown {
    const obj: any = {};
    message.displayPatchOneof?.$case === "values" &&
      (obj.values = message.displayPatchOneof?.values
        ? SheetValues.toJSON(message.displayPatchOneof?.values)
        : undefined);
    message.displayPatchOneof?.$case === "styles" &&
      (obj.styles = message.displayPatchOneof?.styles
        ? SheetStyles.toJSON(message.displayPatchOneof?.styles)
        : undefined);
    message.displayPatchOneof?.$case === "rowInfo" &&
      (obj.rowInfo = message.displayPatchOneof?.rowInfo
        ? SheetRowInfo.toJSON(message.displayPatchOneof?.rowInfo)
        : undefined);
    message.displayPatchOneof?.$case === "colInfo" &&
      (obj.colInfo = message.displayPatchOneof?.colInfo
        ? SheetColInfo.toJSON(message.displayPatchOneof?.colInfo)
        : undefined);
    message.displayPatchOneof?.$case === "sheetNames" &&
      (obj.sheetNames = message.displayPatchOneof?.sheetNames
        ? SheetNames.toJSON(message.displayPatchOneof?.sheetNames)
        : undefined);
    message.displayPatchOneof?.$case === "mergeCells" &&
      (obj.mergeCells = message.displayPatchOneof?.mergeCells
        ? SheetMergeCells.toJSON(message.displayPatchOneof?.mergeCells)
        : undefined);
    message.displayPatchOneof?.$case === "comments" &&
      (obj.comments = message.displayPatchOneof?.comments
        ? SheetComments.toJSON(message.displayPatchOneof?.comments)
        : undefined);
    message.displayPatchOneof?.$case === "blocks" &&
      (obj.blocks = message.displayPatchOneof?.blocks
        ? SheetBlocks.toJSON(message.displayPatchOneof?.blocks)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<DisplayPatch>, I>>(
    object: I
  ): DisplayPatch {
    const message = createBaseDisplayPatch();
    if (
      object.displayPatchOneof?.$case === "values" &&
      object.displayPatchOneof?.values !== undefined &&
      object.displayPatchOneof?.values !== null
    ) {
      message.displayPatchOneof = {
        $case: "values",
        values: SheetValues.fromPartial(object.displayPatchOneof.values),
      };
    }
    if (
      object.displayPatchOneof?.$case === "styles" &&
      object.displayPatchOneof?.styles !== undefined &&
      object.displayPatchOneof?.styles !== null
    ) {
      message.displayPatchOneof = {
        $case: "styles",
        styles: SheetStyles.fromPartial(object.displayPatchOneof.styles),
      };
    }
    if (
      object.displayPatchOneof?.$case === "rowInfo" &&
      object.displayPatchOneof?.rowInfo !== undefined &&
      object.displayPatchOneof?.rowInfo !== null
    ) {
      message.displayPatchOneof = {
        $case: "rowInfo",
        rowInfo: SheetRowInfo.fromPartial(object.displayPatchOneof.rowInfo),
      };
    }
    if (
      object.displayPatchOneof?.$case === "colInfo" &&
      object.displayPatchOneof?.colInfo !== undefined &&
      object.displayPatchOneof?.colInfo !== null
    ) {
      message.displayPatchOneof = {
        $case: "colInfo",
        colInfo: SheetColInfo.fromPartial(object.displayPatchOneof.colInfo),
      };
    }
    if (
      object.displayPatchOneof?.$case === "sheetNames" &&
      object.displayPatchOneof?.sheetNames !== undefined &&
      object.displayPatchOneof?.sheetNames !== null
    ) {
      message.displayPatchOneof = {
        $case: "sheetNames",
        sheetNames: SheetNames.fromPartial(object.displayPatchOneof.sheetNames),
      };
    }
    if (
      object.displayPatchOneof?.$case === "mergeCells" &&
      object.displayPatchOneof?.mergeCells !== undefined &&
      object.displayPatchOneof?.mergeCells !== null
    ) {
      message.displayPatchOneof = {
        $case: "mergeCells",
        mergeCells: SheetMergeCells.fromPartial(
          object.displayPatchOneof.mergeCells
        ),
      };
    }
    if (
      object.displayPatchOneof?.$case === "comments" &&
      object.displayPatchOneof?.comments !== undefined &&
      object.displayPatchOneof?.comments !== null
    ) {
      message.displayPatchOneof = {
        $case: "comments",
        comments: SheetComments.fromPartial(object.displayPatchOneof.comments),
      };
    }
    if (
      object.displayPatchOneof?.$case === "blocks" &&
      object.displayPatchOneof?.blocks !== undefined &&
      object.displayPatchOneof?.blocks !== null
    ) {
      message.displayPatchOneof = {
        $case: "blocks",
        blocks: SheetBlocks.fromPartial(object.displayPatchOneof.blocks),
      };
    }
    return message;
  },
};

function createBaseSheetBlocks(): SheetBlocks {
  return { sheetIdx: 0, blockInfo: [] };
}

export const SheetBlocks = {
  encode(
    message: SheetBlocks,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    for (const v of message.blockInfo) {
      BlockInfo.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetBlocks {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetBlocks();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.blockInfo.push(BlockInfo.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetBlocks {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      blockInfo: Array.isArray(object?.blockInfo)
        ? object.blockInfo.map((e: any) => BlockInfo.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SheetBlocks): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    if (message.blockInfo) {
      obj.blockInfo = message.blockInfo.map((e) =>
        e ? BlockInfo.toJSON(e) : undefined
      );
    } else {
      obj.blockInfo = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetBlocks>, I>>(
    object: I
  ): SheetBlocks {
    const message = createBaseSheetBlocks();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.blockInfo =
      object.blockInfo?.map((e) => BlockInfo.fromPartial(e)) || [];
    return message;
  },
};

function createBaseBlockInfo(): BlockInfo {
  return { blockId: 0, rowStart: 0, colStart: 0, rowCnt: 0, colCnt: 0 };
}

export const BlockInfo = {
  encode(
    message: BlockInfo,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.blockId !== 0) {
      writer.uint32(8).uint32(message.blockId);
    }
    if (message.rowStart !== 0) {
      writer.uint32(16).uint32(message.rowStart);
    }
    if (message.colStart !== 0) {
      writer.uint32(24).uint32(message.colStart);
    }
    if (message.rowCnt !== 0) {
      writer.uint32(32).uint32(message.rowCnt);
    }
    if (message.colCnt !== 0) {
      writer.uint32(40).uint32(message.colCnt);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BlockInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBlockInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.blockId = reader.uint32();
          break;
        case 2:
          message.rowStart = reader.uint32();
          break;
        case 3:
          message.colStart = reader.uint32();
          break;
        case 4:
          message.rowCnt = reader.uint32();
          break;
        case 5:
          message.colCnt = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BlockInfo {
    return {
      blockId: isSet(object.blockId) ? Number(object.blockId) : 0,
      rowStart: isSet(object.rowStart) ? Number(object.rowStart) : 0,
      colStart: isSet(object.colStart) ? Number(object.colStart) : 0,
      rowCnt: isSet(object.rowCnt) ? Number(object.rowCnt) : 0,
      colCnt: isSet(object.colCnt) ? Number(object.colCnt) : 0,
    };
  },

  toJSON(message: BlockInfo): unknown {
    const obj: any = {};
    message.blockId !== undefined &&
      (obj.blockId = Math.round(message.blockId));
    message.rowStart !== undefined &&
      (obj.rowStart = Math.round(message.rowStart));
    message.colStart !== undefined &&
      (obj.colStart = Math.round(message.colStart));
    message.rowCnt !== undefined && (obj.rowCnt = Math.round(message.rowCnt));
    message.colCnt !== undefined && (obj.colCnt = Math.round(message.colCnt));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<BlockInfo>, I>>(
    object: I
  ): BlockInfo {
    const message = createBaseBlockInfo();
    message.blockId = object.blockId ?? 0;
    message.rowStart = object.rowStart ?? 0;
    message.colStart = object.colStart ?? 0;
    message.rowCnt = object.rowCnt ?? 0;
    message.colCnt = object.colCnt ?? 0;
    return message;
  },
};

function createBaseSheetStyles(): SheetStyles {
  return { sheetIdx: 0, styles: [] };
}

export const SheetStyles = {
  encode(
    message: SheetStyles,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    for (const v of message.styles) {
      CellStyle.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetStyles {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetStyles();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.styles.push(CellStyle.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetStyles {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      styles: Array.isArray(object?.styles)
        ? object.styles.map((e: any) => CellStyle.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SheetStyles): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    if (message.styles) {
      obj.styles = message.styles.map((e) =>
        e ? CellStyle.toJSON(e) : undefined
      );
    } else {
      obj.styles = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetStyles>, I>>(
    object: I
  ): SheetStyles {
    const message = createBaseSheetStyles();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.styles = object.styles?.map((e) => CellStyle.fromPartial(e)) || [];
    return message;
  },
};

function createBaseSheetValues(): SheetValues {
  return { sheetIdx: 0, values: [] };
}

export const SheetValues = {
  encode(
    message: SheetValues,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    for (const v of message.values) {
      CellValue.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetValues {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetValues();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.values.push(CellValue.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetValues {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      values: Array.isArray(object?.values)
        ? object.values.map((e: any) => CellValue.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SheetValues): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    if (message.values) {
      obj.values = message.values.map((e) =>
        e ? CellValue.toJSON(e) : undefined
      );
    } else {
      obj.values = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetValues>, I>>(
    object: I
  ): SheetValues {
    const message = createBaseSheetValues();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.values = object.values?.map((e) => CellValue.fromPartial(e)) || [];
    return message;
  },
};

function createBaseValue(): Value {
  return { cellValueOneof: undefined };
}

export const Value = {
  encode(message: Value, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.cellValueOneof?.$case === "str") {
      writer.uint32(10).string(message.cellValueOneof.str);
    }
    if (message.cellValueOneof?.$case === "number") {
      writer.uint32(17).double(message.cellValueOneof.number);
    }
    if (message.cellValueOneof?.$case === "bool") {
      writer.uint32(24).bool(message.cellValueOneof.bool);
    }
    if (message.cellValueOneof?.$case === "error") {
      writer.uint32(34).string(message.cellValueOneof.error);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Value {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseValue();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.cellValueOneof = { $case: "str", str: reader.string() };
          break;
        case 2:
          message.cellValueOneof = { $case: "number", number: reader.double() };
          break;
        case 3:
          message.cellValueOneof = { $case: "bool", bool: reader.bool() };
          break;
        case 4:
          message.cellValueOneof = { $case: "error", error: reader.string() };
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Value {
    return {
      cellValueOneof: isSet(object.str)
        ? { $case: "str", str: String(object.str) }
        : isSet(object.number)
        ? { $case: "number", number: Number(object.number) }
        : isSet(object.bool)
        ? { $case: "bool", bool: Boolean(object.bool) }
        : isSet(object.error)
        ? { $case: "error", error: String(object.error) }
        : undefined,
    };
  },

  toJSON(message: Value): unknown {
    const obj: any = {};
    message.cellValueOneof?.$case === "str" &&
      (obj.str = message.cellValueOneof?.str);
    message.cellValueOneof?.$case === "number" &&
      (obj.number = message.cellValueOneof?.number);
    message.cellValueOneof?.$case === "bool" &&
      (obj.bool = message.cellValueOneof?.bool);
    message.cellValueOneof?.$case === "error" &&
      (obj.error = message.cellValueOneof?.error);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Value>, I>>(object: I): Value {
    const message = createBaseValue();
    if (
      object.cellValueOneof?.$case === "str" &&
      object.cellValueOneof?.str !== undefined &&
      object.cellValueOneof?.str !== null
    ) {
      message.cellValueOneof = { $case: "str", str: object.cellValueOneof.str };
    }
    if (
      object.cellValueOneof?.$case === "number" &&
      object.cellValueOneof?.number !== undefined &&
      object.cellValueOneof?.number !== null
    ) {
      message.cellValueOneof = {
        $case: "number",
        number: object.cellValueOneof.number,
      };
    }
    if (
      object.cellValueOneof?.$case === "bool" &&
      object.cellValueOneof?.bool !== undefined &&
      object.cellValueOneof?.bool !== null
    ) {
      message.cellValueOneof = {
        $case: "bool",
        bool: object.cellValueOneof.bool,
      };
    }
    if (
      object.cellValueOneof?.$case === "error" &&
      object.cellValueOneof?.error !== undefined &&
      object.cellValueOneof?.error !== null
    ) {
      message.cellValueOneof = {
        $case: "error",
        error: object.cellValueOneof.error,
      };
    }
    return message;
  },
};

function createBaseCellStyle(): CellStyle {
  return { row: 0, col: 0, style: undefined };
}

export const CellStyle = {
  encode(
    message: CellStyle,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.row !== 0) {
      writer.uint32(8).uint32(message.row);
    }
    if (message.col !== 0) {
      writer.uint32(16).uint32(message.col);
    }
    if (message.style !== undefined) {
      Style.encode(message.style, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CellStyle {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCellStyle();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.row = reader.uint32();
          break;
        case 2:
          message.col = reader.uint32();
          break;
        case 3:
          message.style = Style.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CellStyle {
    return {
      row: isSet(object.row) ? Number(object.row) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      style: isSet(object.style) ? Style.fromJSON(object.style) : undefined,
    };
  },

  toJSON(message: CellStyle): unknown {
    const obj: any = {};
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.col !== undefined && (obj.col = Math.round(message.col));
    message.style !== undefined &&
      (obj.style = message.style ? Style.toJSON(message.style) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<CellStyle>, I>>(
    object: I
  ): CellStyle {
    const message = createBaseCellStyle();
    message.row = object.row ?? 0;
    message.col = object.col ?? 0;
    message.style =
      object.style !== undefined && object.style !== null
        ? Style.fromPartial(object.style)
        : undefined;
    return message;
  },
};

function createBaseCellValue(): CellValue {
  return { row: 0, col: 0, value: undefined, formula: "" };
}

export const CellValue = {
  encode(
    message: CellValue,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.row !== 0) {
      writer.uint32(8).uint32(message.row);
    }
    if (message.col !== 0) {
      writer.uint32(16).uint32(message.col);
    }
    if (message.value !== undefined) {
      Value.encode(message.value, writer.uint32(26).fork()).ldelim();
    }
    if (message.formula !== "") {
      writer.uint32(34).string(message.formula);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CellValue {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCellValue();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.row = reader.uint32();
          break;
        case 2:
          message.col = reader.uint32();
          break;
        case 3:
          message.value = Value.decode(reader, reader.uint32());
          break;
        case 4:
          message.formula = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CellValue {
    return {
      row: isSet(object.row) ? Number(object.row) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      value: isSet(object.value) ? Value.fromJSON(object.value) : undefined,
      formula: isSet(object.formula) ? String(object.formula) : "",
    };
  },

  toJSON(message: CellValue): unknown {
    const obj: any = {};
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.col !== undefined && (obj.col = Math.round(message.col));
    message.value !== undefined &&
      (obj.value = message.value ? Value.toJSON(message.value) : undefined);
    message.formula !== undefined && (obj.formula = message.formula);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<CellValue>, I>>(
    object: I
  ): CellValue {
    const message = createBaseCellValue();
    message.row = object.row ?? 0;
    message.col = object.col ?? 0;
    message.value =
      object.value !== undefined && object.value !== null
        ? Value.fromPartial(object.value)
        : undefined;
    message.formula = object.formula ?? "";
    return message;
  },
};

function createBasePayload(): Payload {
  return { payloadOneof: undefined };
}

export const Payload = {
  encode(
    message: Payload,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.payloadOneof?.$case === "cellInput") {
      CellInput.encode(
        message.payloadOneof.cellInput,
        writer.uint32(10).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "rowShift") {
      RowShift.encode(
        message.payloadOneof.rowShift,
        writer.uint32(18).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "columnShift") {
      ColumnShift.encode(
        message.payloadOneof.columnShift,
        writer.uint32(26).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "sheetRename") {
      SheetRename.encode(
        message.payloadOneof.sheetRename,
        writer.uint32(34).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "sheetShift") {
      SheetShift.encode(
        message.payloadOneof.sheetShift,
        writer.uint32(42).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "styleUpdate") {
      StyleUpdate.encode(
        message.payloadOneof.styleUpdate,
        writer.uint32(50).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "createBlock") {
      CreateBlock.encode(
        message.payloadOneof.createBlock,
        writer.uint32(58).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "moveBlock") {
      MoveBlock.encode(
        message.payloadOneof.moveBlock,
        writer.uint32(66).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "blockInput") {
      BlockInput.encode(
        message.payloadOneof.blockInput,
        writer.uint32(74).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "blockStyleUpdate") {
      BlockStyleUpdate.encode(
        message.payloadOneof.blockStyleUpdate,
        writer.uint32(82).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "lineShiftInBlock") {
      LineShiftInBlock.encode(
        message.payloadOneof.lineShiftInBlock,
        writer.uint32(90).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "setRowHeight") {
      SetRowHeight.encode(
        message.payloadOneof.setRowHeight,
        writer.uint32(98).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "setColWidth") {
      SetColWidth.encode(
        message.payloadOneof.setColWidth,
        writer.uint32(106).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "setRowVisible") {
      SetRowVisible.encode(
        message.payloadOneof.setRowVisible,
        writer.uint32(114).fork()
      ).ldelim();
    }
    if (message.payloadOneof?.$case === "setColVisible") {
      SetColVisible.encode(
        message.payloadOneof.setColVisible,
        writer.uint32(122).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Payload {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePayload();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.payloadOneof = {
            $case: "cellInput",
            cellInput: CellInput.decode(reader, reader.uint32()),
          };
          break;
        case 2:
          message.payloadOneof = {
            $case: "rowShift",
            rowShift: RowShift.decode(reader, reader.uint32()),
          };
          break;
        case 3:
          message.payloadOneof = {
            $case: "columnShift",
            columnShift: ColumnShift.decode(reader, reader.uint32()),
          };
          break;
        case 4:
          message.payloadOneof = {
            $case: "sheetRename",
            sheetRename: SheetRename.decode(reader, reader.uint32()),
          };
          break;
        case 5:
          message.payloadOneof = {
            $case: "sheetShift",
            sheetShift: SheetShift.decode(reader, reader.uint32()),
          };
          break;
        case 6:
          message.payloadOneof = {
            $case: "styleUpdate",
            styleUpdate: StyleUpdate.decode(reader, reader.uint32()),
          };
          break;
        case 7:
          message.payloadOneof = {
            $case: "createBlock",
            createBlock: CreateBlock.decode(reader, reader.uint32()),
          };
          break;
        case 8:
          message.payloadOneof = {
            $case: "moveBlock",
            moveBlock: MoveBlock.decode(reader, reader.uint32()),
          };
          break;
        case 9:
          message.payloadOneof = {
            $case: "blockInput",
            blockInput: BlockInput.decode(reader, reader.uint32()),
          };
          break;
        case 10:
          message.payloadOneof = {
            $case: "blockStyleUpdate",
            blockStyleUpdate: BlockStyleUpdate.decode(reader, reader.uint32()),
          };
          break;
        case 11:
          message.payloadOneof = {
            $case: "lineShiftInBlock",
            lineShiftInBlock: LineShiftInBlock.decode(reader, reader.uint32()),
          };
          break;
        case 12:
          message.payloadOneof = {
            $case: "setRowHeight",
            setRowHeight: SetRowHeight.decode(reader, reader.uint32()),
          };
          break;
        case 13:
          message.payloadOneof = {
            $case: "setColWidth",
            setColWidth: SetColWidth.decode(reader, reader.uint32()),
          };
          break;
        case 14:
          message.payloadOneof = {
            $case: "setRowVisible",
            setRowVisible: SetRowVisible.decode(reader, reader.uint32()),
          };
          break;
        case 15:
          message.payloadOneof = {
            $case: "setColVisible",
            setColVisible: SetColVisible.decode(reader, reader.uint32()),
          };
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Payload {
    return {
      payloadOneof: isSet(object.cellInput)
        ? {
            $case: "cellInput",
            cellInput: CellInput.fromJSON(object.cellInput),
          }
        : isSet(object.rowShift)
        ? { $case: "rowShift", rowShift: RowShift.fromJSON(object.rowShift) }
        : isSet(object.columnShift)
        ? {
            $case: "columnShift",
            columnShift: ColumnShift.fromJSON(object.columnShift),
          }
        : isSet(object.sheetRename)
        ? {
            $case: "sheetRename",
            sheetRename: SheetRename.fromJSON(object.sheetRename),
          }
        : isSet(object.sheetShift)
        ? {
            $case: "sheetShift",
            sheetShift: SheetShift.fromJSON(object.sheetShift),
          }
        : isSet(object.styleUpdate)
        ? {
            $case: "styleUpdate",
            styleUpdate: StyleUpdate.fromJSON(object.styleUpdate),
          }
        : isSet(object.createBlock)
        ? {
            $case: "createBlock",
            createBlock: CreateBlock.fromJSON(object.createBlock),
          }
        : isSet(object.moveBlock)
        ? {
            $case: "moveBlock",
            moveBlock: MoveBlock.fromJSON(object.moveBlock),
          }
        : isSet(object.blockInput)
        ? {
            $case: "blockInput",
            blockInput: BlockInput.fromJSON(object.blockInput),
          }
        : isSet(object.blockStyleUpdate)
        ? {
            $case: "blockStyleUpdate",
            blockStyleUpdate: BlockStyleUpdate.fromJSON(
              object.blockStyleUpdate
            ),
          }
        : isSet(object.lineShiftInBlock)
        ? {
            $case: "lineShiftInBlock",
            lineShiftInBlock: LineShiftInBlock.fromJSON(
              object.lineShiftInBlock
            ),
          }
        : isSet(object.setRowHeight)
        ? {
            $case: "setRowHeight",
            setRowHeight: SetRowHeight.fromJSON(object.setRowHeight),
          }
        : isSet(object.setColWidth)
        ? {
            $case: "setColWidth",
            setColWidth: SetColWidth.fromJSON(object.setColWidth),
          }
        : isSet(object.setRowVisible)
        ? {
            $case: "setRowVisible",
            setRowVisible: SetRowVisible.fromJSON(object.setRowVisible),
          }
        : isSet(object.setColVisible)
        ? {
            $case: "setColVisible",
            setColVisible: SetColVisible.fromJSON(object.setColVisible),
          }
        : undefined,
    };
  },

  toJSON(message: Payload): unknown {
    const obj: any = {};
    message.payloadOneof?.$case === "cellInput" &&
      (obj.cellInput = message.payloadOneof?.cellInput
        ? CellInput.toJSON(message.payloadOneof?.cellInput)
        : undefined);
    message.payloadOneof?.$case === "rowShift" &&
      (obj.rowShift = message.payloadOneof?.rowShift
        ? RowShift.toJSON(message.payloadOneof?.rowShift)
        : undefined);
    message.payloadOneof?.$case === "columnShift" &&
      (obj.columnShift = message.payloadOneof?.columnShift
        ? ColumnShift.toJSON(message.payloadOneof?.columnShift)
        : undefined);
    message.payloadOneof?.$case === "sheetRename" &&
      (obj.sheetRename = message.payloadOneof?.sheetRename
        ? SheetRename.toJSON(message.payloadOneof?.sheetRename)
        : undefined);
    message.payloadOneof?.$case === "sheetShift" &&
      (obj.sheetShift = message.payloadOneof?.sheetShift
        ? SheetShift.toJSON(message.payloadOneof?.sheetShift)
        : undefined);
    message.payloadOneof?.$case === "styleUpdate" &&
      (obj.styleUpdate = message.payloadOneof?.styleUpdate
        ? StyleUpdate.toJSON(message.payloadOneof?.styleUpdate)
        : undefined);
    message.payloadOneof?.$case === "createBlock" &&
      (obj.createBlock = message.payloadOneof?.createBlock
        ? CreateBlock.toJSON(message.payloadOneof?.createBlock)
        : undefined);
    message.payloadOneof?.$case === "moveBlock" &&
      (obj.moveBlock = message.payloadOneof?.moveBlock
        ? MoveBlock.toJSON(message.payloadOneof?.moveBlock)
        : undefined);
    message.payloadOneof?.$case === "blockInput" &&
      (obj.blockInput = message.payloadOneof?.blockInput
        ? BlockInput.toJSON(message.payloadOneof?.blockInput)
        : undefined);
    message.payloadOneof?.$case === "blockStyleUpdate" &&
      (obj.blockStyleUpdate = message.payloadOneof?.blockStyleUpdate
        ? BlockStyleUpdate.toJSON(message.payloadOneof?.blockStyleUpdate)
        : undefined);
    message.payloadOneof?.$case === "lineShiftInBlock" &&
      (obj.lineShiftInBlock = message.payloadOneof?.lineShiftInBlock
        ? LineShiftInBlock.toJSON(message.payloadOneof?.lineShiftInBlock)
        : undefined);
    message.payloadOneof?.$case === "setRowHeight" &&
      (obj.setRowHeight = message.payloadOneof?.setRowHeight
        ? SetRowHeight.toJSON(message.payloadOneof?.setRowHeight)
        : undefined);
    message.payloadOneof?.$case === "setColWidth" &&
      (obj.setColWidth = message.payloadOneof?.setColWidth
        ? SetColWidth.toJSON(message.payloadOneof?.setColWidth)
        : undefined);
    message.payloadOneof?.$case === "setRowVisible" &&
      (obj.setRowVisible = message.payloadOneof?.setRowVisible
        ? SetRowVisible.toJSON(message.payloadOneof?.setRowVisible)
        : undefined);
    message.payloadOneof?.$case === "setColVisible" &&
      (obj.setColVisible = message.payloadOneof?.setColVisible
        ? SetColVisible.toJSON(message.payloadOneof?.setColVisible)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Payload>, I>>(object: I): Payload {
    const message = createBasePayload();
    if (
      object.payloadOneof?.$case === "cellInput" &&
      object.payloadOneof?.cellInput !== undefined &&
      object.payloadOneof?.cellInput !== null
    ) {
      message.payloadOneof = {
        $case: "cellInput",
        cellInput: CellInput.fromPartial(object.payloadOneof.cellInput),
      };
    }
    if (
      object.payloadOneof?.$case === "rowShift" &&
      object.payloadOneof?.rowShift !== undefined &&
      object.payloadOneof?.rowShift !== null
    ) {
      message.payloadOneof = {
        $case: "rowShift",
        rowShift: RowShift.fromPartial(object.payloadOneof.rowShift),
      };
    }
    if (
      object.payloadOneof?.$case === "columnShift" &&
      object.payloadOneof?.columnShift !== undefined &&
      object.payloadOneof?.columnShift !== null
    ) {
      message.payloadOneof = {
        $case: "columnShift",
        columnShift: ColumnShift.fromPartial(object.payloadOneof.columnShift),
      };
    }
    if (
      object.payloadOneof?.$case === "sheetRename" &&
      object.payloadOneof?.sheetRename !== undefined &&
      object.payloadOneof?.sheetRename !== null
    ) {
      message.payloadOneof = {
        $case: "sheetRename",
        sheetRename: SheetRename.fromPartial(object.payloadOneof.sheetRename),
      };
    }
    if (
      object.payloadOneof?.$case === "sheetShift" &&
      object.payloadOneof?.sheetShift !== undefined &&
      object.payloadOneof?.sheetShift !== null
    ) {
      message.payloadOneof = {
        $case: "sheetShift",
        sheetShift: SheetShift.fromPartial(object.payloadOneof.sheetShift),
      };
    }
    if (
      object.payloadOneof?.$case === "styleUpdate" &&
      object.payloadOneof?.styleUpdate !== undefined &&
      object.payloadOneof?.styleUpdate !== null
    ) {
      message.payloadOneof = {
        $case: "styleUpdate",
        styleUpdate: StyleUpdate.fromPartial(object.payloadOneof.styleUpdate),
      };
    }
    if (
      object.payloadOneof?.$case === "createBlock" &&
      object.payloadOneof?.createBlock !== undefined &&
      object.payloadOneof?.createBlock !== null
    ) {
      message.payloadOneof = {
        $case: "createBlock",
        createBlock: CreateBlock.fromPartial(object.payloadOneof.createBlock),
      };
    }
    if (
      object.payloadOneof?.$case === "moveBlock" &&
      object.payloadOneof?.moveBlock !== undefined &&
      object.payloadOneof?.moveBlock !== null
    ) {
      message.payloadOneof = {
        $case: "moveBlock",
        moveBlock: MoveBlock.fromPartial(object.payloadOneof.moveBlock),
      };
    }
    if (
      object.payloadOneof?.$case === "blockInput" &&
      object.payloadOneof?.blockInput !== undefined &&
      object.payloadOneof?.blockInput !== null
    ) {
      message.payloadOneof = {
        $case: "blockInput",
        blockInput: BlockInput.fromPartial(object.payloadOneof.blockInput),
      };
    }
    if (
      object.payloadOneof?.$case === "blockStyleUpdate" &&
      object.payloadOneof?.blockStyleUpdate !== undefined &&
      object.payloadOneof?.blockStyleUpdate !== null
    ) {
      message.payloadOneof = {
        $case: "blockStyleUpdate",
        blockStyleUpdate: BlockStyleUpdate.fromPartial(
          object.payloadOneof.blockStyleUpdate
        ),
      };
    }
    if (
      object.payloadOneof?.$case === "lineShiftInBlock" &&
      object.payloadOneof?.lineShiftInBlock !== undefined &&
      object.payloadOneof?.lineShiftInBlock !== null
    ) {
      message.payloadOneof = {
        $case: "lineShiftInBlock",
        lineShiftInBlock: LineShiftInBlock.fromPartial(
          object.payloadOneof.lineShiftInBlock
        ),
      };
    }
    if (
      object.payloadOneof?.$case === "setRowHeight" &&
      object.payloadOneof?.setRowHeight !== undefined &&
      object.payloadOneof?.setRowHeight !== null
    ) {
      message.payloadOneof = {
        $case: "setRowHeight",
        setRowHeight: SetRowHeight.fromPartial(
          object.payloadOneof.setRowHeight
        ),
      };
    }
    if (
      object.payloadOneof?.$case === "setColWidth" &&
      object.payloadOneof?.setColWidth !== undefined &&
      object.payloadOneof?.setColWidth !== null
    ) {
      message.payloadOneof = {
        $case: "setColWidth",
        setColWidth: SetColWidth.fromPartial(object.payloadOneof.setColWidth),
      };
    }
    if (
      object.payloadOneof?.$case === "setRowVisible" &&
      object.payloadOneof?.setRowVisible !== undefined &&
      object.payloadOneof?.setRowVisible !== null
    ) {
      message.payloadOneof = {
        $case: "setRowVisible",
        setRowVisible: SetRowVisible.fromPartial(
          object.payloadOneof.setRowVisible
        ),
      };
    }
    if (
      object.payloadOneof?.$case === "setColVisible" &&
      object.payloadOneof?.setColVisible !== undefined &&
      object.payloadOneof?.setColVisible !== null
    ) {
      message.payloadOneof = {
        $case: "setColVisible",
        setColVisible: SetColVisible.fromPartial(
          object.payloadOneof.setColVisible
        ),
      };
    }
    return message;
  },
};

function createBaseSetRowHeight(): SetRowHeight {
  return { sheetIdx: 0, row: 0, height: 0 };
}

export const SetRowHeight = {
  encode(
    message: SetRowHeight,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.row !== 0) {
      writer.uint32(16).uint32(message.row);
    }
    if (message.height !== 0) {
      writer.uint32(25).double(message.height);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetRowHeight {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetRowHeight();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.row = reader.uint32();
          break;
        case 3:
          message.height = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetRowHeight {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      row: isSet(object.row) ? Number(object.row) : 0,
      height: isSet(object.height) ? Number(object.height) : 0,
    };
  },

  toJSON(message: SetRowHeight): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.height !== undefined && (obj.height = message.height);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetRowHeight>, I>>(
    object: I
  ): SetRowHeight {
    const message = createBaseSetRowHeight();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.row = object.row ?? 0;
    message.height = object.height ?? 0;
    return message;
  },
};

function createBaseSetColWidth(): SetColWidth {
  return { sheetIdx: 0, col: 0, width: 0 };
}

export const SetColWidth = {
  encode(
    message: SetColWidth,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.col !== 0) {
      writer.uint32(16).uint32(message.col);
    }
    if (message.width !== 0) {
      writer.uint32(25).double(message.width);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetColWidth {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetColWidth();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.col = reader.uint32();
          break;
        case 3:
          message.width = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetColWidth {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      width: isSet(object.width) ? Number(object.width) : 0,
    };
  },

  toJSON(message: SetColWidth): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.col !== undefined && (obj.col = Math.round(message.col));
    message.width !== undefined && (obj.width = message.width);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetColWidth>, I>>(
    object: I
  ): SetColWidth {
    const message = createBaseSetColWidth();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.col = object.col ?? 0;
    message.width = object.width ?? 0;
    return message;
  },
};

function createBaseSetRowVisible(): SetRowVisible {
  return { sheetIdx: 0, row: 0, visible: false };
}

export const SetRowVisible = {
  encode(
    message: SetRowVisible,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.row !== 0) {
      writer.uint32(16).uint32(message.row);
    }
    if (message.visible === true) {
      writer.uint32(24).bool(message.visible);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetRowVisible {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetRowVisible();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.row = reader.uint32();
          break;
        case 3:
          message.visible = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetRowVisible {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      row: isSet(object.row) ? Number(object.row) : 0,
      visible: isSet(object.visible) ? Boolean(object.visible) : false,
    };
  },

  toJSON(message: SetRowVisible): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.visible !== undefined && (obj.visible = message.visible);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetRowVisible>, I>>(
    object: I
  ): SetRowVisible {
    const message = createBaseSetRowVisible();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.row = object.row ?? 0;
    message.visible = object.visible ?? false;
    return message;
  },
};

function createBaseSetColVisible(): SetColVisible {
  return { sheetIdx: 0, col: 0, visible: false };
}

export const SetColVisible = {
  encode(
    message: SetColVisible,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.col !== 0) {
      writer.uint32(16).uint32(message.col);
    }
    if (message.visible === true) {
      writer.uint32(24).bool(message.visible);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetColVisible {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetColVisible();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.col = reader.uint32();
          break;
        case 3:
          message.visible = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetColVisible {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      visible: isSet(object.visible) ? Boolean(object.visible) : false,
    };
  },

  toJSON(message: SetColVisible): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.col !== undefined && (obj.col = Math.round(message.col));
    message.visible !== undefined && (obj.visible = message.visible);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetColVisible>, I>>(
    object: I
  ): SetColVisible {
    const message = createBaseSetColVisible();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.col = object.col ?? 0;
    message.visible = object.visible ?? false;
    return message;
  },
};

function createBaseCreateBlock(): CreateBlock {
  return {
    sheetIdx: 0,
    id: 0,
    masterRow: 0,
    masterCol: 0,
    rowCnt: 0,
    colCnt: 0,
  };
}

export const CreateBlock = {
  encode(
    message: CreateBlock,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint32(message.id);
    }
    if (message.masterRow !== 0) {
      writer.uint32(24).uint32(message.masterRow);
    }
    if (message.masterCol !== 0) {
      writer.uint32(32).uint32(message.masterCol);
    }
    if (message.rowCnt !== 0) {
      writer.uint32(40).uint32(message.rowCnt);
    }
    if (message.colCnt !== 0) {
      writer.uint32(48).uint32(message.colCnt);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateBlock {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateBlock();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.id = reader.uint32();
          break;
        case 3:
          message.masterRow = reader.uint32();
          break;
        case 4:
          message.masterCol = reader.uint32();
          break;
        case 5:
          message.rowCnt = reader.uint32();
          break;
        case 6:
          message.colCnt = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CreateBlock {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      id: isSet(object.id) ? Number(object.id) : 0,
      masterRow: isSet(object.masterRow) ? Number(object.masterRow) : 0,
      masterCol: isSet(object.masterCol) ? Number(object.masterCol) : 0,
      rowCnt: isSet(object.rowCnt) ? Number(object.rowCnt) : 0,
      colCnt: isSet(object.colCnt) ? Number(object.colCnt) : 0,
    };
  },

  toJSON(message: CreateBlock): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.id !== undefined && (obj.id = Math.round(message.id));
    message.masterRow !== undefined &&
      (obj.masterRow = Math.round(message.masterRow));
    message.masterCol !== undefined &&
      (obj.masterCol = Math.round(message.masterCol));
    message.rowCnt !== undefined && (obj.rowCnt = Math.round(message.rowCnt));
    message.colCnt !== undefined && (obj.colCnt = Math.round(message.colCnt));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<CreateBlock>, I>>(
    object: I
  ): CreateBlock {
    const message = createBaseCreateBlock();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.id = object.id ?? 0;
    message.masterRow = object.masterRow ?? 0;
    message.masterCol = object.masterCol ?? 0;
    message.rowCnt = object.rowCnt ?? 0;
    message.colCnt = object.colCnt ?? 0;
    return message;
  },
};

function createBaseMoveBlock(): MoveBlock {
  return { sheetIdx: 0, id: 0, newMasterRow: 0, newMasterCol: 0 };
}

export const MoveBlock = {
  encode(
    message: MoveBlock,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint32(message.id);
    }
    if (message.newMasterRow !== 0) {
      writer.uint32(24).uint32(message.newMasterRow);
    }
    if (message.newMasterCol !== 0) {
      writer.uint32(32).uint32(message.newMasterCol);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MoveBlock {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMoveBlock();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.id = reader.uint32();
          break;
        case 3:
          message.newMasterRow = reader.uint32();
          break;
        case 4:
          message.newMasterCol = reader.uint32();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): MoveBlock {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      id: isSet(object.id) ? Number(object.id) : 0,
      newMasterRow: isSet(object.newMasterRow)
        ? Number(object.newMasterRow)
        : 0,
      newMasterCol: isSet(object.newMasterCol)
        ? Number(object.newMasterCol)
        : 0,
    };
  },

  toJSON(message: MoveBlock): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.id !== undefined && (obj.id = Math.round(message.id));
    message.newMasterRow !== undefined &&
      (obj.newMasterRow = Math.round(message.newMasterRow));
    message.newMasterCol !== undefined &&
      (obj.newMasterCol = Math.round(message.newMasterCol));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<MoveBlock>, I>>(
    object: I
  ): MoveBlock {
    const message = createBaseMoveBlock();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.id = object.id ?? 0;
    message.newMasterRow = object.newMasterRow ?? 0;
    message.newMasterCol = object.newMasterCol ?? 0;
    return message;
  },
};

function createBaseBlockInput(): BlockInput {
  return { sheetIdx: 0, id: 0, row: 0, col: 0, input: "" };
}

export const BlockInput = {
  encode(
    message: BlockInput,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint32(message.id);
    }
    if (message.row !== 0) {
      writer.uint32(24).uint32(message.row);
    }
    if (message.col !== 0) {
      writer.uint32(32).uint32(message.col);
    }
    if (message.input !== "") {
      writer.uint32(42).string(message.input);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BlockInput {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBlockInput();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.id = reader.uint32();
          break;
        case 3:
          message.row = reader.uint32();
          break;
        case 4:
          message.col = reader.uint32();
          break;
        case 5:
          message.input = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BlockInput {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      id: isSet(object.id) ? Number(object.id) : 0,
      row: isSet(object.row) ? Number(object.row) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      input: isSet(object.input) ? String(object.input) : "",
    };
  },

  toJSON(message: BlockInput): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.id !== undefined && (obj.id = Math.round(message.id));
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.col !== undefined && (obj.col = Math.round(message.col));
    message.input !== undefined && (obj.input = message.input);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<BlockInput>, I>>(
    object: I
  ): BlockInput {
    const message = createBaseBlockInput();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.id = object.id ?? 0;
    message.row = object.row ?? 0;
    message.col = object.col ?? 0;
    message.input = object.input ?? "";
    return message;
  },
};

function createBaseBlockStyleUpdate(): BlockStyleUpdate {
  return { sheetIdx: 0, id: 0, row: 0, col: 0, payloads: [] };
}

export const BlockStyleUpdate = {
  encode(
    message: BlockStyleUpdate,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint32(message.id);
    }
    if (message.row !== 0) {
      writer.uint32(24).uint32(message.row);
    }
    if (message.col !== 0) {
      writer.uint32(32).uint32(message.col);
    }
    for (const v of message.payloads) {
      StyleUpdatePayload.encode(v!, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BlockStyleUpdate {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBlockStyleUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.id = reader.uint32();
          break;
        case 3:
          message.row = reader.uint32();
          break;
        case 4:
          message.col = reader.uint32();
          break;
        case 5:
          message.payloads.push(
            StyleUpdatePayload.decode(reader, reader.uint32())
          );
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BlockStyleUpdate {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      id: isSet(object.id) ? Number(object.id) : 0,
      row: isSet(object.row) ? Number(object.row) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      payloads: Array.isArray(object?.payloads)
        ? object.payloads.map((e: any) => StyleUpdatePayload.fromJSON(e))
        : [],
    };
  },

  toJSON(message: BlockStyleUpdate): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.id !== undefined && (obj.id = Math.round(message.id));
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.col !== undefined && (obj.col = Math.round(message.col));
    if (message.payloads) {
      obj.payloads = message.payloads.map((e) =>
        e ? StyleUpdatePayload.toJSON(e) : undefined
      );
    } else {
      obj.payloads = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<BlockStyleUpdate>, I>>(
    object: I
  ): BlockStyleUpdate {
    const message = createBaseBlockStyleUpdate();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.id = object.id ?? 0;
    message.row = object.row ?? 0;
    message.col = object.col ?? 0;
    message.payloads =
      object.payloads?.map((e) => StyleUpdatePayload.fromPartial(e)) || [];
    return message;
  },
};

function createBaseLineShiftInBlock(): LineShiftInBlock {
  return {
    sheetIdx: 0,
    id: 0,
    idx: 0,
    cnt: 0,
    horizontal: false,
    insert: false,
  };
}

export const LineShiftInBlock = {
  encode(
    message: LineShiftInBlock,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint32(message.id);
    }
    if (message.idx !== 0) {
      writer.uint32(24).uint32(message.idx);
    }
    if (message.cnt !== 0) {
      writer.uint32(32).uint32(message.cnt);
    }
    if (message.horizontal === true) {
      writer.uint32(40).bool(message.horizontal);
    }
    if (message.insert === true) {
      writer.uint32(48).bool(message.insert);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LineShiftInBlock {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLineShiftInBlock();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.id = reader.uint32();
          break;
        case 3:
          message.idx = reader.uint32();
          break;
        case 4:
          message.cnt = reader.uint32();
          break;
        case 5:
          message.horizontal = reader.bool();
          break;
        case 6:
          message.insert = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): LineShiftInBlock {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      id: isSet(object.id) ? Number(object.id) : 0,
      idx: isSet(object.idx) ? Number(object.idx) : 0,
      cnt: isSet(object.cnt) ? Number(object.cnt) : 0,
      horizontal: isSet(object.horizontal) ? Boolean(object.horizontal) : false,
      insert: isSet(object.insert) ? Boolean(object.insert) : false,
    };
  },

  toJSON(message: LineShiftInBlock): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.id !== undefined && (obj.id = Math.round(message.id));
    message.idx !== undefined && (obj.idx = Math.round(message.idx));
    message.cnt !== undefined && (obj.cnt = Math.round(message.cnt));
    message.horizontal !== undefined && (obj.horizontal = message.horizontal);
    message.insert !== undefined && (obj.insert = message.insert);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<LineShiftInBlock>, I>>(
    object: I
  ): LineShiftInBlock {
    const message = createBaseLineShiftInBlock();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.id = object.id ?? 0;
    message.idx = object.idx ?? 0;
    message.cnt = object.cnt ?? 0;
    message.horizontal = object.horizontal ?? false;
    message.insert = object.insert ?? false;
    return message;
  },
};

function createBaseSheetRename(): SheetRename {
  return { oldName: "", newName: "" };
}

export const SheetRename = {
  encode(
    message: SheetRename,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.oldName !== "") {
      writer.uint32(10).string(message.oldName);
    }
    if (message.newName !== "") {
      writer.uint32(18).string(message.newName);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetRename {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetRename();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.oldName = reader.string();
          break;
        case 2:
          message.newName = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetRename {
    return {
      oldName: isSet(object.oldName) ? String(object.oldName) : "",
      newName: isSet(object.newName) ? String(object.newName) : "",
    };
  },

  toJSON(message: SheetRename): unknown {
    const obj: any = {};
    message.oldName !== undefined && (obj.oldName = message.oldName);
    message.newName !== undefined && (obj.newName = message.newName);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetRename>, I>>(
    object: I
  ): SheetRename {
    const message = createBaseSheetRename();
    message.oldName = object.oldName ?? "";
    message.newName = object.newName ?? "";
    return message;
  },
};

function createBaseCellInput(): CellInput {
  return { sheetIdx: 0, row: 0, col: 0, input: "" };
}

export const CellInput = {
  encode(
    message: CellInput,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.row !== 0) {
      writer.uint32(16).uint32(message.row);
    }
    if (message.col !== 0) {
      writer.uint32(24).uint32(message.col);
    }
    if (message.input !== "") {
      writer.uint32(34).string(message.input);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CellInput {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCellInput();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.row = reader.uint32();
          break;
        case 3:
          message.col = reader.uint32();
          break;
        case 4:
          message.input = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): CellInput {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      row: isSet(object.row) ? Number(object.row) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      input: isSet(object.input) ? String(object.input) : "",
    };
  },

  toJSON(message: CellInput): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.col !== undefined && (obj.col = Math.round(message.col));
    message.input !== undefined && (obj.input = message.input);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<CellInput>, I>>(
    object: I
  ): CellInput {
    const message = createBaseCellInput();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.row = object.row ?? 0;
    message.col = object.col ?? 0;
    message.input = object.input ?? "";
    return message;
  },
};

function createBaseRowShift(): RowShift {
  return { sheetIdx: 0, start: 0, count: 0, type: 0 };
}

export const RowShift = {
  encode(
    message: RowShift,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.start !== 0) {
      writer.uint32(16).uint32(message.start);
    }
    if (message.count !== 0) {
      writer.uint32(24).uint32(message.count);
    }
    if (message.type !== 0) {
      writer.uint32(32).int32(message.type);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RowShift {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRowShift();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.start = reader.uint32();
          break;
        case 3:
          message.count = reader.uint32();
          break;
        case 4:
          message.type = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): RowShift {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      start: isSet(object.start) ? Number(object.start) : 0,
      count: isSet(object.count) ? Number(object.count) : 0,
      type: isSet(object.type) ? shiftTypeFromJSON(object.type) : 0,
    };
  },

  toJSON(message: RowShift): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.start !== undefined && (obj.start = Math.round(message.start));
    message.count !== undefined && (obj.count = Math.round(message.count));
    message.type !== undefined && (obj.type = shiftTypeToJSON(message.type));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<RowShift>, I>>(object: I): RowShift {
    const message = createBaseRowShift();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.start = object.start ?? 0;
    message.count = object.count ?? 0;
    message.type = object.type ?? 0;
    return message;
  },
};

function createBaseColumnShift(): ColumnShift {
  return { sheetIdx: 0, start: 0, count: 0, type: 0 };
}

export const ColumnShift = {
  encode(
    message: ColumnShift,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.start !== 0) {
      writer.uint32(16).uint32(message.start);
    }
    if (message.count !== 0) {
      writer.uint32(24).uint32(message.count);
    }
    if (message.type !== 0) {
      writer.uint32(32).int32(message.type);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ColumnShift {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseColumnShift();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.start = reader.uint32();
          break;
        case 3:
          message.count = reader.uint32();
          break;
        case 4:
          message.type = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ColumnShift {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      start: isSet(object.start) ? Number(object.start) : 0,
      count: isSet(object.count) ? Number(object.count) : 0,
      type: isSet(object.type) ? shiftTypeFromJSON(object.type) : 0,
    };
  },

  toJSON(message: ColumnShift): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.start !== undefined && (obj.start = Math.round(message.start));
    message.count !== undefined && (obj.count = Math.round(message.count));
    message.type !== undefined && (obj.type = shiftTypeToJSON(message.type));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ColumnShift>, I>>(
    object: I
  ): ColumnShift {
    const message = createBaseColumnShift();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.start = object.start ?? 0;
    message.count = object.count ?? 0;
    message.type = object.type ?? 0;
    return message;
  },
};

function createBaseSheetShift(): SheetShift {
  return { sheetIdx: 0, type: 0 };
}

export const SheetShift = {
  encode(
    message: SheetShift,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.type !== 0) {
      writer.uint32(16).int32(message.type);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SheetShift {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSheetShift();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.type = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SheetShift {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      type: isSet(object.type) ? shiftTypeFromJSON(object.type) : 0,
    };
  },

  toJSON(message: SheetShift): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.type !== undefined && (obj.type = shiftTypeToJSON(message.type));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SheetShift>, I>>(
    object: I
  ): SheetShift {
    const message = createBaseSheetShift();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.type = object.type ?? 0;
    return message;
  },
};

function createBaseStyle(): Style {
  return {
    border: undefined,
    font: undefined,
    fill: undefined,
    alignment: undefined,
    formatter: "",
  };
}

export const Style = {
  encode(message: Style, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.border !== undefined) {
      Border.encode(message.border, writer.uint32(10).fork()).ldelim();
    }
    if (message.font !== undefined) {
      Font.encode(message.font, writer.uint32(18).fork()).ldelim();
    }
    if (message.fill !== undefined) {
      PatternFill.encode(message.fill, writer.uint32(26).fork()).ldelim();
    }
    if (message.alignment !== undefined) {
      Alignment.encode(message.alignment, writer.uint32(34).fork()).ldelim();
    }
    if (message.formatter !== "") {
      writer.uint32(42).string(message.formatter);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Style {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStyle();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.border = Border.decode(reader, reader.uint32());
          break;
        case 2:
          message.font = Font.decode(reader, reader.uint32());
          break;
        case 3:
          message.fill = PatternFill.decode(reader, reader.uint32());
          break;
        case 4:
          message.alignment = Alignment.decode(reader, reader.uint32());
          break;
        case 5:
          message.formatter = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Style {
    return {
      border: isSet(object.border) ? Border.fromJSON(object.border) : undefined,
      font: isSet(object.font) ? Font.fromJSON(object.font) : undefined,
      fill: isSet(object.fill) ? PatternFill.fromJSON(object.fill) : undefined,
      alignment: isSet(object.alignment)
        ? Alignment.fromJSON(object.alignment)
        : undefined,
      formatter: isSet(object.formatter) ? String(object.formatter) : "",
    };
  },

  toJSON(message: Style): unknown {
    const obj: any = {};
    message.border !== undefined &&
      (obj.border = message.border ? Border.toJSON(message.border) : undefined);
    message.font !== undefined &&
      (obj.font = message.font ? Font.toJSON(message.font) : undefined);
    message.fill !== undefined &&
      (obj.fill = message.fill ? PatternFill.toJSON(message.fill) : undefined);
    message.alignment !== undefined &&
      (obj.alignment = message.alignment
        ? Alignment.toJSON(message.alignment)
        : undefined);
    message.formatter !== undefined && (obj.formatter = message.formatter);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Style>, I>>(object: I): Style {
    const message = createBaseStyle();
    message.border =
      object.border !== undefined && object.border !== null
        ? Border.fromPartial(object.border)
        : undefined;
    message.font =
      object.font !== undefined && object.font !== null
        ? Font.fromPartial(object.font)
        : undefined;
    message.fill =
      object.fill !== undefined && object.fill !== null
        ? PatternFill.fromPartial(object.fill)
        : undefined;
    message.alignment =
      object.alignment !== undefined && object.alignment !== null
        ? Alignment.fromPartial(object.alignment)
        : undefined;
    message.formatter = object.formatter ?? "";
    return message;
  },
};

function createBaseAlignment(): Alignment {
  return {
    horizontal: 0,
    indent: 0,
    justifyLastLine: false,
    readingOrder: 0,
    relativeIndent: 0,
    shrinkToFit: false,
    textRotation: 0,
    vertical: 0,
    wrapText: false,
  };
}

export const Alignment = {
  encode(
    message: Alignment,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.horizontal !== 0) {
      writer.uint32(8).int32(message.horizontal);
    }
    if (message.indent !== 0) {
      writer.uint32(16).int32(message.indent);
    }
    if (message.justifyLastLine === true) {
      writer.uint32(24).bool(message.justifyLastLine);
    }
    if (message.readingOrder !== 0) {
      writer.uint32(32).int32(message.readingOrder);
    }
    if (message.relativeIndent !== 0) {
      writer.uint32(40).int32(message.relativeIndent);
    }
    if (message.shrinkToFit === true) {
      writer.uint32(48).bool(message.shrinkToFit);
    }
    if (message.textRotation !== 0) {
      writer.uint32(56).int32(message.textRotation);
    }
    if (message.vertical !== 0) {
      writer.uint32(64).int32(message.vertical);
    }
    if (message.wrapText === true) {
      writer.uint32(72).bool(message.wrapText);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Alignment {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAlignment();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.horizontal = reader.int32() as any;
          break;
        case 2:
          message.indent = reader.int32();
          break;
        case 3:
          message.justifyLastLine = reader.bool();
          break;
        case 4:
          message.readingOrder = reader.int32() as any;
          break;
        case 5:
          message.relativeIndent = reader.int32();
          break;
        case 6:
          message.shrinkToFit = reader.bool();
          break;
        case 7:
          message.textRotation = reader.int32();
          break;
        case 8:
          message.vertical = reader.int32() as any;
          break;
        case 9:
          message.wrapText = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Alignment {
    return {
      horizontal: isSet(object.horizontal)
        ? alignment_HorizontalFromJSON(object.horizontal)
        : 0,
      indent: isSet(object.indent) ? Number(object.indent) : 0,
      justifyLastLine: isSet(object.justifyLastLine)
        ? Boolean(object.justifyLastLine)
        : false,
      readingOrder: isSet(object.readingOrder)
        ? readingOrderFromJSON(object.readingOrder)
        : 0,
      relativeIndent: isSet(object.relativeIndent)
        ? Number(object.relativeIndent)
        : 0,
      shrinkToFit: isSet(object.shrinkToFit)
        ? Boolean(object.shrinkToFit)
        : false,
      textRotation: isSet(object.textRotation)
        ? Number(object.textRotation)
        : 0,
      vertical: isSet(object.vertical)
        ? alignment_VerticalFromJSON(object.vertical)
        : 0,
      wrapText: isSet(object.wrapText) ? Boolean(object.wrapText) : false,
    };
  },

  toJSON(message: Alignment): unknown {
    const obj: any = {};
    message.horizontal !== undefined &&
      (obj.horizontal = alignment_HorizontalToJSON(message.horizontal));
    message.indent !== undefined && (obj.indent = Math.round(message.indent));
    message.justifyLastLine !== undefined &&
      (obj.justifyLastLine = message.justifyLastLine);
    message.readingOrder !== undefined &&
      (obj.readingOrder = readingOrderToJSON(message.readingOrder));
    message.relativeIndent !== undefined &&
      (obj.relativeIndent = Math.round(message.relativeIndent));
    message.shrinkToFit !== undefined &&
      (obj.shrinkToFit = message.shrinkToFit);
    message.textRotation !== undefined &&
      (obj.textRotation = Math.round(message.textRotation));
    message.vertical !== undefined &&
      (obj.vertical = alignment_VerticalToJSON(message.vertical));
    message.wrapText !== undefined && (obj.wrapText = message.wrapText);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Alignment>, I>>(
    object: I
  ): Alignment {
    const message = createBaseAlignment();
    message.horizontal = object.horizontal ?? 0;
    message.indent = object.indent ?? 0;
    message.justifyLastLine = object.justifyLastLine ?? false;
    message.readingOrder = object.readingOrder ?? 0;
    message.relativeIndent = object.relativeIndent ?? 0;
    message.shrinkToFit = object.shrinkToFit ?? false;
    message.textRotation = object.textRotation ?? 0;
    message.vertical = object.vertical ?? 0;
    message.wrapText = object.wrapText ?? false;
    return message;
  },
};

function createBaseBorder(): Border {
  return {
    left: undefined,
    right: undefined,
    top: undefined,
    bottom: undefined,
    diagonal: undefined,
    vertical: undefined,
    horizontal: undefined,
    diagonalUp: false,
    diagonalDown: false,
    outline: false,
  };
}

export const Border = {
  encode(
    message: Border,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.left !== undefined) {
      BorderPr.encode(message.left, writer.uint32(10).fork()).ldelim();
    }
    if (message.right !== undefined) {
      BorderPr.encode(message.right, writer.uint32(18).fork()).ldelim();
    }
    if (message.top !== undefined) {
      BorderPr.encode(message.top, writer.uint32(26).fork()).ldelim();
    }
    if (message.bottom !== undefined) {
      BorderPr.encode(message.bottom, writer.uint32(34).fork()).ldelim();
    }
    if (message.diagonal !== undefined) {
      BorderPr.encode(message.diagonal, writer.uint32(42).fork()).ldelim();
    }
    if (message.vertical !== undefined) {
      BorderPr.encode(message.vertical, writer.uint32(50).fork()).ldelim();
    }
    if (message.horizontal !== undefined) {
      BorderPr.encode(message.horizontal, writer.uint32(58).fork()).ldelim();
    }
    if (message.diagonalUp === true) {
      writer.uint32(64).bool(message.diagonalUp);
    }
    if (message.diagonalDown === true) {
      writer.uint32(72).bool(message.diagonalDown);
    }
    if (message.outline === true) {
      writer.uint32(80).bool(message.outline);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Border {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBorder();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.left = BorderPr.decode(reader, reader.uint32());
          break;
        case 2:
          message.right = BorderPr.decode(reader, reader.uint32());
          break;
        case 3:
          message.top = BorderPr.decode(reader, reader.uint32());
          break;
        case 4:
          message.bottom = BorderPr.decode(reader, reader.uint32());
          break;
        case 5:
          message.diagonal = BorderPr.decode(reader, reader.uint32());
          break;
        case 6:
          message.vertical = BorderPr.decode(reader, reader.uint32());
          break;
        case 7:
          message.horizontal = BorderPr.decode(reader, reader.uint32());
          break;
        case 8:
          message.diagonalUp = reader.bool();
          break;
        case 9:
          message.diagonalDown = reader.bool();
          break;
        case 10:
          message.outline = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Border {
    return {
      left: isSet(object.left) ? BorderPr.fromJSON(object.left) : undefined,
      right: isSet(object.right) ? BorderPr.fromJSON(object.right) : undefined,
      top: isSet(object.top) ? BorderPr.fromJSON(object.top) : undefined,
      bottom: isSet(object.bottom)
        ? BorderPr.fromJSON(object.bottom)
        : undefined,
      diagonal: isSet(object.diagonal)
        ? BorderPr.fromJSON(object.diagonal)
        : undefined,
      vertical: isSet(object.vertical)
        ? BorderPr.fromJSON(object.vertical)
        : undefined,
      horizontal: isSet(object.horizontal)
        ? BorderPr.fromJSON(object.horizontal)
        : undefined,
      diagonalUp: isSet(object.diagonalUp) ? Boolean(object.diagonalUp) : false,
      diagonalDown: isSet(object.diagonalDown)
        ? Boolean(object.diagonalDown)
        : false,
      outline: isSet(object.outline) ? Boolean(object.outline) : false,
    };
  },

  toJSON(message: Border): unknown {
    const obj: any = {};
    message.left !== undefined &&
      (obj.left = message.left ? BorderPr.toJSON(message.left) : undefined);
    message.right !== undefined &&
      (obj.right = message.right ? BorderPr.toJSON(message.right) : undefined);
    message.top !== undefined &&
      (obj.top = message.top ? BorderPr.toJSON(message.top) : undefined);
    message.bottom !== undefined &&
      (obj.bottom = message.bottom
        ? BorderPr.toJSON(message.bottom)
        : undefined);
    message.diagonal !== undefined &&
      (obj.diagonal = message.diagonal
        ? BorderPr.toJSON(message.diagonal)
        : undefined);
    message.vertical !== undefined &&
      (obj.vertical = message.vertical
        ? BorderPr.toJSON(message.vertical)
        : undefined);
    message.horizontal !== undefined &&
      (obj.horizontal = message.horizontal
        ? BorderPr.toJSON(message.horizontal)
        : undefined);
    message.diagonalUp !== undefined && (obj.diagonalUp = message.diagonalUp);
    message.diagonalDown !== undefined &&
      (obj.diagonalDown = message.diagonalDown);
    message.outline !== undefined && (obj.outline = message.outline);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Border>, I>>(object: I): Border {
    const message = createBaseBorder();
    message.left =
      object.left !== undefined && object.left !== null
        ? BorderPr.fromPartial(object.left)
        : undefined;
    message.right =
      object.right !== undefined && object.right !== null
        ? BorderPr.fromPartial(object.right)
        : undefined;
    message.top =
      object.top !== undefined && object.top !== null
        ? BorderPr.fromPartial(object.top)
        : undefined;
    message.bottom =
      object.bottom !== undefined && object.bottom !== null
        ? BorderPr.fromPartial(object.bottom)
        : undefined;
    message.diagonal =
      object.diagonal !== undefined && object.diagonal !== null
        ? BorderPr.fromPartial(object.diagonal)
        : undefined;
    message.vertical =
      object.vertical !== undefined && object.vertical !== null
        ? BorderPr.fromPartial(object.vertical)
        : undefined;
    message.horizontal =
      object.horizontal !== undefined && object.horizontal !== null
        ? BorderPr.fromPartial(object.horizontal)
        : undefined;
    message.diagonalUp = object.diagonalUp ?? false;
    message.diagonalDown = object.diagonalDown ?? false;
    message.outline = object.outline ?? false;
    return message;
  },
};

function createBaseBorderPr(): BorderPr {
  return { color: "", type: 0 };
}

export const BorderPr = {
  encode(
    message: BorderPr,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.color !== "") {
      writer.uint32(10).string(message.color);
    }
    if (message.type !== 0) {
      writer.uint32(16).int32(message.type);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BorderPr {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBorderPr();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.color = reader.string();
          break;
        case 2:
          message.type = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): BorderPr {
    return {
      color: isSet(object.color) ? String(object.color) : "",
      type: isSet(object.type) ? borderTypeFromJSON(object.type) : 0,
    };
  },

  toJSON(message: BorderPr): unknown {
    const obj: any = {};
    message.color !== undefined && (obj.color = message.color);
    message.type !== undefined && (obj.type = borderTypeToJSON(message.type));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<BorderPr>, I>>(object: I): BorderPr {
    const message = createBaseBorderPr();
    message.color = object.color ?? "";
    message.type = object.type ?? 0;
    return message;
  },
};

function createBaseFont(): Font {
  return {
    bold: false,
    italic: false,
    underline: 0,
    color: "",
    size: 0,
    name: "",
    outline: false,
    shadow: false,
    strike: false,
    condense: false,
  };
}

export const Font = {
  encode(message: Font, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.bold === true) {
      writer.uint32(8).bool(message.bold);
    }
    if (message.italic === true) {
      writer.uint32(16).bool(message.italic);
    }
    if (message.underline !== 0) {
      writer.uint32(24).int32(message.underline);
    }
    if (message.color !== "") {
      writer.uint32(34).string(message.color);
    }
    if (message.size !== 0) {
      writer.uint32(41).double(message.size);
    }
    if (message.name !== "") {
      writer.uint32(50).string(message.name);
    }
    if (message.outline === true) {
      writer.uint32(56).bool(message.outline);
    }
    if (message.shadow === true) {
      writer.uint32(64).bool(message.shadow);
    }
    if (message.strike === true) {
      writer.uint32(72).bool(message.strike);
    }
    if (message.condense === true) {
      writer.uint32(80).bool(message.condense);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Font {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseFont();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bold = reader.bool();
          break;
        case 2:
          message.italic = reader.bool();
          break;
        case 3:
          message.underline = reader.int32() as any;
          break;
        case 4:
          message.color = reader.string();
          break;
        case 5:
          message.size = reader.double();
          break;
        case 6:
          message.name = reader.string();
          break;
        case 7:
          message.outline = reader.bool();
          break;
        case 8:
          message.shadow = reader.bool();
          break;
        case 9:
          message.strike = reader.bool();
          break;
        case 10:
          message.condense = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Font {
    return {
      bold: isSet(object.bold) ? Boolean(object.bold) : false,
      italic: isSet(object.italic) ? Boolean(object.italic) : false,
      underline: isSet(object.underline)
        ? underlineTypeFromJSON(object.underline.val)
        : 0,
      color: isSet(object.color) ?
        isSet(object.color.rgb) ? String(object.color.rgb): String(object.color)
        : "",
      size: isSet(object.size) ? Number(object.size) : 0,
      name: isSet(object.name) ? String(object.name) : "",
      outline: isSet(object.outline) ? Boolean(object.outline) : false,
      shadow: isSet(object.shadow) ? Boolean(object.shadow) : false,
      strike: isSet(object.strike) ? Boolean(object.strike) : false,
      condense: isSet(object.condense) ? Boolean(object.condense) : false,
    };
  },

  toJSON(message: Font): unknown {
    const obj: any = {};
    message.bold !== undefined && (obj.bold = message.bold);
    message.italic !== undefined && (obj.italic = message.italic);
    message.underline !== undefined &&
      (obj.underline = underlineTypeToJSON(message.underline));
    message.color !== undefined && (obj.color = message.color);
    message.size !== undefined && (obj.size = message.size);
    message.name !== undefined && (obj.name = message.name);
    message.outline !== undefined && (obj.outline = message.outline);
    message.shadow !== undefined && (obj.shadow = message.shadow);
    message.strike !== undefined && (obj.strike = message.strike);
    message.condense !== undefined && (obj.condense = message.condense);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Font>, I>>(object: I): Font {
    const message = createBaseFont();
    message.bold = object.bold ?? false;
    message.italic = object.italic ?? false;
    message.underline = object.underline ?? 0;
    message.color = object.color ?? "";
    message.size = object.size ?? 0;
    message.name = object.name ?? "";
    message.outline = object.outline ?? false;
    message.shadow = object.shadow ?? false;
    message.strike = object.strike ?? false;
    message.condense = object.condense ?? false;
    return message;
  },
};

function createBasePatternFill(): PatternFill {
  return { fgColor: "", bgColor: "", type: 0 };
}

export const PatternFill = {
  encode(
    message: PatternFill,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.fgColor !== "") {
      writer.uint32(10).string(message.fgColor);
    }
    if (message.bgColor !== "") {
      writer.uint32(18).string(message.bgColor);
    }
    if (message.type !== 0) {
      writer.uint32(24).int32(message.type);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PatternFill {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePatternFill();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fgColor = reader.string();
          break;
        case 2:
          message.bgColor = reader.string();
          break;
        case 3:
          message.type = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PatternFill {
    return {
      fgColor: isSet(object.PatternFill.fg_color) ? String(object.PatternFill.fg_color.rgb) : "",
      bgColor: isSet(object.PatternFill.bg_color) ? String(object.PatternFill.bg_color.rgb) : "",
      type: isSet(object.PatternFill.pattern_type) ? patternFillTypeFromJSON(object.PatternFill.pattern_type) : 0,
    };
  },

  toJSON(message: PatternFill): unknown {
    const obj: any = {};
    message.fgColor !== undefined && (obj.fgColor = message.fgColor);
    message.bgColor !== undefined && (obj.bgColor = message.bgColor);
    message.type !== undefined &&
      (obj.type = patternFillTypeToJSON(message.type));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PatternFill>, I>>(
    object: I
  ): PatternFill {
    const message = createBasePatternFill();
    message.fgColor = object.fgColor ?? "";
    message.bgColor = object.bgColor ?? "";
    message.type = object.type ?? 0;
    return message;
  },
};

function createBaseSetFontBold(): SetFontBold {
  return { bold: false };
}

export const SetFontBold = {
  encode(
    message: SetFontBold,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.bold === true) {
      writer.uint32(8).bool(message.bold);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontBold {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontBold();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bold = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontBold {
    return {
      bold: isSet(object.bold) ? Boolean(object.bold) : false,
    };
  },

  toJSON(message: SetFontBold): unknown {
    const obj: any = {};
    message.bold !== undefined && (obj.bold = message.bold);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontBold>, I>>(
    object: I
  ): SetFontBold {
    const message = createBaseSetFontBold();
    message.bold = object.bold ?? false;
    return message;
  },
};

function createBaseSetFontItalic(): SetFontItalic {
  return { italic: false };
}

export const SetFontItalic = {
  encode(
    message: SetFontItalic,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.italic === true) {
      writer.uint32(8).bool(message.italic);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontItalic {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontItalic();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.italic = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontItalic {
    return {
      italic: isSet(object.italic) ? Boolean(object.italic) : false,
    };
  },

  toJSON(message: SetFontItalic): unknown {
    const obj: any = {};
    message.italic !== undefined && (obj.italic = message.italic);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontItalic>, I>>(
    object: I
  ): SetFontItalic {
    const message = createBaseSetFontItalic();
    message.italic = object.italic ?? false;
    return message;
  },
};

function createBaseSetFontUnderline(): SetFontUnderline {
  return { underline: 0 };
}

export const SetFontUnderline = {
  encode(
    message: SetFontUnderline,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.underline !== 0) {
      writer.uint32(8).int32(message.underline);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontUnderline {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontUnderline();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.underline = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontUnderline {
    return {
      underline: isSet(object.underline)
        ? underlineTypeFromJSON(object.underline)
        : 0,
    };
  },

  toJSON(message: SetFontUnderline): unknown {
    const obj: any = {};
    message.underline !== undefined &&
      (obj.underline = underlineTypeToJSON(message.underline));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontUnderline>, I>>(
    object: I
  ): SetFontUnderline {
    const message = createBaseSetFontUnderline();
    message.underline = object.underline ?? 0;
    return message;
  },
};

function createBaseSetFontColor(): SetFontColor {
  return { color: "" };
}

export const SetFontColor = {
  encode(
    message: SetFontColor,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.color !== "") {
      writer.uint32(10).string(message.color);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontColor {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontColor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.color = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontColor {
    return {
      color: isSet(object.color) ? String(object.color) : "",
    };
  },

  toJSON(message: SetFontColor): unknown {
    const obj: any = {};
    message.color !== undefined && (obj.color = message.color);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontColor>, I>>(
    object: I
  ): SetFontColor {
    const message = createBaseSetFontColor();
    message.color = object.color ?? "";
    return message;
  },
};

function createBaseSetFontSize(): SetFontSize {
  return { size: 0 };
}

export const SetFontSize = {
  encode(
    message: SetFontSize,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.size !== 0) {
      writer.uint32(9).double(message.size);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontSize {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontSize();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.size = reader.double();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontSize {
    return {
      size: isSet(object.size) ? Number(object.size) : 0,
    };
  },

  toJSON(message: SetFontSize): unknown {
    const obj: any = {};
    message.size !== undefined && (obj.size = message.size);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontSize>, I>>(
    object: I
  ): SetFontSize {
    const message = createBaseSetFontSize();
    message.size = object.size ?? 0;
    return message;
  },
};

function createBaseSetFontName(): SetFontName {
  return { name: "" };
}

export const SetFontName = {
  encode(
    message: SetFontName,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontName {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontName();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontName {
    return {
      name: isSet(object.name) ? String(object.name) : "",
    };
  },

  toJSON(message: SetFontName): unknown {
    const obj: any = {};
    message.name !== undefined && (obj.name = message.name);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontName>, I>>(
    object: I
  ): SetFontName {
    const message = createBaseSetFontName();
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseSetFontOutline(): SetFontOutline {
  return { outline: false };
}

export const SetFontOutline = {
  encode(
    message: SetFontOutline,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.outline === true) {
      writer.uint32(8).bool(message.outline);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontOutline {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontOutline();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.outline = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontOutline {
    return {
      outline: isSet(object.outline) ? Boolean(object.outline) : false,
    };
  },

  toJSON(message: SetFontOutline): unknown {
    const obj: any = {};
    message.outline !== undefined && (obj.outline = message.outline);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontOutline>, I>>(
    object: I
  ): SetFontOutline {
    const message = createBaseSetFontOutline();
    message.outline = object.outline ?? false;
    return message;
  },
};

function createBaseSetFontShadow(): SetFontShadow {
  return { shadow: false };
}

export const SetFontShadow = {
  encode(
    message: SetFontShadow,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.shadow === true) {
      writer.uint32(8).bool(message.shadow);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontShadow {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontShadow();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.shadow = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontShadow {
    return {
      shadow: isSet(object.shadow) ? Boolean(object.shadow) : false,
    };
  },

  toJSON(message: SetFontShadow): unknown {
    const obj: any = {};
    message.shadow !== undefined && (obj.shadow = message.shadow);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontShadow>, I>>(
    object: I
  ): SetFontShadow {
    const message = createBaseSetFontShadow();
    message.shadow = object.shadow ?? false;
    return message;
  },
};

function createBaseSetFontStrike(): SetFontStrike {
  return { strike: false };
}

export const SetFontStrike = {
  encode(
    message: SetFontStrike,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.strike === true) {
      writer.uint32(8).bool(message.strike);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontStrike {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontStrike();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.strike = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontStrike {
    return {
      strike: isSet(object.strike) ? Boolean(object.strike) : false,
    };
  },

  toJSON(message: SetFontStrike): unknown {
    const obj: any = {};
    message.strike !== undefined && (obj.strike = message.strike);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontStrike>, I>>(
    object: I
  ): SetFontStrike {
    const message = createBaseSetFontStrike();
    message.strike = object.strike ?? false;
    return message;
  },
};

function createBaseSetFontCondense(): SetFontCondense {
  return { condense: false };
}

export const SetFontCondense = {
  encode(
    message: SetFontCondense,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.condense === true) {
      writer.uint32(8).bool(message.condense);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetFontCondense {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetFontCondense();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.condense = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetFontCondense {
    return {
      condense: isSet(object.condense) ? Boolean(object.condense) : false,
    };
  },

  toJSON(message: SetFontCondense): unknown {
    const obj: any = {};
    message.condense !== undefined && (obj.condense = message.condense);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetFontCondense>, I>>(
    object: I
  ): SetFontCondense {
    const message = createBaseSetFontCondense();
    message.condense = object.condense ?? false;
    return message;
  },
};

function createBaseSetBorderDiagonalUp(): SetBorderDiagonalUp {
  return { diagonalUp: false };
}

export const SetBorderDiagonalUp = {
  encode(
    message: SetBorderDiagonalUp,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.diagonalUp === true) {
      writer.uint32(8).bool(message.diagonalUp);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetBorderDiagonalUp {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetBorderDiagonalUp();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.diagonalUp = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetBorderDiagonalUp {
    return {
      diagonalUp: isSet(object.diagonalUp) ? Boolean(object.diagonalUp) : false,
    };
  },

  toJSON(message: SetBorderDiagonalUp): unknown {
    const obj: any = {};
    message.diagonalUp !== undefined && (obj.diagonalUp = message.diagonalUp);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetBorderDiagonalUp>, I>>(
    object: I
  ): SetBorderDiagonalUp {
    const message = createBaseSetBorderDiagonalUp();
    message.diagonalUp = object.diagonalUp ?? false;
    return message;
  },
};

function createBaseSetBorderDiagonalDown(): SetBorderDiagonalDown {
  return { diagonalDown: false };
}

export const SetBorderDiagonalDown = {
  encode(
    message: SetBorderDiagonalDown,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.diagonalDown === true) {
      writer.uint32(8).bool(message.diagonalDown);
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): SetBorderDiagonalDown {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetBorderDiagonalDown();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.diagonalDown = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetBorderDiagonalDown {
    return {
      diagonalDown: isSet(object.diagonalDown)
        ? Boolean(object.diagonalDown)
        : false,
    };
  },

  toJSON(message: SetBorderDiagonalDown): unknown {
    const obj: any = {};
    message.diagonalDown !== undefined &&
      (obj.diagonalDown = message.diagonalDown);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetBorderDiagonalDown>, I>>(
    object: I
  ): SetBorderDiagonalDown {
    const message = createBaseSetBorderDiagonalDown();
    message.diagonalDown = object.diagonalDown ?? false;
    return message;
  },
};

function createBaseSetBorderOutline(): SetBorderOutline {
  return { outline: false };
}

export const SetBorderOutline = {
  encode(
    message: SetBorderOutline,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.outline === true) {
      writer.uint32(8).bool(message.outline);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetBorderOutline {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetBorderOutline();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.outline = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetBorderOutline {
    return {
      outline: isSet(object.outline) ? Boolean(object.outline) : false,
    };
  },

  toJSON(message: SetBorderOutline): unknown {
    const obj: any = {};
    message.outline !== undefined && (obj.outline = message.outline);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetBorderOutline>, I>>(
    object: I
  ): SetBorderOutline {
    const message = createBaseSetBorderOutline();
    message.outline = object.outline ?? false;
    return message;
  },
};

function createBaseSetPatternFill(): SetPatternFill {
  return { patternFill: undefined };
}

export const SetPatternFill = {
  encode(
    message: SetPatternFill,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.patternFill !== undefined) {
      PatternFill.encode(
        message.patternFill,
        writer.uint32(10).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetPatternFill {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetPatternFill();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.patternFill = PatternFill.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetPatternFill {
    return {
      patternFill: isSet(object.patternFill)
        ? PatternFill.fromJSON(object.patternFill)
        : undefined,
    };
  },

  toJSON(message: SetPatternFill): unknown {
    const obj: any = {};
    message.patternFill !== undefined &&
      (obj.patternFill = message.patternFill
        ? PatternFill.toJSON(message.patternFill)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetPatternFill>, I>>(
    object: I
  ): SetPatternFill {
    const message = createBaseSetPatternFill();
    message.patternFill =
      object.patternFill !== undefined && object.patternFill !== null
        ? PatternFill.fromPartial(object.patternFill)
        : undefined;
    return message;
  },
};

function createBaseSetLeftBorderColor(): SetLeftBorderColor {
  return { color: "" };
}

export const SetLeftBorderColor = {
  encode(
    message: SetLeftBorderColor,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.color !== "") {
      writer.uint32(10).string(message.color);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetLeftBorderColor {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetLeftBorderColor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.color = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetLeftBorderColor {
    return {
      color: isSet(object.color) ? String(object.color) : "",
    };
  },

  toJSON(message: SetLeftBorderColor): unknown {
    const obj: any = {};
    message.color !== undefined && (obj.color = message.color);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetLeftBorderColor>, I>>(
    object: I
  ): SetLeftBorderColor {
    const message = createBaseSetLeftBorderColor();
    message.color = object.color ?? "";
    return message;
  },
};

function createBaseSetRightBorderColor(): SetRightBorderColor {
  return { color: "" };
}

export const SetRightBorderColor = {
  encode(
    message: SetRightBorderColor,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.color !== "") {
      writer.uint32(10).string(message.color);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetRightBorderColor {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetRightBorderColor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.color = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetRightBorderColor {
    return {
      color: isSet(object.color) ? String(object.color) : "",
    };
  },

  toJSON(message: SetRightBorderColor): unknown {
    const obj: any = {};
    message.color !== undefined && (obj.color = message.color);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetRightBorderColor>, I>>(
    object: I
  ): SetRightBorderColor {
    const message = createBaseSetRightBorderColor();
    message.color = object.color ?? "";
    return message;
  },
};

function createBaseSetTopBorderColor(): SetTopBorderColor {
  return { color: "" };
}

export const SetTopBorderColor = {
  encode(
    message: SetTopBorderColor,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.color !== "") {
      writer.uint32(10).string(message.color);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTopBorderColor {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTopBorderColor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.color = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetTopBorderColor {
    return {
      color: isSet(object.color) ? String(object.color) : "",
    };
  },

  toJSON(message: SetTopBorderColor): unknown {
    const obj: any = {};
    message.color !== undefined && (obj.color = message.color);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetTopBorderColor>, I>>(
    object: I
  ): SetTopBorderColor {
    const message = createBaseSetTopBorderColor();
    message.color = object.color ?? "";
    return message;
  },
};

function createBaseSetBottomBorderColor(): SetBottomBorderColor {
  return { color: "" };
}

export const SetBottomBorderColor = {
  encode(
    message: SetBottomBorderColor,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.color !== "") {
      writer.uint32(10).string(message.color);
    }
    return writer;
  },

  decode(
    input: _m0.Reader | Uint8Array,
    length?: number
  ): SetBottomBorderColor {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetBottomBorderColor();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.color = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetBottomBorderColor {
    return {
      color: isSet(object.color) ? String(object.color) : "",
    };
  },

  toJSON(message: SetBottomBorderColor): unknown {
    const obj: any = {};
    message.color !== undefined && (obj.color = message.color);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetBottomBorderColor>, I>>(
    object: I
  ): SetBottomBorderColor {
    const message = createBaseSetBottomBorderColor();
    message.color = object.color ?? "";
    return message;
  },
};

function createBaseSetLeftBorderType(): SetLeftBorderType {
  return { bt: 0 };
}

export const SetLeftBorderType = {
  encode(
    message: SetLeftBorderType,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.bt !== 0) {
      writer.uint32(8).int32(message.bt);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetLeftBorderType {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetLeftBorderType();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bt = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetLeftBorderType {
    return {
      bt: isSet(object.bt) ? borderTypeFromJSON(object.bt) : 0,
    };
  },

  toJSON(message: SetLeftBorderType): unknown {
    const obj: any = {};
    message.bt !== undefined && (obj.bt = borderTypeToJSON(message.bt));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetLeftBorderType>, I>>(
    object: I
  ): SetLeftBorderType {
    const message = createBaseSetLeftBorderType();
    message.bt = object.bt ?? 0;
    return message;
  },
};

function createBaseSetRightBorderType(): SetRightBorderType {
  return { bt: 0 };
}

export const SetRightBorderType = {
  encode(
    message: SetRightBorderType,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.bt !== 0) {
      writer.uint32(8).int32(message.bt);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetRightBorderType {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetRightBorderType();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bt = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetRightBorderType {
    return {
      bt: isSet(object.bt) ? borderTypeFromJSON(object.bt) : 0,
    };
  },

  toJSON(message: SetRightBorderType): unknown {
    const obj: any = {};
    message.bt !== undefined && (obj.bt = borderTypeToJSON(message.bt));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetRightBorderType>, I>>(
    object: I
  ): SetRightBorderType {
    const message = createBaseSetRightBorderType();
    message.bt = object.bt ?? 0;
    return message;
  },
};

function createBaseSetTopBorderType(): SetTopBorderType {
  return { bt: 0 };
}

export const SetTopBorderType = {
  encode(
    message: SetTopBorderType,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.bt !== 0) {
      writer.uint32(8).int32(message.bt);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetTopBorderType {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetTopBorderType();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bt = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetTopBorderType {
    return {
      bt: isSet(object.bt) ? borderTypeFromJSON(object.bt) : 0,
    };
  },

  toJSON(message: SetTopBorderType): unknown {
    const obj: any = {};
    message.bt !== undefined && (obj.bt = borderTypeToJSON(message.bt));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetTopBorderType>, I>>(
    object: I
  ): SetTopBorderType {
    const message = createBaseSetTopBorderType();
    message.bt = object.bt ?? 0;
    return message;
  },
};

function createBaseSetBottomBorderType(): SetBottomBorderType {
  return { bt: 0 };
}

export const SetBottomBorderType = {
  encode(
    message: SetBottomBorderType,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.bt !== 0) {
      writer.uint32(8).int32(message.bt);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SetBottomBorderType {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSetBottomBorderType();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.bt = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SetBottomBorderType {
    return {
      bt: isSet(object.bt) ? borderTypeFromJSON(object.bt) : 0,
    };
  },

  toJSON(message: SetBottomBorderType): unknown {
    const obj: any = {};
    message.bt !== undefined && (obj.bt = borderTypeToJSON(message.bt));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SetBottomBorderType>, I>>(
    object: I
  ): SetBottomBorderType {
    const message = createBaseSetBottomBorderType();
    message.bt = object.bt ?? 0;
    return message;
  },
};

function createBaseStyleUpdatePayload(): StyleUpdatePayload {
  return { stylePayloadOneof: undefined };
}

export const StyleUpdatePayload = {
  encode(
    message: StyleUpdatePayload,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.stylePayloadOneof?.$case === "setFontBold") {
      SetFontBold.encode(
        message.stylePayloadOneof.setFontBold,
        writer.uint32(10).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontItalic") {
      SetFontItalic.encode(
        message.stylePayloadOneof.setFontItalic,
        writer.uint32(18).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontUnderline") {
      SetFontUnderline.encode(
        message.stylePayloadOneof.setFontUnderline,
        writer.uint32(26).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontColor") {
      SetFontColor.encode(
        message.stylePayloadOneof.setFontColor,
        writer.uint32(34).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontSize") {
      SetFontSize.encode(
        message.stylePayloadOneof.setFontSize,
        writer.uint32(42).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontName") {
      SetFontName.encode(
        message.stylePayloadOneof.setFontName,
        writer.uint32(50).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontOutline") {
      SetFontOutline.encode(
        message.stylePayloadOneof.setFontOutline,
        writer.uint32(58).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontShadow") {
      SetFontShadow.encode(
        message.stylePayloadOneof.setFontShadow,
        writer.uint32(66).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontStrike") {
      SetFontStrike.encode(
        message.stylePayloadOneof.setFontStrike,
        writer.uint32(74).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setFontCondense") {
      SetFontCondense.encode(
        message.stylePayloadOneof.setFontCondense,
        writer.uint32(82).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setBorderDiagonalUp") {
      SetBorderDiagonalUp.encode(
        message.stylePayloadOneof.setBorderDiagonalUp,
        writer.uint32(90).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setBorderDiagonalDown") {
      SetBorderDiagonalDown.encode(
        message.stylePayloadOneof.setBorderDiagonalDown,
        writer.uint32(98).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setBorderOutline") {
      SetBorderOutline.encode(
        message.stylePayloadOneof.setBorderOutline,
        writer.uint32(106).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setLeftBorderColor") {
      SetLeftBorderColor.encode(
        message.stylePayloadOneof.setLeftBorderColor,
        writer.uint32(114).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setRightBorderColor") {
      SetRightBorderColor.encode(
        message.stylePayloadOneof.setRightBorderColor,
        writer.uint32(122).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setTopBorderColor") {
      SetTopBorderColor.encode(
        message.stylePayloadOneof.setTopBorderColor,
        writer.uint32(130).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setBottomBorderColor") {
      SetBottomBorderColor.encode(
        message.stylePayloadOneof.setBottomBorderColor,
        writer.uint32(138).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setLeftBorderType") {
      SetLeftBorderType.encode(
        message.stylePayloadOneof.setLeftBorderType,
        writer.uint32(146).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setRightBorderType") {
      SetRightBorderType.encode(
        message.stylePayloadOneof.setRightBorderType,
        writer.uint32(154).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setTopBorderType") {
      SetTopBorderType.encode(
        message.stylePayloadOneof.setTopBorderType,
        writer.uint32(162).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setBottomBorderType") {
      SetBottomBorderType.encode(
        message.stylePayloadOneof.setBottomBorderType,
        writer.uint32(170).fork()
      ).ldelim();
    }
    if (message.stylePayloadOneof?.$case === "setPatternFill") {
      SetPatternFill.encode(
        message.stylePayloadOneof.setPatternFill,
        writer.uint32(178).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StyleUpdatePayload {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStyleUpdatePayload();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.stylePayloadOneof = {
            $case: "setFontBold",
            setFontBold: SetFontBold.decode(reader, reader.uint32()),
          };
          break;
        case 2:
          message.stylePayloadOneof = {
            $case: "setFontItalic",
            setFontItalic: SetFontItalic.decode(reader, reader.uint32()),
          };
          break;
        case 3:
          message.stylePayloadOneof = {
            $case: "setFontUnderline",
            setFontUnderline: SetFontUnderline.decode(reader, reader.uint32()),
          };
          break;
        case 4:
          message.stylePayloadOneof = {
            $case: "setFontColor",
            setFontColor: SetFontColor.decode(reader, reader.uint32()),
          };
          break;
        case 5:
          message.stylePayloadOneof = {
            $case: "setFontSize",
            setFontSize: SetFontSize.decode(reader, reader.uint32()),
          };
          break;
        case 6:
          message.stylePayloadOneof = {
            $case: "setFontName",
            setFontName: SetFontName.decode(reader, reader.uint32()),
          };
          break;
        case 7:
          message.stylePayloadOneof = {
            $case: "setFontOutline",
            setFontOutline: SetFontOutline.decode(reader, reader.uint32()),
          };
          break;
        case 8:
          message.stylePayloadOneof = {
            $case: "setFontShadow",
            setFontShadow: SetFontShadow.decode(reader, reader.uint32()),
          };
          break;
        case 9:
          message.stylePayloadOneof = {
            $case: "setFontStrike",
            setFontStrike: SetFontStrike.decode(reader, reader.uint32()),
          };
          break;
        case 10:
          message.stylePayloadOneof = {
            $case: "setFontCondense",
            setFontCondense: SetFontCondense.decode(reader, reader.uint32()),
          };
          break;
        case 11:
          message.stylePayloadOneof = {
            $case: "setBorderDiagonalUp",
            setBorderDiagonalUp: SetBorderDiagonalUp.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 12:
          message.stylePayloadOneof = {
            $case: "setBorderDiagonalDown",
            setBorderDiagonalDown: SetBorderDiagonalDown.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 13:
          message.stylePayloadOneof = {
            $case: "setBorderOutline",
            setBorderOutline: SetBorderOutline.decode(reader, reader.uint32()),
          };
          break;
        case 14:
          message.stylePayloadOneof = {
            $case: "setLeftBorderColor",
            setLeftBorderColor: SetLeftBorderColor.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 15:
          message.stylePayloadOneof = {
            $case: "setRightBorderColor",
            setRightBorderColor: SetRightBorderColor.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 16:
          message.stylePayloadOneof = {
            $case: "setTopBorderColor",
            setTopBorderColor: SetTopBorderColor.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 17:
          message.stylePayloadOneof = {
            $case: "setBottomBorderColor",
            setBottomBorderColor: SetBottomBorderColor.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 18:
          message.stylePayloadOneof = {
            $case: "setLeftBorderType",
            setLeftBorderType: SetLeftBorderType.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 19:
          message.stylePayloadOneof = {
            $case: "setRightBorderType",
            setRightBorderType: SetRightBorderType.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 20:
          message.stylePayloadOneof = {
            $case: "setTopBorderType",
            setTopBorderType: SetTopBorderType.decode(reader, reader.uint32()),
          };
          break;
        case 21:
          message.stylePayloadOneof = {
            $case: "setBottomBorderType",
            setBottomBorderType: SetBottomBorderType.decode(
              reader,
              reader.uint32()
            ),
          };
          break;
        case 22:
          message.stylePayloadOneof = {
            $case: "setPatternFill",
            setPatternFill: SetPatternFill.decode(reader, reader.uint32()),
          };
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): StyleUpdatePayload {
    return {
      stylePayloadOneof: isSet(object.setFontBold)
        ? {
            $case: "setFontBold",
            setFontBold: SetFontBold.fromJSON(object.setFontBold),
          }
        : isSet(object.setFontItalic)
        ? {
            $case: "setFontItalic",
            setFontItalic: SetFontItalic.fromJSON(object.setFontItalic),
          }
        : isSet(object.setFontUnderline)
        ? {
            $case: "setFontUnderline",
            setFontUnderline: SetFontUnderline.fromJSON(
              object.setFontUnderline
            ),
          }
        : isSet(object.setFontColor)
        ? {
            $case: "setFontColor",
            setFontColor: SetFontColor.fromJSON(object.setFontColor),
          }
        : isSet(object.setFontSize)
        ? {
            $case: "setFontSize",
            setFontSize: SetFontSize.fromJSON(object.setFontSize),
          }
        : isSet(object.setFontName)
        ? {
            $case: "setFontName",
            setFontName: SetFontName.fromJSON(object.setFontName),
          }
        : isSet(object.setFontOutline)
        ? {
            $case: "setFontOutline",
            setFontOutline: SetFontOutline.fromJSON(object.setFontOutline),
          }
        : isSet(object.setFontShadow)
        ? {
            $case: "setFontShadow",
            setFontShadow: SetFontShadow.fromJSON(object.setFontShadow),
          }
        : isSet(object.setFontStrike)
        ? {
            $case: "setFontStrike",
            setFontStrike: SetFontStrike.fromJSON(object.setFontStrike),
          }
        : isSet(object.setFontCondense)
        ? {
            $case: "setFontCondense",
            setFontCondense: SetFontCondense.fromJSON(object.setFontCondense),
          }
        : isSet(object.setBorderDiagonalUp)
        ? {
            $case: "setBorderDiagonalUp",
            setBorderDiagonalUp: SetBorderDiagonalUp.fromJSON(
              object.setBorderDiagonalUp
            ),
          }
        : isSet(object.setBorderDiagonalDown)
        ? {
            $case: "setBorderDiagonalDown",
            setBorderDiagonalDown: SetBorderDiagonalDown.fromJSON(
              object.setBorderDiagonalDown
            ),
          }
        : isSet(object.setBorderOutline)
        ? {
            $case: "setBorderOutline",
            setBorderOutline: SetBorderOutline.fromJSON(
              object.setBorderOutline
            ),
          }
        : isSet(object.setLeftBorderColor)
        ? {
            $case: "setLeftBorderColor",
            setLeftBorderColor: SetLeftBorderColor.fromJSON(
              object.setLeftBorderColor
            ),
          }
        : isSet(object.setRightBorderColor)
        ? {
            $case: "setRightBorderColor",
            setRightBorderColor: SetRightBorderColor.fromJSON(
              object.setRightBorderColor
            ),
          }
        : isSet(object.setTopBorderColor)
        ? {
            $case: "setTopBorderColor",
            setTopBorderColor: SetTopBorderColor.fromJSON(
              object.setTopBorderColor
            ),
          }
        : isSet(object.setBottomBorderColor)
        ? {
            $case: "setBottomBorderColor",
            setBottomBorderColor: SetBottomBorderColor.fromJSON(
              object.setBottomBorderColor
            ),
          }
        : isSet(object.setLeftBorderType)
        ? {
            $case: "setLeftBorderType",
            setLeftBorderType: SetLeftBorderType.fromJSON(
              object.setLeftBorderType
            ),
          }
        : isSet(object.setRightBorderType)
        ? {
            $case: "setRightBorderType",
            setRightBorderType: SetRightBorderType.fromJSON(
              object.setRightBorderType
            ),
          }
        : isSet(object.setTopBorderType)
        ? {
            $case: "setTopBorderType",
            setTopBorderType: SetTopBorderType.fromJSON(
              object.setTopBorderType
            ),
          }
        : isSet(object.setBottomBorderType)
        ? {
            $case: "setBottomBorderType",
            setBottomBorderType: SetBottomBorderType.fromJSON(
              object.setBottomBorderType
            ),
          }
        : isSet(object.setPatternFill)
        ? {
            $case: "setPatternFill",
            setPatternFill: SetPatternFill.fromJSON(object.setPatternFill),
          }
        : undefined,
    };
  },

  toJSON(message: StyleUpdatePayload): unknown {
    const obj: any = {};
    message.stylePayloadOneof?.$case === "setFontBold" &&
      (obj.setFontBold = message.stylePayloadOneof?.setFontBold
        ? SetFontBold.toJSON(message.stylePayloadOneof?.setFontBold)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontItalic" &&
      (obj.setFontItalic = message.stylePayloadOneof?.setFontItalic
        ? SetFontItalic.toJSON(message.stylePayloadOneof?.setFontItalic)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontUnderline" &&
      (obj.setFontUnderline = message.stylePayloadOneof?.setFontUnderline
        ? SetFontUnderline.toJSON(message.stylePayloadOneof?.setFontUnderline)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontColor" &&
      (obj.setFontColor = message.stylePayloadOneof?.setFontColor
        ? SetFontColor.toJSON(message.stylePayloadOneof?.setFontColor)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontSize" &&
      (obj.setFontSize = message.stylePayloadOneof?.setFontSize
        ? SetFontSize.toJSON(message.stylePayloadOneof?.setFontSize)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontName" &&
      (obj.setFontName = message.stylePayloadOneof?.setFontName
        ? SetFontName.toJSON(message.stylePayloadOneof?.setFontName)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontOutline" &&
      (obj.setFontOutline = message.stylePayloadOneof?.setFontOutline
        ? SetFontOutline.toJSON(message.stylePayloadOneof?.setFontOutline)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontShadow" &&
      (obj.setFontShadow = message.stylePayloadOneof?.setFontShadow
        ? SetFontShadow.toJSON(message.stylePayloadOneof?.setFontShadow)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontStrike" &&
      (obj.setFontStrike = message.stylePayloadOneof?.setFontStrike
        ? SetFontStrike.toJSON(message.stylePayloadOneof?.setFontStrike)
        : undefined);
    message.stylePayloadOneof?.$case === "setFontCondense" &&
      (obj.setFontCondense = message.stylePayloadOneof?.setFontCondense
        ? SetFontCondense.toJSON(message.stylePayloadOneof?.setFontCondense)
        : undefined);
    message.stylePayloadOneof?.$case === "setBorderDiagonalUp" &&
      (obj.setBorderDiagonalUp = message.stylePayloadOneof?.setBorderDiagonalUp
        ? SetBorderDiagonalUp.toJSON(
            message.stylePayloadOneof?.setBorderDiagonalUp
          )
        : undefined);
    message.stylePayloadOneof?.$case === "setBorderDiagonalDown" &&
      (obj.setBorderDiagonalDown = message.stylePayloadOneof
        ?.setBorderDiagonalDown
        ? SetBorderDiagonalDown.toJSON(
            message.stylePayloadOneof?.setBorderDiagonalDown
          )
        : undefined);
    message.stylePayloadOneof?.$case === "setBorderOutline" &&
      (obj.setBorderOutline = message.stylePayloadOneof?.setBorderOutline
        ? SetBorderOutline.toJSON(message.stylePayloadOneof?.setBorderOutline)
        : undefined);
    message.stylePayloadOneof?.$case === "setLeftBorderColor" &&
      (obj.setLeftBorderColor = message.stylePayloadOneof?.setLeftBorderColor
        ? SetLeftBorderColor.toJSON(
            message.stylePayloadOneof?.setLeftBorderColor
          )
        : undefined);
    message.stylePayloadOneof?.$case === "setRightBorderColor" &&
      (obj.setRightBorderColor = message.stylePayloadOneof?.setRightBorderColor
        ? SetRightBorderColor.toJSON(
            message.stylePayloadOneof?.setRightBorderColor
          )
        : undefined);
    message.stylePayloadOneof?.$case === "setTopBorderColor" &&
      (obj.setTopBorderColor = message.stylePayloadOneof?.setTopBorderColor
        ? SetTopBorderColor.toJSON(message.stylePayloadOneof?.setTopBorderColor)
        : undefined);
    message.stylePayloadOneof?.$case === "setBottomBorderColor" &&
      (obj.setBottomBorderColor = message.stylePayloadOneof
        ?.setBottomBorderColor
        ? SetBottomBorderColor.toJSON(
            message.stylePayloadOneof?.setBottomBorderColor
          )
        : undefined);
    message.stylePayloadOneof?.$case === "setLeftBorderType" &&
      (obj.setLeftBorderType = message.stylePayloadOneof?.setLeftBorderType
        ? SetLeftBorderType.toJSON(message.stylePayloadOneof?.setLeftBorderType)
        : undefined);
    message.stylePayloadOneof?.$case === "setRightBorderType" &&
      (obj.setRightBorderType = message.stylePayloadOneof?.setRightBorderType
        ? SetRightBorderType.toJSON(
            message.stylePayloadOneof?.setRightBorderType
          )
        : undefined);
    message.stylePayloadOneof?.$case === "setTopBorderType" &&
      (obj.setTopBorderType = message.stylePayloadOneof?.setTopBorderType
        ? SetTopBorderType.toJSON(message.stylePayloadOneof?.setTopBorderType)
        : undefined);
    message.stylePayloadOneof?.$case === "setBottomBorderType" &&
      (obj.setBottomBorderType = message.stylePayloadOneof?.setBottomBorderType
        ? SetBottomBorderType.toJSON(
            message.stylePayloadOneof?.setBottomBorderType
          )
        : undefined);
    message.stylePayloadOneof?.$case === "setPatternFill" &&
      (obj.setPatternFill = message.stylePayloadOneof?.setPatternFill
        ? SetPatternFill.toJSON(message.stylePayloadOneof?.setPatternFill)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<StyleUpdatePayload>, I>>(
    object: I
  ): StyleUpdatePayload {
    const message = createBaseStyleUpdatePayload();
    if (
      object.stylePayloadOneof?.$case === "setFontBold" &&
      object.stylePayloadOneof?.setFontBold !== undefined &&
      object.stylePayloadOneof?.setFontBold !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontBold",
        setFontBold: SetFontBold.fromPartial(
          object.stylePayloadOneof.setFontBold
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontItalic" &&
      object.stylePayloadOneof?.setFontItalic !== undefined &&
      object.stylePayloadOneof?.setFontItalic !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontItalic",
        setFontItalic: SetFontItalic.fromPartial(
          object.stylePayloadOneof.setFontItalic
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontUnderline" &&
      object.stylePayloadOneof?.setFontUnderline !== undefined &&
      object.stylePayloadOneof?.setFontUnderline !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontUnderline",
        setFontUnderline: SetFontUnderline.fromPartial(
          object.stylePayloadOneof.setFontUnderline
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontColor" &&
      object.stylePayloadOneof?.setFontColor !== undefined &&
      object.stylePayloadOneof?.setFontColor !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontColor",
        setFontColor: SetFontColor.fromPartial(
          object.stylePayloadOneof.setFontColor
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontSize" &&
      object.stylePayloadOneof?.setFontSize !== undefined &&
      object.stylePayloadOneof?.setFontSize !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontSize",
        setFontSize: SetFontSize.fromPartial(
          object.stylePayloadOneof.setFontSize
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontName" &&
      object.stylePayloadOneof?.setFontName !== undefined &&
      object.stylePayloadOneof?.setFontName !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontName",
        setFontName: SetFontName.fromPartial(
          object.stylePayloadOneof.setFontName
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontOutline" &&
      object.stylePayloadOneof?.setFontOutline !== undefined &&
      object.stylePayloadOneof?.setFontOutline !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontOutline",
        setFontOutline: SetFontOutline.fromPartial(
          object.stylePayloadOneof.setFontOutline
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontShadow" &&
      object.stylePayloadOneof?.setFontShadow !== undefined &&
      object.stylePayloadOneof?.setFontShadow !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontShadow",
        setFontShadow: SetFontShadow.fromPartial(
          object.stylePayloadOneof.setFontShadow
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontStrike" &&
      object.stylePayloadOneof?.setFontStrike !== undefined &&
      object.stylePayloadOneof?.setFontStrike !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontStrike",
        setFontStrike: SetFontStrike.fromPartial(
          object.stylePayloadOneof.setFontStrike
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setFontCondense" &&
      object.stylePayloadOneof?.setFontCondense !== undefined &&
      object.stylePayloadOneof?.setFontCondense !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setFontCondense",
        setFontCondense: SetFontCondense.fromPartial(
          object.stylePayloadOneof.setFontCondense
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setBorderDiagonalUp" &&
      object.stylePayloadOneof?.setBorderDiagonalUp !== undefined &&
      object.stylePayloadOneof?.setBorderDiagonalUp !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setBorderDiagonalUp",
        setBorderDiagonalUp: SetBorderDiagonalUp.fromPartial(
          object.stylePayloadOneof.setBorderDiagonalUp
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setBorderDiagonalDown" &&
      object.stylePayloadOneof?.setBorderDiagonalDown !== undefined &&
      object.stylePayloadOneof?.setBorderDiagonalDown !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setBorderDiagonalDown",
        setBorderDiagonalDown: SetBorderDiagonalDown.fromPartial(
          object.stylePayloadOneof.setBorderDiagonalDown
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setBorderOutline" &&
      object.stylePayloadOneof?.setBorderOutline !== undefined &&
      object.stylePayloadOneof?.setBorderOutline !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setBorderOutline",
        setBorderOutline: SetBorderOutline.fromPartial(
          object.stylePayloadOneof.setBorderOutline
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setLeftBorderColor" &&
      object.stylePayloadOneof?.setLeftBorderColor !== undefined &&
      object.stylePayloadOneof?.setLeftBorderColor !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setLeftBorderColor",
        setLeftBorderColor: SetLeftBorderColor.fromPartial(
          object.stylePayloadOneof.setLeftBorderColor
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setRightBorderColor" &&
      object.stylePayloadOneof?.setRightBorderColor !== undefined &&
      object.stylePayloadOneof?.setRightBorderColor !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setRightBorderColor",
        setRightBorderColor: SetRightBorderColor.fromPartial(
          object.stylePayloadOneof.setRightBorderColor
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setTopBorderColor" &&
      object.stylePayloadOneof?.setTopBorderColor !== undefined &&
      object.stylePayloadOneof?.setTopBorderColor !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setTopBorderColor",
        setTopBorderColor: SetTopBorderColor.fromPartial(
          object.stylePayloadOneof.setTopBorderColor
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setBottomBorderColor" &&
      object.stylePayloadOneof?.setBottomBorderColor !== undefined &&
      object.stylePayloadOneof?.setBottomBorderColor !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setBottomBorderColor",
        setBottomBorderColor: SetBottomBorderColor.fromPartial(
          object.stylePayloadOneof.setBottomBorderColor
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setLeftBorderType" &&
      object.stylePayloadOneof?.setLeftBorderType !== undefined &&
      object.stylePayloadOneof?.setLeftBorderType !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setLeftBorderType",
        setLeftBorderType: SetLeftBorderType.fromPartial(
          object.stylePayloadOneof.setLeftBorderType
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setRightBorderType" &&
      object.stylePayloadOneof?.setRightBorderType !== undefined &&
      object.stylePayloadOneof?.setRightBorderType !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setRightBorderType",
        setRightBorderType: SetRightBorderType.fromPartial(
          object.stylePayloadOneof.setRightBorderType
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setTopBorderType" &&
      object.stylePayloadOneof?.setTopBorderType !== undefined &&
      object.stylePayloadOneof?.setTopBorderType !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setTopBorderType",
        setTopBorderType: SetTopBorderType.fromPartial(
          object.stylePayloadOneof.setTopBorderType
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setBottomBorderType" &&
      object.stylePayloadOneof?.setBottomBorderType !== undefined &&
      object.stylePayloadOneof?.setBottomBorderType !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setBottomBorderType",
        setBottomBorderType: SetBottomBorderType.fromPartial(
          object.stylePayloadOneof.setBottomBorderType
        ),
      };
    }
    if (
      object.stylePayloadOneof?.$case === "setPatternFill" &&
      object.stylePayloadOneof?.setPatternFill !== undefined &&
      object.stylePayloadOneof?.setPatternFill !== null
    ) {
      message.stylePayloadOneof = {
        $case: "setPatternFill",
        setPatternFill: SetPatternFill.fromPartial(
          object.stylePayloadOneof.setPatternFill
        ),
      };
    }
    return message;
  },
};

function createBaseStyleUpdate(): StyleUpdate {
  return { sheetIdx: 0, row: 0, col: 0, payloads: [] };
}

export const StyleUpdate = {
  encode(
    message: StyleUpdate,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.sheetIdx !== 0) {
      writer.uint32(8).uint32(message.sheetIdx);
    }
    if (message.row !== 0) {
      writer.uint32(16).uint32(message.row);
    }
    if (message.col !== 0) {
      writer.uint32(24).uint32(message.col);
    }
    for (const v of message.payloads) {
      StyleUpdatePayload.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): StyleUpdate {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseStyleUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sheetIdx = reader.uint32();
          break;
        case 2:
          message.row = reader.uint32();
          break;
        case 3:
          message.col = reader.uint32();
          break;
        case 4:
          message.payloads.push(
            StyleUpdatePayload.decode(reader, reader.uint32())
          );
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): StyleUpdate {
    return {
      sheetIdx: isSet(object.sheetIdx) ? Number(object.sheetIdx) : 0,
      row: isSet(object.row) ? Number(object.row) : 0,
      col: isSet(object.col) ? Number(object.col) : 0,
      payloads: Array.isArray(object?.payloads)
        ? object.payloads.map((e: any) => StyleUpdatePayload.fromJSON(e))
        : [],
    };
  },

  toJSON(message: StyleUpdate): unknown {
    const obj: any = {};
    message.sheetIdx !== undefined &&
      (obj.sheetIdx = Math.round(message.sheetIdx));
    message.row !== undefined && (obj.row = Math.round(message.row));
    message.col !== undefined && (obj.col = Math.round(message.col));
    if (message.payloads) {
      obj.payloads = message.payloads.map((e) =>
        e ? StyleUpdatePayload.toJSON(e) : undefined
      );
    } else {
      obj.payloads = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<StyleUpdate>, I>>(
    object: I
  ): StyleUpdate {
    const message = createBaseStyleUpdate();
    message.sheetIdx = object.sheetIdx ?? 0;
    message.row = object.row ?? 0;
    message.col = object.col ?? 0;
    message.payloads =
      object.payloads?.map((e) => StyleUpdatePayload.fromPartial(e)) || [];
    return message;
  },
};

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
var globalThis: any = (() => {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof self !== "undefined") return self;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  throw "Unable to locate global object";
})();

const atob: (b64: string) => string =
  globalThis.atob ||
  ((b64) => globalThis.Buffer.from(b64, "base64").toString("binary"));
function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; ++i) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

const btoa: (bin: string) => string =
  globalThis.btoa ||
  ((bin) => globalThis.Buffer.from(bin, "binary").toString("base64"));
function base64FromBytes(arr: Uint8Array): string {
  const bin: string[] = [];
  for (const byte of arr) {
    bin.push(String.fromCharCode(byte));
  }
  return btoa(bin.join(""));
}

type Builtin =
  | Date
  | Function
  | Uint8Array
  | string
  | number
  | boolean
  | undefined;

export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends { $case: string }
  ? { [K in keyof Omit<T, "$case">]?: DeepPartial<T[K]> } & {
      $case: T["$case"];
    }
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin
  ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & Record<
        Exclude<keyof I, KeysOfUnion<P>>,
        never
      >;

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
