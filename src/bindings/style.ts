// WARNING: unlike other files in this directory, this file will not be
// re-generated every time we run
// ```
// cargo test --workspace
// ```
// Check in crates/controller/src/controller/display.rs::Style, it has no
// ```
// #[ts(export)]
// ```
import type { CtBorder } from "./border";
import type { CtCellAlignment } from "./cell_alignment";
import type { CtCellProtection } from "./cell_protection";
import type { CtFill } from "./fill";
import type { CtFont } from "./font";

export interface Style { font: CtFont, fill: CtFill, border: CtBorder, alignment: CtCellAlignment | null, protection: CtCellProtection | null, formatter: string, }