import { RowInfo } from 'bindings'
import { shallowCopy, ptToPx } from 'common'
import { SETTINGS } from 'common/settings'
export class StandardRowInfo implements RowInfo {
    constructor(
        public readonly idx: number,
    ) {}
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
