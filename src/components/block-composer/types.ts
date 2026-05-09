// Field Type Definitions
export type FieldTypeEnum =
    | 'enum'
    | 'multiSelect'
    | 'datetime'
    | 'boolean'
    | 'string'
    | 'number'
    | 'image'
    | 'fieldRef'

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
    primary: boolean
    enumId?: string
    defaultValue?: string
    format?: string // for datetime
    validation?: string // for string/number
    unique?: boolean // for string/number — disallow duplicate values within the field
    // For fieldRef: the (sheet, block, field) the cell pulls its dropdown
    // options from. Eligible target fields are those with `unique: true` on
    // the engine FieldInfo (which includes primary keys, since we stamp
    // unique=true on primary at save time).
    //
    // When `refSelf` is true the target is the block being composed itself.
    // Since the new block's id isn't allocated until save, refSheetId and
    // refBlockId are ignored in that case and resolved at save time. The
    // engine FieldInfo always stores concrete ids, so this flag never
    // leaves the composer.
    refSelf?: boolean
    refSheetId?: number
    refBlockId?: number
    refFieldName?: string
}

export const COLORS = [
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
]
