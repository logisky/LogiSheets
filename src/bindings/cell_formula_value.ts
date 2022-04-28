import type { Value } from "./value";

export interface CellFormulaValue { row: number, col: number, formula: string, value: Value, }