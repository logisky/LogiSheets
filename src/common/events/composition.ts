export class CompositionData {
    public data = ''
}
export class CompositionStartEvent {
    public revealDeltaColumns = 0
}
export interface CompositionEvent {
    readonly text: string
    readonly replacePrevCharCnt: number
    readonly replaceNextCharCnt: number
    readonly positionDelta: number
}
