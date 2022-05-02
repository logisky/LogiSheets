import type { GradientFill } from "./gradient_fill";
import type { PatternFill } from "./pattern_fill";

export type Fill = { patternFill: PatternFill } | { gradientFill: GradientFill };