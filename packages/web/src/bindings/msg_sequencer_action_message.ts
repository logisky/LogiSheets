// DO NOT EDIT. CODE GENERATED BY gents.
import { EditAction } from './edit_action'

// Users will receive this message to update its local file.
export interface SequencerActionMessage {
    version: number
    userId: string
    fileId: string
    action: EditAction
}
