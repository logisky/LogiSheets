import {equal} from '@/core'

export class BaseInfo {
    x = 0
    y = 0
    lineNumber = 0
    column = 0
    setX(x: number) {
        const _x = Math.max(x, 0)
        this.x = _x
        return this
    }
    setY(y: number) {
        const _y = Math.max(y, 0)
        this.y = _y
        return this
    }
    setLineNumber(lineNumber: number) {
        const _l = Math.max(lineNumber, 0)
        this.lineNumber = _l
        return this
    }
    setColumn(column: number) {
        const _c = Math.max(column, 0)
        this.column = _c
        return this
    }
    equal(baseInfo: BaseInfo) {
        return equal(baseInfo, this)
    }

    biggerThan(baseInfo: BaseInfo): boolean {
        if (this.lineNumber > baseInfo.lineNumber) return true
        if (this.lineNumber < baseInfo.lineNumber) return false
        return this.column >= baseInfo.column
    }
}
