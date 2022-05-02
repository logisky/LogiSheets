import type { Border } from "./border";
import type { CtCellAlignment } from "../../../src/bindings/cell_alignment";
import type { CtCellProtection } from "../../../src/bindings/cell_protection";
import type { Fill } from "./fill";
import type { Font } from "./font";

export interface Style { font: Font, fill: Fill, border: Border, alignment: CtCellAlignment | null, protection: CtCellProtection | null, formatter: string, }