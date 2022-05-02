import type { Color } from "./color";
import type { StPatternType } from "./st_pattern_type";

export interface PatternFill { fgColor: Color | null, bgColor: Color | null, patternType: StPatternType | null, }