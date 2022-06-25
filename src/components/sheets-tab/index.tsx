import {DATA_SERVICE} from '@/core/data'
import { useState } from 'react'
import styles from './sheets-tab.module.scss'
import {ContextMenuComponent} from './contextmenu'
import {InsertSheetBuilder} from '@/api'

export interface SheetsTabprops {

}

export const SheetsTabComponent = (props: SheetsTabprops) => {
    const {} = props
    const getSheets = () =>
        DATA_SERVICE.sheetSvc.getSheets().map(s => s.name)
    const [sheets, setSheets] = useState(getSheets())
    const [active, setActive] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    DATA_SERVICE.backend.render$.subscribe(() => {
        setSheets(getSheets())
    })

    const onTabChange = (i: number) => {
        setActive(i)
        DATA_SERVICE.sheetSvc.setActiveSheet(i)
    }

    const add = () => {
        const payload = new InsertSheetBuilder()
            .sheetIdx(active)
            .build()
        DATA_SERVICE.backend.sendTransaction([payload])
    }
    return (
        <div className={styles["host"]}>
            <div className={styles["pre-btns"]}></div>
            {sheets.map((sheet, i) => (
                <div className={['tab', `${i === active ? 'active' : ''}`].join(' ')}
                    onClick={() => onTabChange(i)}
                    onContextMenu={() => setIsOpen(true)}
                    key={i}
                >{sheet}</div>))
            }
            <div className={styles["add-btn"]} onClick={add}>+</div>
            <ContextMenuComponent
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                index={active}
                sheetnames={sheets}
            ></ContextMenuComponent>
        </div>
    )
}
