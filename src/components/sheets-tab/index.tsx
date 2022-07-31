import { useState, FC, useEffect } from 'react'
import styles from './sheets-tab.module.scss'
import {ContextMenuComponent} from './contextmenu'
import {InsertSheetBuilder} from '@/api'
import { Backend, SheetService } from '@/core/data'
import { useInjection } from '@/core/ioc/provider'
import { TYPES } from '@/core/ioc/types'
import { Subscription } from 'rxjs'

export type SheetsTabprops = Record<string, unknown>

export const SheetsTabComponent: FC<SheetsTabprops> = () => {
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
    const SHEET_SERVICE = useInjection<SheetService>(TYPES.Sheet)
    const getSheets = () =>
        SHEET_SERVICE.getSheets().map(s => s.name)
    const [sheets, setSheets] = useState(getSheets())
    const [active, setActive] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const subs = new Subscription()
        subs.add(BACKEND_SERVICE.render$.subscribe(() => {
            setSheets(getSheets())
        }))
        return () => {
            subs.unsubscribe()
        }
    }, [])

    const onTabChange = (i: number) => {
        setActive(i)
        SHEET_SERVICE.setActiveSheet(i)
    }

    const add = () => {
        const payload = new InsertSheetBuilder()
            .sheetIdx(active)
            .build()
        BACKEND_SERVICE.sendTransaction([payload])
    }
    return (
        <div className={styles['host']}>
            <div className={styles['pre-btns']}></div>
            {sheets.map((sheet, i) => (
                <div className={['tab', `${i === active ? 'active' : ''}`].join(' ')}
                    onClick={() => onTabChange(i)}
                    onContextMenu={() => setIsOpen(true)}
                    key={i}
                >{sheet}</div>))
            }
            <div className={styles['add-btn']} onClick={add}>+</div>
            <ContextMenuComponent
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                index={active}
                sheetnames={sheets}
            ></ContextMenuComponent>
        </div>
    )
}
