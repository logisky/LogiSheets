import {CraftManager} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {makeAutoObservable} from 'mobx'
import {observer} from 'mobx-react'

export class DiyButtonProps {
    constructor() {
        makeAutoObservable(this)
    }

    x = 0
    y = 0
    width = 0
    height = 0
    diyCellId = 0
}

export interface IDiyButtonProps {
    props: DiyButtonProps
}

export const DiyButtonComponent = observer((p: IDiyButtonProps) => {
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)

    const {props} = p
    const {x, y, width, height, diyCellId} = props
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
            onClick={() => CRAFT_MANAGER.onDiyCellClick(diyCellId)}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    border: 'solid rgba(230, 17, 17, 0.1)',
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    )
})
