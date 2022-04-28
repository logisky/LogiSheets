import type { EditPayload } from "./payload";

export interface PayloadsAction { payloads: Array<EditPayload>, undoable: boolean, }