import React, {useEffect} from 'react'
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

export interface HeaderContextMenuProps {
    open: boolean
    x: number
    y: number
    type: 'row' | 'col'
    index: number
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
    onClose,
}) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null

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
                        .count(1)
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
                        .count(1)
                        .build(),
                },
            ])
        }
    }

    const menuStyle: React.CSSProperties = {
        position: 'fixed',
        left: x,
        top: y,
        background: '#fff',
        border: '1px solid #ddd',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        borderRadius: 4,
        zIndex: 1001,
        padding: 4,
        minWidth: 160,
    }
    const backdropStyle: React.CSSProperties = {
        position: 'fixed',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        background: 'transparent',
        zIndex: 1000,
    }
    const itemStyle: React.CSSProperties = {
        padding: '6px 10px',
        cursor: 'pointer',
        userSelect: 'none',
    }

    return (
        <>
            <div
                style={backdropStyle}
                onClick={onClose}
                onContextMenu={(e) => e.preventDefault()}
            />
            <div style={menuStyle} onContextMenu={(e) => e.preventDefault()}>
                <div style={itemStyle} onClick={insertBefore}>
                    {type === 'row' ? '在上方插入行' : '在左侧插入列'}
                </div>
                <div style={itemStyle} onClick={insertAfter}>
                    {type === 'row' ? '在下方插入行' : '在右侧插入列'}
                </div>
                <div
                    style={{...itemStyle, color: '#d32f2f'}}
                    onClick={removeOne}
                >
                    {type === 'row' ? '删除行' : '删除列'}
                </div>
            </div>
        </>
    )
}

export default HeaderContextMenu
