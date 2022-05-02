import type { BorderPr } from "./border_pr";

export interface Border { left: BorderPr | null, right: BorderPr | null, top: BorderPr | null, bottom: BorderPr | null, diagonal: BorderPr | null, vertical: BorderPr | null, horizontal: BorderPr | null, diagonalUp: boolean | null, diagonalDown: boolean | null, outline: boolean, }