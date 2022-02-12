import {SetAttrEvent} from './content'
import {SelectedCell} from 'components/canvas'
import {MainMenuType, MainMenu} from './main-menu'
import { useState } from 'react'
import styles from './top-bar.module.scss'
import {Start} from './content'

export interface TopBarProps {
    readonly selectedCell?: SelectedCell
    readonly setAttr?: (e: SetAttrEvent) => void
}

export const TopBar = ({selectedCell, setAttr}: TopBarProps) => {
    const [mainMenuType, setMainMenuType] = useState(MainMenuType.START)
    return (
        <div className={styles['host']}>
            <div className={styles['main-menu']}>
                <MainMenu currType={mainMenuType} mainMenuChanged$={setMainMenuType}></MainMenu>
            </div>
            <div className={styles["content"]}>
                <div className={styles['top-bar-start']}>
                    {
                        mainMenuType === MainMenuType.START ?
                            <Start selectedCell={selectedCell}></Start>
                        : null
                    }
                </div>
            </div>
        </div>
    )
}
