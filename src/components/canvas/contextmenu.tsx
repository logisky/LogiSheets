import {SelectedCellRange} from './events'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl} from '@/core/data'
import {CellClearBuilder, Payload, Transaction} from 'logisheets-web'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'

export interface ContextmenuProps {
    selectedCellRange: SelectedCellRange
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
    left: number
    top: number
}

export const ContextmenuComponent = (props: ContextmenuProps) => {
    const {isOpen, setIsOpen, selectedCellRange, left, top} = props

    const selectedCount =
        (Math.abs(selectedCellRange.endRow - selectedCellRange.startRow) + 1) *
        (Math.abs(selectedCellRange.endCol - selectedCellRange.startCol) + 1)
    const isMultiple = selectedCount > 1

    const dataSvc = useInjection<DataServiceImpl>(TYPES.Data)

    const clearCells = () => {
        const startRow = selectedCellRange.startRow
        const startCol = selectedCellRange.startCol
        const endRow = selectedCellRange.endRow
        const endCol = selectedCellRange.endCol

        const payloads: Payload[] = []
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const p = new CellClearBuilder()
                    .sheetIdx(dataSvc.getCurrentSheetIdx())
                    .row(r)
                    .col(c)
                    .build()
                payloads.push({
                    type: 'cellClear',
                    value: p,
                })
            }
        }
        dataSvc.handleTransaction(new Transaction(payloads, true))
    }

    return (
        <Menu
            open={isOpen}
            onClose={() => setIsOpen(false)}
            anchorReference="anchorPosition"
            anchorPosition={{top, left}}
            transformOrigin={{vertical: 'top', horizontal: 'left'}}
            disablePortal
            keepMounted
            MenuListProps={{autoFocusItem: false}}
            disableScrollLock={true}
            container={document.body}
            slotProps={{
                paper: {
                    sx: {minWidth: 200, p: 0.5},
                },
                root: {
                    // Modal props to avoid focus side effects
                    disableAutoFocus: true,
                    disableEnforceFocus: true,
                    disableRestoreFocus: true,
                },
            }}
        >
            <MenuItem
                onClick={async () => {
                    // TODO: open a format dialog or trigger formatting flow
                    setIsOpen(false)
                }}
            >
                {isMultiple ? 'Format Cells' : 'Format Cell'}
            </MenuItem>
            <Divider />
            <MenuItem
                onClick={async () => {
                    clearCells()
                    setIsOpen(false)
                }}
            >
                {isMultiple ? 'Clear Cells' : 'Clear Cell'}
            </MenuItem>
        </Menu>
    )
}
