import type { StHorizontalAlignment } from "./st_horizontal_alignment";
import type { StVerticalAlignment } from "./st_vertical_alignment";

export interface CtCellAlignment { horizontal: StHorizontalAlignment | null, vertical: StVerticalAlignment | null, textRotation: number | null, wrapText: boolean | null, indent: number | null, relativeIndent: number | null, justifyLastLine: boolean | null, shrinkToFit: boolean | null, readingOrder: number | null, }