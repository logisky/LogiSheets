// DO NOT EDIT. CODE GENERATED BY gents.
import {EditPayload} from './edit_payload'

// A `PayloadsAction` contains one or more `EditPayload`.
// These `EditPayload`s will be withdrawn at the same time if user undo it.
// And if one of the payload is failed to be executed, this `EditAction` will
// not do anything at all.
// 
// An `EditPayload` represents an atomic update of a workbook and they will be
// executed in sequence. That means it is a totally different result between
// updating a cell at B4 before inserting and after inserting.
export interface PayloadsAction {
    payloads: readonly EditPayload[]
    undoable: boolean
}
