import {SetAttrEvent} from './content'
import {SelectedData} from '@/components/canvas'
import {MainMenuType, MainMenu} from './main-menu'
import {useState, ReactElement, useEffect} from 'react'
import styles from './top-bar.module.scss'
import {FileComponent} from './file'
import {StartComponent} from './content'
import {ViewComponent} from './view'
import {BlockComponent} from './block'

export interface TopBarProps {
    readonly selectedData?: SelectedData
    readonly setAttr?: (e: SetAttrEvent) => void
    readonly isBlockViewVisible: boolean
    readonly setBlockViewVisible: (visible: boolean) => void
}

export const TopBar = ({
    selectedData,
    isBlockViewVisible,
    setBlockViewVisible,
}: TopBarProps) => {
    const [mainMenuType, setMainMenuType] = useState(MainMenuType.START)
    const [menuContent, setMenuContent] = useState<ReactElement | null>()
    useEffect(() => {
        let content: ReactElement | null = null
        switch (mainMenuType) {
            case MainMenuType.START:
                content = <StartComponent selectedData={selectedData} />
                break
            case MainMenuType.FILE:
                content = <FileComponent />
                break
            case MainMenuType.CRAFT:
                content = <BlockComponent selectedData={selectedData} />
                break
            case MainMenuType.VIEW:
                content = (
                    <ViewComponent
                        selectedData={selectedData}
                        isBlockViewVisible={isBlockViewVisible}
                        setBlockViewVisible={setBlockViewVisible}
                    />
                )
                break
            default:
        }
        setMenuContent(content)
    }, [mainMenuType, selectedData])

    return (
        <div className={styles['host']}>
            <MainMenu
                currType={mainMenuType}
                mainMenuChanged$={setMainMenuType}
            />
            {menuContent}
        </div>
    )
}
