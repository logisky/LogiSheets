export interface TopLeftCell {
    readonly row: number
    readonly col: number
}
export interface Frozen {
    readonly topLeftCell: TopLeftCell
    readonly rowCount: number
    readonly columnCount: number
}
export interface Scroll {
    readonly x: number
    readonly y: number
    update(type: 'x' | 'y', value: number): void
}
class ScrollImpl implements Scroll {
    x = 0
    y = 0
    update(type: 'x' | 'y', value: number) {
        if (type === 'x') this.x = value
        else this.y = value
    }
}
