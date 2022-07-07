import { equal } from '@/common'

export class BaseInfo {
    public x = 0
    public y = 0
    public lineNumber = 0
    public column = 0
    equal(baseInfo: BaseInfo) {
        return equal(baseInfo, this)
    }

    biggerThan(baseInfo: BaseInfo): boolean {
        if (this.y > baseInfo.y)
            return true
        if (this.y === baseInfo.y && this.x > baseInfo.x)
            return true
        return false
    }
}

export class CursorInfo extends BaseInfo {
    public height = 0
    updateFromBaseInfo(baseInfo: BaseInfo): void {
        this.x = baseInfo.x
        this.y = baseInfo.y
        this.lineNumber = baseInfo.lineNumber
        this.column = baseInfo.column
    }
}
