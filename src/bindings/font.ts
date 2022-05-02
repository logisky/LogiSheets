import type { Color } from "./color";
import type { CtFontFamily } from "./font_family";
import type { CtFontName } from "./font_name";
import type { CtFontScheme } from "./font_scheme";
import type { CtUnderlineProperty } from "./underline_property";
import type { CtVerticalAlignFontProperty } from "./vertical_align_font_property";

export interface Font { bold: boolean, italic: boolean, underline: CtUnderlineProperty | null, color: Color, sz: number | null, name: CtFontName | null, charset: number | null, family: CtFontFamily | null, strike: boolean, outline: boolean, shadow: boolean, condense: boolean, extend: boolean, vertAlign: CtVerticalAlignFontProperty | null, scheme: CtFontScheme | null, }