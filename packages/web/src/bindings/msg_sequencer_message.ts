// DO NOT EDIT. CODE GENERATED BY gents.
import { SequencerActionInvalidMessage } from './msg_sequencer_action_invalid_message'
import { SequencerActionMessage } from './msg_sequencer_action_message'
import { SequencerInitWorkbook } from './msg_sequencer_init_workbook'

export type SequencerMessage =
    | { invalidAction: SequencerActionInvalidMessage }
    | { action: SequencerActionMessage }
    | { join: SequencerInitWorkbook }
