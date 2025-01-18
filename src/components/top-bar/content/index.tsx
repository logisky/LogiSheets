import {getFirstCell, SelectedData} from '@/components/canvas'
import {ColorResult, SketchPicker} from 'react-color'
import styles from './start.module.scss'
import {useEffect, useState} from 'react'
import {StandardColor, StandardFont} from '@/core/standable'
import {DataService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {isErrorMessage} from 'packages/web/src/api/utils'

export * from './font-size'
export * from './start-item'
export * from './set-attr-event'
export * from './start-item-type'
export * from '.'
export interface StartProps {
    readonly selectedData?: SelectedData
}

export const StartComponent = ({selectedData}: StartProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const [openSketchPicker, setOpenSketchPicker] = useState(false)
    const [fontColor, setFontColor] = useState('#000')

    useEffect(() => {
        if (selectedData === undefined) {
            _setDefaultStyle()
            return
        }
        _initStyle()
    }, [selectedData])

    const _setDefaultStyle = () => {
        setFontColor('#000')
    }

    const _initStyle = () => {
        if (!selectedData) return
        const cell = getFirstCell(selectedData)
        const {r: row, c: col} = cell
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        const cellInfo = DATA_SERVICE.getCellInfo(sheet, row, col)
        cellInfo.then((c) => {
            if (isErrorMessage(c)) return
            const style = c.getStyle()
            const font = StandardFont.from(style.font)
            setFontColor(font.standardColor.css())
        })
    }

    const onColorPick = (result: ColorResult) => {
        const {r, g, b, a} = result.rgb
        const standardColor = StandardColor.from(r, g, b, a)
        setFontColor(standardColor.css())
        setOpenSketchPicker(false)
    }
    return (
        <div className={styles.host}>
            <div className={styles.left} />
            <div
                className={styles['font-color']}
                onClick={() => setOpenSketchPicker(true)}
            >
                <div>A</div>
                <div
                    className={styles['color-bar']}
                    style={{backgroundColor: fontColor}}
                />
            </div>
            {openSketchPicker ? (
                <SketchPicker
                    color={fontColor}
                    onChangeComplete={onColorPick}
                    className={styles['color-picker']}
                />
            ) : null}
        </div>
    )
}
