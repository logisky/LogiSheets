import {getSelectedCellRange, SelectedData} from '@/components/canvas'
import {ToggleButton} from '@mui/material'
import {CraftManager, DataServiceImpl} from '@/core/data'
import {
    Transaction,
    CreateDiyCellBuilder,
    isErrorMessage,
    Payload,
} from 'logisheets-web'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DiyCellButtonType} from 'logisheets-craft-forge'

export interface CreateDiyBtnProps {
    readonly selectedData?: SelectedData
}

export const CreateDiyBtnComponent = ({selectedData}: CreateDiyBtnProps) => {
    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const createDiyCell = async () => {
        if (!selectedData) return
        const cellRange = getSelectedCellRange(selectedData)
        if (!cellRange) return
        if (
            cellRange.startRow != cellRange.endRow ||
            cellRange.startCol != cellRange.endCol
        ) {
            return
        }

        const info = await DATA_SERVICE.getCellInfo(
            DATA_SERVICE.getCurrentSheetIdx(),
            cellRange.startRow,
            cellRange.startCol
        )
        if (isErrorMessage(info)) return
        const blockId = info.getBlockId()
        if (!blockId) return
        const payload = new CreateDiyCellBuilder()
            .sheetIdx(DATA_SERVICE.getCurrentSheetIdx())
            .row(cellRange.startRow)
            .col(cellRange.startCol)
            .build() as Payload
        await DATA_SERVICE.handleTransaction(new Transaction([payload], true))
        const sheetId = await DATA_SERVICE.getSheetId(
            DATA_SERVICE.getCurrentSheetIdx()
        )
        if (isErrorMessage(sheetId)) return
        CRAFT_MANAGER.registerDiyButton(blockId, {
            type: DiyCellButtonType.Upload,
        })
    }

    return (
        <ToggleButton
            value="create-diy-cell"
            size="small"
            aria-label="create-diy-cell"
            onClick={createDiyCell}
        >
            Create A DiyButton
        </ToggleButton>
    )
}
