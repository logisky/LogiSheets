import type { CtColor } from "./color";
import type { CtFontFamily } from "./font_family";
import type { CtFontName } from "./font_name";
import type { CtFontScheme } from "./font_scheme";
import type { CtFontSize } from "./font_size";
import type { CtIntProperty } from "./int_property";
import type { CtUnderlineProperty } from "./underline_property";
import type { CtVerticalAlignFontProperty } from "./vertical_align_font_property";

export interface CtFont { bold: boolean, italic: boolean, underline: CtUnderlineProperty | null, color: CtColor | null, sz: CtFontSize | null, name: CtFontName | null, charset: CtIntProperty | null, family: CtFontFamily | null, strike: boolean, outline: boolean, shadow: boolean, condense: boolean, extend: boolean, vertAlign: CtVerticalAlignFontProperty | null, scheme: CtFontScheme | null, }