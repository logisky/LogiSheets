import {makeObservable, observable, action} from 'mobx'
import {Range} from '@/core/standable'
import {CanvasStore} from './store'
import {DiyButtonProps} from '@/components/diy-button'

export class DiyButton {
    constructor(public readonly store: CanvasStore) {
        makeObservable(this)
    }

    @action
    mousedown(): boolean {
        const startCell = this.store.startCell
        if (startCell === undefined) return false
        if (startCell.type !== 'Cell' || !this.store.same) {
            return false
        }
        if (startCell.info?.diyCellId === undefined) return false
        this.store.craftManager.onDiyCellClick(startCell.info.diyCellId)
        return true
    }

    @action
    updateDiyButton() {
        // const data = this.store.getCurrentCellView()
        // const cells = data.cells.filter((c) => c.info?.diyCellId !== undefined)
        // this.props = cells.map((c) => {
        //     const props = new DiyButtonProps()
        //     const range = this.store.convertToMainCanvasPosition(
        //         new Range()
        //             .setStartRow(c.position.startRow)
        //             .setEndRow(c.position.endRow)
        //             .setStartCol(c.position.startCol)
        //             .setEndCol(c.position.endCol),
        //         'Cell'
        //     )
        //     props.x = range.startCol
        //     props.y = range.startRow
        //     props.width = range.width
        //     props.height = range.height
        //     props.diyCellId = c.info!.diyCellId as number
        //     return props
        // })
    }

    @observable
    props: DiyButtonProps[] = []
}
