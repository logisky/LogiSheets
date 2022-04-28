import type { CtColor } from "./color";
import type { StPatternType } from "./st_pattern_type";

export interface CtPatternFill { fgColor: CtColor | null, bgColor: CtColor | null, patternType: StPatternType | null, }