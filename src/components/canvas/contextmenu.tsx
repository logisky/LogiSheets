import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl} from '@/core/data'
import {
    CellClearBuilder,
    Payload,
    Transaction,
    SelectedCellRange,
} from 'logisheets-web'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import FormatDialogContent, {
    type FormatDialogValue,
} from '@/components/format-dialog'
import {buildSelectedDataFromCellRange} from '@/components/canvas'
import {useState} from 'react'

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
    const [numFmtOpen, setNumFmtOpen] = useState(false)
    const [fmtValue, setFmtValue] = useState<FormatDialogValue>({})

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
        <>
            <Menu
                open={isOpen}
                onClose={() => setIsOpen(false)}
                anchorReference="anchorPosition"
                anchorPosition={{top, left}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                keepMounted
                MenuListProps={{autoFocusItem: false}}
                disableScrollLock={true}
                slotProps={{
                    paper: {
                        sx: {minWidth: 200, p: 0.5},
                    },
                    root: {
                        disableAutoFocus: true,
                        disableEnforceFocus: true,
                        disableRestoreFocus: true,
                    },
                }}
            >
                <MenuItem
                    onClick={() => {
                        // Close menu first, then open dialog to avoid focus/aria race
                        setIsOpen(false)
                        setTimeout(() => setNumFmtOpen(true), 0)
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

            <Dialog
                open={numFmtOpen}
                onClose={() => setNumFmtOpen(false)}
                maxWidth="md"
                fullWidth
                keepMounted
                disableScrollLock
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                container={document.body}
                PaperProps={{
                    sx: {zIndex: 2000, p: 0},
                }}
            >
                <FormatDialogContent
                    value={fmtValue}
                    selectedData={buildSelectedDataFromCellRange(
                        selectedCellRange.startRow,
                        selectedCellRange.startCol,
                        selectedCellRange.endRow,
                        selectedCellRange.endCol,
                        'none'
                    )}
                    onChange={(v) => setFmtValue(v)}
                    onCancel={() => setNumFmtOpen(false)}
                />
            </Dialog>
        </>
    )
}
