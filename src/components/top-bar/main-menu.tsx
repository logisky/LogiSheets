import styles from './main-menu.module.scss'
import {useTranslation} from 'react-i18next'
import {SelectComponent} from '@/ui/select'

export interface MainMenuProps {
    readonly currType: MainMenuType
    readonly mainMenuChanged$: (type: MainMenuType) => void
}
export enum MainMenuType {
    START,
    FILE,
    VIEW,
    CRAFT,
}
export interface MainMenuBtn {
    readonly text: string
    readonly type: MainMenuType
}
type OptionType = {value: string; label: string}
export const MainMenu = ({currType, mainMenuChanged$}: MainMenuProps) => {
    const [t, i18n] = useTranslation()
    const btns: readonly MainMenuBtn[] = [
        {
            text: 'topBar.mainMenu.file',
            type: MainMenuType.FILE,
        },
        {
            text: 'topBar.mainMenu.start',
            type: MainMenuType.START,
        },
        {
            text: 'topBar.mainMenu.view',
            type: MainMenuType.VIEW,
        },
        {
            text: 'topBar.mainMenu.craft',
            type: MainMenuType.CRAFT,
        },
    ]
    const onChangeLocale = (newValue: unknown) => {
        if (newValue === null || typeof newValue !== 'object') return
        const lang = newValue as OptionType
        i18n.changeLanguage(lang.value)
    }
    const options: readonly OptionType[] = [
        {value: 'cn', label: '中文'},
        {value: 'en', label: 'English'},
    ]
    return (
        <div className={styles.host}>
            {btns.map((btn, index) => (
                <div
                    style={{
                        padding: '0 10px',
                        borderRadius: '2px',
                        fontSize: '12px',
                        marginLeft: index === 0 ? 0 : '8px',
                    }}
                    className={
                        btn.type === currType ? styles.active : styles.inactive
                    }
                    onClick={() => mainMenuChanged$(btn.type)}
                    key={index}
                >
                    {t(btn.text)}
                </div>
            ))}
            <div
                style={{
                    position: 'absolute',
                    right: 0,
                }}
            >
                <SelectComponent
                    options={options}
                    isMulti={false}
                    defaultValue={options.find(
                        (o) => o.value === i18n.language
                    )}
                    onChange={onChangeLocale}
                />
            </div>
        </div>
    )
}
