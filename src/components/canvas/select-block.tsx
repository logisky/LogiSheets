import {StandardBlock} from '@/core/standable'
import {SelectionModel} from '@/core/selection'

export interface SelectBlockProps {
    readonly message: string
    readonly blocks: readonly StandardBlock[]
    readonly close$: (blocks: readonly StandardBlock[]) => void
}
export const SelectBlockComponent = (props: SelectBlockProps) => {
    const {message, blocks, close$} = props
    const selectionModel = new SelectionModel<StandardBlock>(false)
    return (
        <div>
            <h2>{message}</h2>
            <div
                className="content"
                style={{display: 'flex', flexDirection: 'column'}}
            >
                {blocks.length > 1
                    ? blocks.map((block, i) => (
                          <input
                              type="checkbox"
                              key={i}
                              onChange={() => selectionModel.toggle(block)}
                          >
                              block{i}
                          </input>
                      ))
                    : null}
            </div>
            <div className="actions">
                <button onClick={() => close$([])}>取消</button>
                <button onClick={() => close$(selectionModel.selected)}>
                    确认
                </button>
            </div>
        </div>
    )
}
