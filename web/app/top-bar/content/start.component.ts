import {Component, ChangeDetectionStrategy, Input} from '@angular/core'
import {
    PayloadBuilder,
    SetFontBoldBuilder,
    SetFontColorBuilder,
    StyleUpdate,
    StyleUpdateBuilder,
    StyleUpdatePayloadBuilder,
    TransactionBuilder,
    _Payload_Payload_oneof,
    _StyleUpdatePayload_Style_payload_oneof,
} from '@logi-pb/network/src/proto/message_pb'
import {isBoolean, isString} from '@logi-base/src/ts/common/type_guard'
import {SelectedCell, SelectedCellBuilder} from '@logi-sheets/web/app/canvas'
import {DataService} from '@logi-sheets/web/core/data'
import {StartItem, StartItemBuilder} from './start-item'
import {ItemType} from './start-item-type'

@Component({
    selector: 'logi-start',
    templateUrl: './start.component.html',
    styleUrls: ['./start.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartComponent {
    constructor(
        private readonly _dataSvc: DataService,
    ) { }
    @Input() set selectedCell(selectedCell: SelectedCell | undefined) {
        if (selectedCell === undefined) {
            this._setDefaultStyle()
            return
        }
        this._selectedCell = selectedCell
        this._initStyle()
    }
    startItemTypeEnum = ItemType

    getStartItem(itemType: ItemType): StartItem {
        let item = this._itemMap.get(itemType)
        if (item === undefined)
            item = new StartItemBuilder().type(itemType).build()
        this._itemMap.set(itemType, item)
        return item
    }

    open(itemType: ItemType): void {
        const item = this._itemMap.get(itemType)
        item?.setOpened(true)
    }

    setStyle(type: ItemType, value: unknown): void {
        const field = this._getPayloadType(type, value)
        if (field === undefined)
            return
        const payload = new PayloadBuilder()
            .payloadOneof(field, _Payload_Payload_oneof.STYLE_UPDATE)
            .build()
        const transaction = new TransactionBuilder().payloads([payload]).build()
        this._dataSvc.backend.send(transaction)
    }

    private _selectedCell = new SelectedCellBuilder().row(-1).col(-1).build()
    private _itemMap = new Map<ItemType, StartItem>()
    private _setDefaultStyle(): void {
        this._itemMap.clear()
    }

    private _initStyle(): void {
        const row = this._selectedCell.row
        const col = this._selectedCell.col
        const s = this._dataSvc.sheetSvc.getCell(row, col)?.style
        if (s === undefined)
            return
        const font = s.getFont()
        const item = new StartItemBuilder()
            .type(ItemType.FONT_COLOR)
            .value(font.standardColor.css())
            .build()
        this._itemMap.set(ItemType.FONT_COLOR, item)
    }

    private _getPayloadType(
        type: ItemType,
        styleValue: unknown,
    ): StyleUpdate | undefined {
        const row = this._selectedCell.row
        const col = this._selectedCell.col
        const sheet = this._dataSvc.sheetSvc.getActiveSheet()
        const item = this._itemMap.get(type)
        if (item === undefined)
            return
        item.setOpened(false)
        if (row === -1 || col === -1 || sheet === -1)
            return
        const styleUpdate = new StyleUpdateBuilder()
            .row(row)
            .col(col)
            .sheetIdx(sheet)
        const payload = new StyleUpdatePayloadBuilder()
        if (type === ItemType.ADD_DECIMAL_PLACE)
            return
        if (type === ItemType.BG_COLOR)
            return
        if (type === ItemType.BOLD && isBoolean(styleValue))
            payload.stylePayloadOneof(
                new SetFontBoldBuilder().bold(styleValue).build(),
                _StyleUpdatePayload_Style_payload_oneof.SET_FONT_BOLD
            )
        else if (type === ItemType.BORDER)
            return
        else if (type === ItemType.CLEAR_FORMAT)
            return
        else if (type === ItemType.DECREASE_DECIMAL_PLACE)
            return
        else if (type === ItemType.DECREASE_FONT_SIZE)
            return
        else if (type === ItemType.FILTER)
            return
        else if (type === ItemType.FONT_COLOR) {
            if (!isString(styleValue) || styleValue === '')
                return
            payload.stylePayloadOneof(
                new SetFontColorBuilder().color(styleValue).build(),
                _StyleUpdatePayload_Style_payload_oneof.SET_FONT_COLOR
            )
        }
        return styleUpdate.payload(payload.build()).build()
    }
}
