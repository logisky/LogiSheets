import {useState, FC, useEffect} from 'react'
import styles from './sheets-tab.module.scss'
import {ContextMenuComponent} from './contextmenu'
import {DeleteSheetBuilder, InsertSheetBuilder} from '@logisheets_bg'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {Tabs, Dropdown} from 'antd'
import {Subscription} from 'rxjs'
import {DataService} from '@/core/data2'

export type SheetsTabprops = Record<string, unknown>

export const SheetsTabComponent: FC<SheetsTabprops> = () => {
    const DATASERVICE = useInjection<DataService>(TYPES.Data)
    const getSheets = () => DATASERVICE.getSheets().map((s) => s.name)
    const [sheets, setSheets] = useState(getSheets())
    const [active, setActive] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const subs = new Subscription()
        subs.add(
            DATASERVICE.render$.subscribe(() => {
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
        SHEET_SERVICE.setActiveSheet(i)
    }

    const add = () => {
        const payload = new InsertSheetBuilder().sheetIdx(active).build()
        DATASERVICE.sendTransaction([payload])
    }

    const onDelete = (i: number) => {
        const payload = new DeleteSheetBuilder().sheetIdx(i).build()
        DATASERVICE.sendTransaction([payload])
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
                        DATASERVICE.sendTransaction([payload])
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
