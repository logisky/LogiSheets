// Field Type Definitions
export type FieldTypeEnum =
    | 'enum'
    | 'multiSelect'
    | 'datetime'
    | 'boolean'
    | 'string'
    | 'number'

export interface EnumValue {
    id: string
    label: string
    description: string
    color: string
}

export interface FieldSetting {
    id: string
    name: string
    type: FieldTypeEnum
    description?: string
    required: boolean
    showInSummary: boolean
    enumValues: EnumValue[]
    defaultValue?: string
    format?: string // for datetime
    validation?: string // for string/number
}

export const COLORS = [
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
]
