
import styles from './main-menu.module.scss'
export interface MainMenuProps {
    readonly currType: MainMenuType
    readonly mainMenuChanged$: (type: MainMenuType) => void
}
export enum MainMenuType {
    START,
}
export interface MainMenuBtn {
    readonly text: string
    readonly type: MainMenuType
}
export const MainMenu = ({
    currType,
    mainMenuChanged$,
}: MainMenuProps) => {
    const btns: readonly MainMenuBtn[] = [
        {
            text: '开始',
            type: MainMenuType.START,
        },
    ]
    return (
        <div className={styles.host}>
            <div className={styles.menu}>
                {
                    btns.map((btn, index) =>
                        <div className={btn.type === currType ? styles.active : styles.inactive}
                            onClick={() => mainMenuChanged$(btn.type)}
                            key={index}
                        >{btn.text}</div>
                    )
                }
            </div>
        </div>
    )
}
