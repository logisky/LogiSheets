import type { GradientStop } from "./gradient_stop";
import type { StGradientType } from "./st_gradient_type";

export interface GradientFill { stops: Array<GradientStop>, ty: StGradientType, degree: number, left: number, right: number, top: number, bottom: number, }