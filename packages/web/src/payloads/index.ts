// The old separate style payload types (setCellFont, setCellBorder, etc.) have been
// replaced by the unified StyleUpdateType-based approach.
// Use CellStyleUpdateBuilder/LineStyleUpdateBuilder + StyleUpdateTypeBuilder to build
// style payloads.
//
// Payload is now simply EditPayload.
export type {EditPayload as Payload} from '../bindings'
