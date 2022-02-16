import { Position } from './position'
import { ClipboardStoredMetaData } from 'common/events'
import { TextAreaState } from './textarea-state'
export class ClipboardDataToCopy {
    constructor(
        public data: ClipboardStoredMetaData
    ) { }
    public text = ''
}

export interface TextAreaInputHost {
    getDataToCopy(start: Position, end: Position): ClipboardDataToCopy
    getScreenReaderContent(currentState: TextAreaState): TextAreaState
    deduceModelPosition(
        viewAnchorPosition: Position,
        deltaOffset: number,
        lineFeedCnt: number
    ): Position
}
