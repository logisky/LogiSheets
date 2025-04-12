import {WORKBOOK_CLIENT} from './craft'
import {isErrorMessage} from '../../packages/web'

export async function getValueAssertString(
    sheetId: number,
    row: number,
    col: number
): Promise<string> {
    const cellInfo = await WORKBOOK_CLIENT.getCell({
        sheetIdx: sheetId,
        row,
        col,
    })
    if (isErrorMessage(cellInfo)) {
        throw new Error(cellInfo.msg)
    }
    return cellInfo.getText()
}
