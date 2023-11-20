import {RowInfo} from '@logisheets_bg'
import {shallowCopy, ptToPx} from '@/core'
import {SETTINGS} from '@/core/settings'
export class StandardRowInfo implements RowInfo {
    constructor(public readonly idx: number) {}
    height = SETTINGS.defaultCellSize.height
    hidden = false
    get pt() {
        return this.height
    }

    get px() {
        return parseFloat(ptToPx(this.height).toFixed(2))
    }

    static from(rowInfo: RowInfo) {
        const rInfo = new StandardRowInfo(rowInfo.idx)
        shallowCopy(rowInfo, rInfo)
        return rInfo
    }
}
