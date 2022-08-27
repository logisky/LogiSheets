import {SetAttrEvent} from './content'
import {SelectedCell} from '@/components/canvas'
import {MainMenuType, MainMenu} from './main-menu'
import {useState, ReactElement, useEffect} from 'react'
import styles from './top-bar.module.scss'
import {FileComponent} from './file'
import {StartComponent} from './content'

export interface TopBarProps {
    readonly selectedCell?: SelectedCell
    readonly setAttr?: (e: SetAttrEvent) => void
}

export const TopBar = ({selectedCell}: TopBarProps) => {
    const [mainMenuType, setMainMenuType] = useState(MainMenuType.START)
    const [menuContent, setMenuContent] = useState<ReactElement | null>()
    useEffect(() => {
        let content: ReactElement | null = null
        switch (mainMenuType) {
            case MainMenuType.START:
                content = (
                    <StartComponent
                        selectedCell={selectedCell}
                    ></StartComponent>
                )
                break
            case MainMenuType.FILE:
                content = <FileComponent></FileComponent>
                break
            default:
        }
        setMenuContent(content)
    }, [mainMenuType])

    return (
        <div className={styles['host']}>
            <MainMenu
                currType={mainMenuType}
                mainMenuChanged$={setMainMenuType}
            ></MainMenu>
            {menuContent}
        </div>
    )
}
