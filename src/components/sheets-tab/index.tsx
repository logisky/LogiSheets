import {useState, FC, useEffect} from 'react'
import styles from './sheets-tab.module.scss'
import {ContextMenuComponent} from './contextmenu'
import {
    DeleteSheetBuilder,
    CreateSheetBuilder,
    isErrorMessage,
    Payload,
    Transaction,
} from 'logisheets-web'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {Tabs} from 'antd'
import {Subscription} from 'rxjs'
import {DataService} from '@/core/data'

export interface SheetTabProps {
    activeSheet: number
    activeSheet$: (s: number) => void
}

export const SheetsTabComponent: FC<SheetTabProps> = ({
    activeSheet,
    activeSheet$,
}) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const getSheets = () => {
        const sheetInfo = DATA_SERVICE.getAllSheetInfo().then((info) => {
            if (!isErrorMessage(info)) return info.map((s) => s.name)
        })
        return sheetInfo
    }
    const [sheets, setSheets] = useState([] as string[])
    const [isOpen, setIsOpen] = useState(false)
    const [modalPosition, setModalPosition] = useState({top: 0, left: 0})

    useEffect(() => {
        getSheets().then((v) => {
            if (v) setSheets(v)
        })
    }, [])

    useEffect(() => {
        const subs = new Subscription()
        subs.add(
            DATA_SERVICE.registrySheetUpdatedCallback(() => {
                getSheets().then((v) => {
                    if (v) setSheets(v)
                })
            })
        )
        return () => {
            subs.unsubscribe()
        }
    }, [])

    const onTabChange = (key: string) => {
        const i = sheets.findIndex((s) => s === key)
        activeSheet$(i)
    }

    const onDelete = (i: number) => {
        const payload = new DeleteSheetBuilder().idx(i).build() as Payload
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }
    return (
        <div className={styles['host']}>
            <div className={styles['pre-btns']} />
            <Tabs
                type="editable-card"
                tabPosition="bottom"
                items={sheets.map((sheet, i) => ({
                    key: sheet,
                    label: (
                        <span
                            onContextMenu={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                activeSheet$(i)
                                setIsOpen(true)
                                setModalPosition({
                                    top: e.clientY,
                                    left: e.clientX,
                                })
                            }}
                        >
                            {sheet}
                        </span>
                    ),
                    closable: true,
                }))}
                onChange={onTabChange}
                onEdit={(e, action) => {
                    if (action === 'add') {
                        const newSheetName = findNewSheetName(sheets)
                        const newIdx = sheets.length
                        const payload = new CreateSheetBuilder()
                            .newName(newSheetName)
                            .idx(newIdx)
                            .build() as Payload
                        DATA_SERVICE.handleTransaction(
                            new Transaction([payload], true)
                        ).then((v) => {
                            if (v) return
                            activeSheet$(newIdx)
                        })
                    } else if (action === 'remove') {
                        if (typeof e !== 'string') return
                        const i = sheets.findIndex((s) => s === e)
                        onDelete(i)
                    }
                }}
                activeKey={sheets[activeSheet]}
            />
            <ContextMenuComponent
                left={modalPosition.left}
                top={modalPosition.top}
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                index={activeSheet}
                sheetnames={sheets}
            />
        </div>
    )
}

function findNewSheetName(sheetNames: readonly string[]): string {
    const sheetPattern = /^Sheet(\d+)$/

    const numbers = sheetNames
        .map((name) => {
            const match = name.match(sheetPattern)
            return match ? parseInt(match[1], 10) : null
        })
        .filter((num): num is number => num !== null)

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1

    return `Sheet${nextNumber}`
}
