import {useState, FC, useEffect} from 'react'
import styles from './sheets-tab.module.scss'
import {ContextMenuComponent} from './contextmenu'
import {
    DeleteSheetBuilder,
    InsertSheetBuilder,
    Transaction,
} from 'logisheets-web'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {Tabs} from 'antd'
import {Subscription} from 'rxjs'
import {DataService} from '@/core/data2'

export type SheetsTabprops = Record<string, unknown>

export const SheetsTabComponent: FC<SheetsTabprops> = () => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const getSheets = () => DATA_SERVICE.getAllSheetInfo().map((s) => s.name)
    const [sheets, setSheets] = useState(getSheets())
    const [active, setActive] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const subs = new Subscription()
        subs.add(
            DATA_SERVICE.registrySheetUpdatedCallback(() => {
                setSheets(getSheets())
            })
        )
        return () => {
            subs.unsubscribe()
        }
    }, [])

    const onTabChange = (key: string) => {
        const i = sheets.findIndex((s) => s === key)
        setActive(i)
        DATA_SERVICE.setCurrentSheetIDx(i)
    }

    const add = () => {
        const payload = new InsertSheetBuilder().sheetIdx(active).build()
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    const onDelete = (i: number) => {
        const payload = new DeleteSheetBuilder().sheetIdx(i).build()
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
                                setActive(i)
                                setIsOpen(true)
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
                        const payload = new InsertSheetBuilder()
                            .sheetIdx(sheets.length)
                            .build()
                        DATA_SERVICE.handleTransaction(
                            new Transaction([payload], true)
                        )
                    } else if (action === 'remove') {
                        if (typeof e !== 'string') return
                        const i = sheets.findIndex((s) => s === e)
                        onDelete(i)
                    }
                }}
                activeKey={sheets[active]}
            />
            <ContextMenuComponent
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                index={active}
                sheetnames={sheets}
            />
        </div>
    )
}
