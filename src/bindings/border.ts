import type { CtBorderPr } from "./border_pr";

export interface CtBorder { left: CtBorderPr | null, right: CtBorderPr | null, top: CtBorderPr | null, bottom: CtBorderPr | null, diagonal: CtBorderPr | null, vertical: CtBorderPr | null, horizontal: CtBorderPr | null, diagonalUp: boolean | null, diagonalDown: boolean | null, outline: boolean, }