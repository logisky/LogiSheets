import type { CtGradientStop } from "./gradient_stop";
import type { StGradientType } from "./st_gradient_type";

export interface CtGradientFill { stops: Array<CtGradientStop>, ty: StGradientType, degree: number, left: number, right: number, top: number, bottom: number, }