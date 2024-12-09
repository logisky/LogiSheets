import {SelectedCell} from '@/components/canvas'
import {ColorResult, SketchPicker} from 'react-color'
import styles from './start.module.scss'
import {useEffect, useState} from 'react'
import {StandardColor} from '@/core/standable'
import {DataService} from '@/core/data2'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'

export * from './font-size'
export * from './start-item'
export * from './set-attr-event'
export * from './start-item-type'
export * from '.'
export interface StartProps {
    readonly selectedCell?: SelectedCell
}

export const StartComponent = ({selectedCell}: StartProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const [openSketchPicker, setOpenSketchPicker] = useState(false)
    const [fontColor, setFontColor] = useState('#000')

    useEffect(() => {
        if (selectedCell === undefined) {
            _setDefaultStyle()
            return
        }
        _initStyle()
    }, [selectedCell])
    // getStartItem(itemType: ItemType): StartItem {
    //     let item = this._itemMap.get(itemType)
    //     if (item === undefined)
    //         item = new StartItemBuilder().type(itemType).build()
    //     this._itemMap.set(itemType, item)
    //     return item
    // }

    // open(itemType: ItemType): void {
    //     const item = this._itemMap.get(itemType)
    //     item?.setOpened(true)
    // }

    // setStyle(type: ItemType, value: unknown): void {
    //     const field = this._getPayloadType(type, value)
    //     if (field === undefined)
    //         return
    //     const payload = new PayloadBuilder()
    //         .payloadOneof(field, _Payload_Payload_oneof.STYLE_UPDATE)
    //         .build()
    //     const transaction = new TransactionBuilder().payloads([payload]).build()
    //     this._dataSvc.backend.send(transaction)
    // }

    // private _selectedCell = new SelectedCellBuilder().row(-1).col(-1).build()
    // private _itemMap = new Map<ItemType, StartItem>()
    const _setDefaultStyle = () => {
        setFontColor('#000')
    }

    const _initStyle = () => {
        if (!selectedCell) return
        const {row, col} = selectedCell
        const style = DATA_SERVICE.getCell(row, col)?.style
        if (style === undefined) return
        const font = style.getFont()
        setFontColor(font.standardColor.css())
    }

    // private _getPayloadType(
    //     type: ItemType,
    //     styleValue: unknown,
    // ): StyleUpdate | undefined {
    //     const row = this._selectedCell.row
    //     const col = this._selectedCell.col
    //     const sheet = this._dataSvc.sheetSvc.getActiveSheet()
    //     const item = this._itemMap.get(type)
    //     if (item === undefined)
    //         return
    //     item.setOpened(false)
    //     if (row === -1 || col === -1 || sheet === -1)
    //         return
    //     const styleUpdate = new StyleUpdateBuilder()
    //         .row(row)
    //         .col(col)
    //         .sheetIdx(sheet)
    //     const payload = new StyleUpdatePayloadBuilder()
    //     if (type === ItemType.ADD_DECIMAL_PLACE)
    //         return
    //     if (type === ItemType.BG_COLOR)
    //         return
    //     if (type === ItemType.BOLD && isBoolean(styleValue))
    //         payload.stylePayloadOneof(
    //             new SetFontBoldBuilder().bold(styleValue).build(),
    //             _StyleUpdatePayload_Style_payload_oneof.SET_FONT_BOLD
    //         )
    //     else if (type === ItemType.BORDER)
    //         return
    //     else if (type === ItemType.CLEAR_FORMAT)
    //         return
    //     else if (type === ItemType.DECREASE_DECIMAL_PLACE)
    //         return
    //     else if (type === ItemType.DECREASE_FONT_SIZE)
    //         return
    //     else if (type === ItemType.FILTER)
    //         return
    //     else if (type === ItemType.FONT_COLOR) {
    //         if (!isString(styleValue) || styleValue === '')
    //             return
    //         payload.stylePayloadOneof(
    //             new SetFontColorBuilder().color(styleValue).build(),
    //             _StyleUpdatePayload_Style_payload_oneof.SET_FONT_COLOR
    //         )
    //     }
    //     return styleUpdate.payload(payload.build()).build()
    // }
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
