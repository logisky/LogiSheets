import {RowInfo} from 'logisheets-web'
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
        return ptToPx(this.height)
    }

    static from(rowInfo: RowInfo) {
        const rInfo = new StandardRowInfo(rowInfo.idx)
        shallowCopy(rowInfo, rInfo)
        return rInfo
    }
}
