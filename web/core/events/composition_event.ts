export interface CompositionEvent {
    readonly text: string
    readonly replacePrevCharCnt: number
    readonly replaceNextCharCnt: number
    readonly positionDelta: number
}
