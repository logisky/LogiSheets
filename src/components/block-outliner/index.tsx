import {makeAutoObservable} from 'mobx'
import {observer} from 'mobx-react'
export class BlockOutlinerProps {
    constructor() {
        makeAutoObservable(this)
    }
    x = 0
    y = 0
    width = 0
    height = 0
}
export interface IBlockOutlinerProps {
    blockOutliner: BlockOutlinerProps
}

export const BlockOutlinerComponent = observer((props: IBlockOutlinerProps) => {
    const {blockOutliner} = props
    const {x, y, width, height} = blockOutliner
    return (
        <div
            style={{
                display: 'flex',
                position: 'absolute',
                width: `${width}px`,
                height: `${height}px`,
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    border: 'solid rgba(31, 187, 125, 0.1)',
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    )
})
