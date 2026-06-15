/**
 * React hook: "is this block cell currently editable by the user?"
 *
 * Post-Phase-1+2 architecture:
 *
 *   - The static boolean form lives on `FieldInfo.userEditable`
 *     (read synchronously).
 *   - The dynamic formula form lives in the Rust schema
 *     (`BindFormSchema.editabilityFormulas`); the engine auto-installs
 *     a `ShadowKind::UserEditable` shadow per row at bind / insert
 *     time. We always try to read that shadow — if it's populated
 *     with a bool the widget reflects the formula's current value; if
 *     it's `empty` (no formula declared for this field), we fall back
 *     to the static `FieldInfo.userEditable` flag.
 *
 *   - The hook is READ-ONLY: it never installs the shadow. The engine
 *     does that. We just subscribe to value changes so the widget
 *     re-renders when the formula's inputs change.
 *
 * A module-level cache keyed by (sheetIdx,row,col) holds the last
 * known shadow bool so subsequent mounts of the same cell start at
 * the correct value without an initial flash.
 */

import {useEffect, useState} from 'react'
import type {FieldInfo, SheetCellId, Value} from 'logisheets-engine'
import {isErrorMessage} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'

// Module-level cache of last-known shadow values, keyed by
// `sheetIdx:row:col`. Updated on every refresh.
const _shadowValueCache = new Map<string, boolean>()

/**
 * Map a UserEditable shadow value to the bool the hook returns.
 * `empty` / `undefined` / `error` all signal "no formula or formula
 * not computed yet" — the caller should fall back to the static flag.
 */
function shadowValueIsEditable(v: Value | undefined): boolean | undefined {
    if (v === undefined || v === 'empty') return undefined
    if (v.type === 'bool') return v.value
    if (v.type === 'number') return v.value !== 0
    if (v.type === 'str')
        return v.value !== '' && v.value.toUpperCase() !== 'FALSE'
    if (v.type === 'error') return false
    return undefined
}

function staticFlag(ue: boolean | undefined): boolean {
    return typeof ue === 'boolean' ? ue : true
}

export function useEditable(
    fieldInfo: FieldInfo | undefined,
    sheetIdx: number,
    rowIdx: number,
    colIdx: number
): boolean {
    const engine = useEngine()
    const ue = fieldInfo?.userEditable

    const cacheKey = `${sheetIdx}:${rowIdx}:${colIdx}`
    const cached = _shadowValueCache.get(cacheKey)
    const initial = cached !== undefined ? cached : staticFlag(ue)
    const [editable, setEditable] = useState<boolean>(initial)

    useEffect(() => {
        let cancelled = false
        const wb = engine.getWorkbook()

        const refresh = (id: number): void => {
            wb.getShadowInfoById({shadowId: id}).then((info) => {
                if (cancelled) return
                if (isErrorMessage(info)) return
                const fromShadow = shadowValueIsEditable(info.value)
                if (fromShadow === undefined) {
                    // Shadow not populated — schema didn't declare an
                    // editability formula for this field. Defer to the
                    // static flag.
                    setEditable(staticFlag(ue))
                    return
                }
                _shadowValueCache.set(cacheKey, fromShadow)
                setEditable(fromShadow)
            })
        }

        wb.getShadowCellId({
            sheetIdx,
            rowIdx,
            colIdx,
            kind: 'userEditable',
        }).then((shadowCellId) => {
            if (cancelled) return
            if (isErrorMessage(shadowCellId)) {
                setEditable(staticFlag(ue))
                return
            }
            const sid: SheetCellId = shadowCellId
            if (sid.cellId.type !== 'ephemeralCell') {
                setEditable(staticFlag(ue))
                return
            }
            const eid = sid.cellId.value as number

            refresh(eid)

            // Subscribe — re-pull on any value change to the shadow.
            // No unregister API; widgets in this app outlive most edits
            // and newGame tears down everything anyway.
            wb.registerCellValueChangedByCellId(sid, () => {
                if (!cancelled) refresh(eid)
            })
        })

        return () => {
            cancelled = true
        }
    }, [engine, ue, sheetIdx, rowIdx, colIdx, cacheKey])

    return editable
}
