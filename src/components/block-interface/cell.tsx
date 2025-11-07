import {Value} from 'logisheets-web'
import {FieldInfo} from '@/core/data'

// Common interface for all block cell components
export interface BlockCellProps {
    x: number
    y: number
    width: number
    height: number
    value: Value
    shadowValue?: Value
    fieldInfo: FieldInfo
    sheetIdx: number
    rowIdx: number
    colIdx: number
}

// Helper function to extract string from Value
export const valueToString = (val: Value): string => {
    if (val === 'empty') return ''
    if (val.type === 'str') return val.value
    return ''
}

// Helper function to extract number from Value
export const valueToNumber = (val: Value): number | null => {
    if (val === 'empty') return null
    if (val.type === 'number') return val.value
    return null
}
