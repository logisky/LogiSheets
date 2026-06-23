import {Value} from 'logisheets-engine'
import type {FieldInfo} from 'logisheets-engine'
import {
    isValueEmpty,
    valueToString as coreValueToString,
    valueToNumber as coreValueToNumber,
    valueToDisplayString as coreValueToDisplayString,
} from 'logisheets-core'

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
export type InteractiveCellKind =
    | 'enum'
    | 'boolean'
    | 'datetime'
    | 'image'
    | 'fieldRef'
    | 'multiSelectRef'

export interface InteractiveCellSpec extends BlockCellProps {
    kind: 'interactive'
    interactiveKind: InteractiveCellKind
}

// Display and interactive are mutually exclusive on the type level — every
// rendered cell is exactly one of the two.
export type RenderedCellSpec = DisplayCellSpec | InteractiveCellSpec

// Value helpers now live in logisheets-core (UI-free). Re-exported here so the
// renderers keep their existing import sites.
export const valueToString = (val: Value): string =>
    coreValueToString(val as never)
export const valueToNumber = (val: Value): number | null =>
    coreValueToNumber(val as never)
export const valueToDisplayString = (val: Value): string =>
    coreValueToDisplayString(val as never)

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
        case 'fieldRef':
            return 'fieldRef'
        case 'multiSelectRef':
            return 'multiSelectRef'
        default:
            return null
    }
}

const hasValidation = (field: FieldInfo): boolean => {
    const t = field.type
    if (
        t.type === 'string' ||
        t.type === 'number' ||
        t.type === 'fieldRef' ||
        t.type === 'multiSelectRef'
    ) {
        return t.validation !== ''
    }
    return false
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

    if (base.fieldInfo.required && isValueEmpty(base.value as never)) {
        out.push({...base, kind: 'display', displayKind: 'required'})
    }

    return out
}
