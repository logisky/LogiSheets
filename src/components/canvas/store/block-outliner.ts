import {action, makeObservable, observable} from 'mobx'
import {Range} from '@/core/standable'
import {CanvasStore} from './store'
import {BlockDisplayInfo} from 'packages/web/'
import {BlockOutlinerProps} from '@/components/block-outliner'
import {ptToPx, widthToPx} from '@/core'

export class BlockOutliner {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    blockInfos: readonly BlockDisplayInfo[] = []

    @action
    updateBlockInfos() {
        const data = this.store.getCurrentCellView()
        this.blockInfos = data.blocks
        this.props = this.blockInfos.map((info) => {
            const props = new BlockOutlinerProps()
            const range = this.store.convertToMainCanvasPosition(
                new Range()
                    .setStartRow(ptToPx(info.startPosition.y))
                    .setEndRow(ptToPx(info.endPosition.y))
                    .setStartCol(widthToPx(info.startPosition.x))
                    .setEndCol(widthToPx(info.endPosition.x)),
                'Cell'
            )
            props.x = range.startCol
            props.y = range.startRow
            props.width = range.width
            props.height = range.height
            props.blockId = info.info.blockId
            props.sheetId = info.info.sheetId
            return props
        })
    }

    @observable
    props: BlockOutlinerProps[] = []
}
