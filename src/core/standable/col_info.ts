import {ColInfo} from 'logisheets-web'
import {findMdwColw, shallowCopy, width2px} from '@/core'
import {SETTINGS} from '@/core/settings'
export class StandardColInfo implements ColInfo {
    constructor(public readonly idx: number) {}
    hidden = false
    width = SETTINGS.defaultCellSize.width
    get px() {
        findMdwColw(this.width)
        return parseFloat(width2px(this.width).toFixed(1))
    }

    get pt() {
        return this.width
    }

    static from(colInfo: ColInfo) {
        const cInfo = new StandardColInfo(colInfo.idx)
        shallowCopy(colInfo, cInfo)
        return cInfo
    }
}
