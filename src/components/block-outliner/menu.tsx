import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import styles from './block-outliner.module.scss'
import React, {useContext} from 'react'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {CraftManager, DataService} from '@/core/data'
import {isErrorMessage, RemoveBlockBuilder, Transaction} from 'packages/web'
import {CanvasStoreContext} from '../canvas/store'

export interface MenuProps {
    readonly sheetId: number
    readonly blockId: number
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
    readonly clickMousePosition: {x: number; y: number}
    readonly setDescriptorUrl: (url: string | undefined) => void
    readonly setError: (error: string | undefined) => void
    readonly setSuccessMessage: (message: string | undefined) => void
}

export interface ClickableListProps {
    items: {label: React.ReactNode; onClick: () => void}[]
    style?: React.CSSProperties
    className?: string
}

export const ClickableList = ({
    items,
    style,
    className,
}: ClickableListProps) => {
    return (
        <div className={className} style={style}>
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={styles['context-menu-item']}
                    onClick={item.onClick}
                    tabIndex={0}
                    style={{cursor: 'pointer'}}
                >
                    {item.label}
                </div>
            ))}
        </div>
    )
}

export const MenuComponent = (props: MenuProps) => {
    const {sheetId, blockId, isOpen, setIsOpen} = props
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const descriptor = CRAFT_MANAGER.getCraftDescriptor([sheetId, blockId])

    const store = useContext(CanvasStoreContext)

    const setDescriptorUrl = props.setDescriptorUrl
    const setError = props.setError
    const setSuccessMessage = props.setSuccessMessage

    if (descriptor.isErr()) {
        throw Error('Failed to get craft descriptor')
    }
    const items = [
        {
            label: 'Modify',
            onClick: () => {
                // todo
            },
        },
        {
            label: 'Delete',
            onClick: () => {
                DATA_SERVICE.handleTransaction(
                    new Transaction(
                        [
                            {
                                type: 'removeBlock',
                                value: new RemoveBlockBuilder()
                                    .sheetIdx(DATA_SERVICE.getCurrentSheetIdx())
                                    .id(blockId)
                                    .build(),
                            },
                        ],
                        true
                    )
                )
            },
        },
        {
            label: 'Validate',
            onClick: async () => {
                const valueChangedCallback = async (shadowId: number) => {
                    const wb = DATA_SERVICE.getWorkbook()
                    const shadowInfo = await wb.getShadowInfoById({
                        shadowId: shadowId,
                    })
                    if (isErrorMessage(shadowInfo)) {
                        setError(shadowInfo.msg)
                        return
                    }

                    const value = shadowInfo.value
                    let result = false
                    if (value === 'empty') {
                        result = false
                    } else if (value.type === 'bool') {
                        result = value.value
                    } else if (value.type === 'error') {
                        result = false
                    } else {
                        result = true
                    }

                    if (!result) {
                        store.cellValidation.addInvalidCell(
                            sheetId,
                            {type: 'ephemeralCell', value: shadowId},
                            shadowInfo.startPosition,
                            shadowInfo.endPosition
                        )
                    } else {
                        store.cellValidation.removeInvalidCell(sheetId, {
                            type: 'ephemeralCell',
                            value: shadowId,
                        })
                    }
                }
                const cellRemovedCallback = async (shadowId: number) => {
                    store.cellValidation.removeInvalidCell(sheetId, {
                        type: 'ephemeralCell',
                        value: shadowId,
                    })
                }
                CRAFT_MANAGER.setValidationRules(
                    [sheetId, blockId],
                    valueChangedCallback,
                    cellRemovedCallback
                )
            },
        },
        {
            label: 'Export the descriptor',
            onClick: async () => {
                const url = await CRAFT_MANAGER.uploadCraftDescriptor([
                    sheetId,
                    blockId,
                ])
                if (url.isOk()) {
                    setDescriptorUrl(url._unsafeUnwrap())
                    setError(undefined)
                } else {
                    setDescriptorUrl(undefined)
                    setError('Failed to generate export URL')
                }
            },
        },
        {
            label: 'Export the data',
            onClick: async () => {
                const result = await CRAFT_MANAGER.uploadCraftData([
                    sheetId,
                    blockId,
                ])
                if (result.isOk()) {
                    setError(undefined)
                    setDescriptorUrl(undefined)
                    setSuccessMessage('Data exported successfully')
                } else {
                    setError('Failed to upload data')
                    setDescriptorUrl(undefined)
                    setSuccessMessage(undefined)
                }
            },
        },
        {
            label: 'Import the data',
            onClick: async () => {
                const dlResult = await CRAFT_MANAGER.downloadCraftData([
                    sheetId,
                    blockId,
                ])
                if (!dlResult.isOk()) {
                    setError('Failed to import data')
                    setDescriptorUrl(undefined)
                    setSuccessMessage(undefined)
                    return
                }

                const payloads = dlResult._unsafeUnwrap()
                const result = await DATA_SERVICE.handleTransaction(
                    new Transaction(payloads, true)
                )
                if (isErrorMessage(result)) {
                    setError(result.msg)
                    setDescriptorUrl(undefined)
                    setSuccessMessage(undefined)
                    return
                }

                setError(undefined)
                setDescriptorUrl(undefined)
                setSuccessMessage('Data imported successfully')
            },
        },
    ]

    return (
        <>
            <Menu
                open={isOpen}
                onClose={() => setIsOpen(false)}
                anchorReference="anchorPosition"
                anchorPosition={{
                    top: props.clickMousePosition.y,
                    left: props.clickMousePosition.x,
                }}
                disableRestoreFocus={true}
            >
                {items.map((item, idx) => (
                    <MenuItem
                        key={idx}
                        onClick={(e) => {
                            e.stopPropagation()
                            item.onClick()
                            setIsOpen(false)
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation()
                        }}
                    >
                        {item.label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    )
}
