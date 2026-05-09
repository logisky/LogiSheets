import {Value} from 'logisheets-engine'
import type {FieldInfo} from 'logisheets-engine'

// Geometry + data shared by every rendered cell, regardless of category.
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

// Display-only overlays: read-only indicators that visualize whether the
// underlying value satisfies a constraint. Multiple display cells may be
// stacked on top of the same data cell (e.g. validation + required).
export type DisplayCellKind = 'validation' | 'required'

export interface DisplayCellSpec extends BlockCellProps {
    kind: 'display'
    displayKind: DisplayCellKind
}

// Interactive widgets: the user clicks to edit. At most one interactive
// cell is rendered per data cell, picked from the field's type.
export type InteractiveCellKind = 'enum' | 'boolean' | 'datetime' | 'image'

export interface InteractiveCellSpec extends BlockCellProps {
    kind: 'interactive'
    interactiveKind: InteractiveCellKind
}

// Display and interactive are mutually exclusive on the type level — every
// rendered cell is exactly one of the two.
export type RenderedCellSpec = DisplayCellSpec | InteractiveCellSpec

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

const isValueEmpty = (v: Value): boolean => {
    if (v === 'empty') return true
    if (v.type === 'str' && v.value === '') return true
    return false
}

const pickInteractiveKind = (field: FieldInfo): InteractiveCellKind | null => {
    switch (field.type.type) {
        case 'enum':
            return 'enum'
        case 'boolean':
            return 'boolean'
        case 'datetime':
            return 'datetime'
        case 'image':
            return 'image'
        default:
            return null
    }
}

const hasValidation = (field: FieldInfo): boolean => {
    return (
        (field.type.type === 'string' || field.type.type === 'number') &&
        field.type.validation !== ''
    )
}

// Map one data cell to the list of overlays + (optional) widget that should
// be rendered for it. Order in the returned array is the render order:
// interactive first (lowest layer), display indicators on top.
export const buildRenderedCells = (
    base: BlockCellProps
): RenderedCellSpec[] => {
    const out: RenderedCellSpec[] = []

    const interactiveKind = pickInteractiveKind(base.fieldInfo)
    if (interactiveKind) {
        out.push({...base, kind: 'interactive', interactiveKind})
    }

    if (hasValidation(base.fieldInfo)) {
        out.push({...base, kind: 'display', displayKind: 'validation'})
    }

    if (base.fieldInfo.required && isValueEmpty(base.value)) {
        out.push({...base, kind: 'display', displayKind: 'required'})
    }

    return out
}
