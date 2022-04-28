import type { PayloadsAction } from "./payloads_action";

export type EditAction = "Undo" | "Redo" | { Payloads: PayloadsAction };