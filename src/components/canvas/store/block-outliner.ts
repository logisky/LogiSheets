import {action, makeObservable, observable} from 'mobx'
import {Range} from '@/core/standable'
import {CanvasStore} from './store'
import {BlockDisplayInfo} from 'packages/web/'
import {BlockOutlinerProps} from '@/components/block-outliner'

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
            const range = this.store.convertToCanvasPosition(
                new Range()
                    .setStartRow(info.startPosition.y)
                    .setEndRow(info.endPosition.y)
                    .setStartCol(info.startPosition.x)
                    .setEndCol(info.endPosition.x),
                'Cell'
            )
            props.x = range.startCol
            props.y = range.startRow
            props.width = range.width
            props.height = range.height
            return props
        })
    }

    @observable
    props: BlockOutlinerProps[] = []
}
