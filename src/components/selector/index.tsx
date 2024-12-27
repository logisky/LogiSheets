import {makeAutoObservable} from 'mobx'
import {observer} from 'mobx-react'
export class SelectorProps {
    constructor() {
        makeAutoObservable(this)
    }
    editing? = false
    x = 0
    y = 0
    width = 0
    height = 0
    borderRightWidth = 0
    borderLeftWidth = 0
    borderTopWidth = 0
    borderBottomWidth = 0
}
export interface ISelectorProps {
    selector: SelectorProps
    keydown$?: (e: KeyboardEvent) => void
}
export const SelectorComponent = observer((props: ISelectorProps) => {
    const {selector} = props
    const {
        editing,
        x,
        y,
        width,
        height,
        borderRightWidth,
        borderLeftWidth,
        borderTopWidth,
        borderBottomWidth,
    } = selector
    return (
        <div
            style={{
                display: editing ? 'flex' : '',
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
                    borderRightWidth: `${borderRightWidth}px`,
                    borderLeftWidth: `${borderLeftWidth}px`,
                    borderTopWidth: `${borderTopWidth}px`,
                    borderBottomWidth: `${borderBottomWidth}px`,
                }}
            />
        </div>
    )
})
