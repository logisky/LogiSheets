import {getSelectedCellRange, SelectedData} from '@/components/canvas'
import {DataService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {ToggleButton} from '@mui/material'
import {CreateBlockBuilder, isErrorMessage, Transaction} from 'logisheets-web'

export interface BlockProps {
    readonly selectedData?: SelectedData
}

export const BlockComponent = ({selectedData}: BlockProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const createBlock = async () => {
        if (!selectedData) return
        const cellRange = getSelectedCellRange(selectedData)
        if (!cellRange) return
        const sheetIdx = DATA_SERVICE.getCurrentSheetIdx()
        const availableBlockId = await DATA_SERVICE.getAvailableBlockId(
            sheetIdx
        )
        if (isErrorMessage(availableBlockId)) return
        const payload = new CreateBlockBuilder()
            .blockId(availableBlockId)
            .sheetIdx(sheetIdx)
            .masterRow(cellRange.startRow)
            .rowCnt(cellRange.endRow - cellRange.startRow + 1)
            .masterCol(cellRange.startCol)
            .colCnt(cellRange.endCol - cellRange.startCol + 1)
            .build()
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
        console.log('????create block')
    }

    return (
        <div>
            <ToggleButton
                value="create-block"
                size="small"
                aria-label="create block"
                onClick={createBlock}
            >
                Create A Block
            </ToggleButton>
        </div>
    )
}
