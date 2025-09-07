import {makeAutoObservable} from 'mobx'
import {observer} from 'mobx-react'
import {ZINDEX_BLOCK_OUTLINER} from '../const'

export class ShadowCellProps {
    constructor() {
        makeAutoObservable(this)
    }
    x = 0
    y = 0
    width = 0
    height = 0
}

export interface IShadowCellProps {
    shadowCell: ShadowCellProps
}

export const ShadowCellComponent = observer((props: IShadowCellProps) => {
    const {shadowCell} = props
    return (
        <div
            style={{
                position: 'absolute',
                left: `${shadowCell.x}px`,
                top: `${shadowCell.y}px`,
                width: `${shadowCell.width}px`,
                height: `${shadowCell.height}px`,
                background: 'rgba(255,0,0,0.2)',
                pointerEvents: 'none',
                zIndex: ZINDEX_BLOCK_OUTLINER,
            }}
        />
    )
})
