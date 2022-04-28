import type { CtGradientFill } from "./gradient_fill";
import type { CtPatternFill } from "./pattern_fill";

export type CtFill = { PatternFill: CtPatternFill } | { GradientFill: CtGradientFill };