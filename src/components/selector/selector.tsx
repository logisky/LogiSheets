import { selectorStore } from './store'
import { observer, useLocalStore } from 'mobx-react'
export const SelectorComponent = observer(() => {
    const store = useLocalStore(() => selectorStore)
    const { startCell, endCell } = store
    if (!startCell) return null
    let _endCell = endCell ?? startCell
    const leftMost = startCell.position.startCol < _endCell.position.startCol ? startCell : _endCell
    const rightMost = startCell.position.startCol < _endCell.position.startCol ? _endCell : startCell
    const topMost = startCell.position.startRow < _endCell.position.startRow ? startCell : _endCell
    const bottomMost = startCell.position.endRow > _endCell.position.endRow ? startCell : _endCell
    return (
        <div
            className='selector'
            style={{
                position: 'absolute',
                width: `${rightMost.position.endCol - leftMost.position.startCol}px`,
                height: `${bottomMost.position.endRow - topMost.position.startRow}px`,
                left: `${leftMost.position.startCol}px`,
                top: `${topMost.position.startRow}px`,
                border: '2px solid rgba(31, 187, 125, 0.4)',
                boxSizing: 'content-box'
            }}
        >
        </div>
    )
})