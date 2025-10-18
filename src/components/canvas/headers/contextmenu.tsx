import React, {useEffect, useState} from 'react'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl as DataService} from '@/core/data'
import {
    Transaction,
    InsertRowsBuilder,
    DeleteRowsBuilder,
    InsertColsBuilder,
    DeleteColsBuilder,
    type Payload,
} from 'logisheets-web'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import FormatDialogContent, {
    type FormatDialogValue,
} from '@/components/format-dialog'
import {
    buildSelectedDataFromCellRange,
    buildSelectedDataFromLines,
} from '@/components/canvas'

export interface HeaderContextMenuProps {
    open: boolean
    x: number
    y: number
    type: 'row' | 'col'
    index: number
    count: number
    sheetIdx: number
    onClose: () => void
}

export const HeaderContextMenu: React.FC<HeaderContextMenuProps> = ({
    open,
    x,
    y,
    type,
    index,
    sheetIdx,
    count,
    onClose,
}) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const [fmtOpen, setFmtOpen] = useState(false)
    const [menuOpen, setMenuOpen] = useState(true)
    const [fmtValue, setFmtValue] = useState<FormatDialogValue>({})
    const [fmtSelectedData, setFmtSelectedData] = useState<ReturnType<
        typeof buildSelectedDataFromCellRange
    > | null>(null)

    const doTxn = (payloads: Payload[]) => {
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true))
        onClose()
    }

    useEffect(() => {
        if (!fmtOpen && !menuOpen) {
            onClose()
        }
    }, [menuOpen, fmtOpen])

    const insertBefore = () => {
        if (type === 'row') {
            doTxn([
                {
                    type: 'insertRows',
                    value: new InsertRowsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(index)
                        .count(1)
                        .build(),
                },
            ])
        } else {
            doTxn([
                {
                    type: 'insertCols',
                    value: new InsertColsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(index)
                        .count(1)
                        .build(),
                },
            ])
        }
    }

    const insertAfter = () => {
        if (type === 'row') {
            doTxn([
                {
                    type: 'insertRows',
                    value: new InsertRowsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(index + 1)
                        .count(1)
                        .build(),
                },
            ])
        } else {
            doTxn([
                {
                    type: 'insertCols',
                    value: new InsertColsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(index + 1)
                        .count(1)
                        .build(),
                },
            ])
        }
    }

    const removeOne = () => {
        if (type === 'row') {
            doTxn([
                {
                    type: 'deleteRows',
                    value: new DeleteRowsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(index)
                        .count(count)
                        .build(),
                },
            ])
        } else {
            doTxn([
                {
                    type: 'deleteCols',
                    value: new DeleteColsBuilder()
                        .sheetIdx(sheetIdx)
                        .start(index)
                        .count(count)
                        .build(),
                },
            ])
        }
    }

    const openFormatDialog = async () => {
        const start = index
        const end = index + count - 1
        const sd = buildSelectedDataFromLines(start, end, type, 'none')
        setFmtSelectedData(sd)
        setFmtOpen(true)
        setMenuOpen(false)
    }

    return (
        <>
            <Menu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchorReference="anchorPosition"
                anchorPosition={{top: y, left: x}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                disableScrollLock={true}
                MenuListProps={{autoFocusItem: false}}
                slotProps={{
                    paper: {
                        sx: {
                            minWidth: 180,
                            p: 0.5,
                        },
                    },
                }}
            >
                <MenuItem onClick={insertBefore}>
                    {type === 'row' ? 'Insert row above' : 'Insert column left'}
                </MenuItem>
                <MenuItem onClick={insertAfter}>
                    {type === 'row'
                        ? 'Insert row below'
                        : 'Insert column right'}
                </MenuItem>
                <MenuItem onClick={openFormatDialog}>Format cells</MenuItem>
                <Divider />
                <MenuItem onClick={removeOne} sx={{color: 'error.main'}}>
                    {type === 'row' ? 'Delete row(s)' : 'Delete column(s)'}
                </MenuItem>
            </Menu>

            <Dialog
                open={fmtOpen && !!fmtSelectedData}
                onClose={() => setFmtOpen(false)}
                maxWidth="md"
                fullWidth
                keepMounted
                disableScrollLock
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                container={document.body}
                PaperProps={{sx: {zIndex: 2000, p: 0}}}
            >
                {fmtSelectedData && (
                    <FormatDialogContent
                        value={fmtValue}
                        onChange={(v) => setFmtValue(v)}
                        onCancel={() => setFmtOpen(false)}
                        selectedData={fmtSelectedData}
                    />
                )}
            </Dialog>
        </>
    )
}

export default HeaderContextMenu
