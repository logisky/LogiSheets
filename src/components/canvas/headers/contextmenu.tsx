import React from 'react'
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

    const doTxn = (payloads: Payload[]) => {
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true))
        onClose()
    }

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

    return (
        <Menu
            open={open}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={{top: y, left: x}}
            transformOrigin={{vertical: 'top', horizontal: 'left'}}
            disableScrollLock={true}
            MenuListProps={{autoFocusItem: false}}
            slotProps={{
                paper: {
                    sx: {
                        minWidth: 160,
                        p: 0.5,
                    },
                },
            }}
        >
            <MenuItem onClick={insertBefore}>
                {type === 'row' ? '在上方插入行' : '在左侧插入列'}
            </MenuItem>
            <MenuItem onClick={insertAfter}>
                {type === 'row' ? '在下方插入行' : '在右侧插入列'}
            </MenuItem>
            <Divider />
            <MenuItem onClick={removeOne} sx={{color: 'error.main'}}>
                {type === 'row' ? '删除行' : '删除列'}
            </MenuItem>
        </Menu>
    )
}

export default HeaderContextMenu
