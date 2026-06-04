/**
 * React hook: "is this block cell currently editable by the user?"
 *
 * Handles both shapes of `FieldInfo.userEditable`:
 *
 *   - `boolean` (or `undefined`) — returned synchronously after the
 *     first render. No engine calls.
 *
 *   - `string` (formula) — the hook is READ-ONLY: it does not install
 *     the shadow formula. The craft is expected to have installed the
 *     `UserEditable` shadow ephemerals already (e.g. in `newGame` /
 *     `bindFormSchema`-time as a batch tx) so by the time any widget
 *     mounts, the shadow has a computed bool value. The hook just:
 *       1. Resolves the shadow ephemeral id (`getShadowCellId` with
 *          `kind:'userEditable'`).
 *       2. Reads the value once (`getShadowInfoById`).
 *       3. Subscribes via `registerCellValueChangedByCellId` so any
 *          upstream change re-flips state.
 *
 *     A module-level cache keyed by (sheetIdx,row,col,formula) holds
 *     the last known bool so that subsequent mounts of the same cell
 *     start at the correct value without an initial flash. First-ever
 *     mount falls back to `false` (pessimistic — better to briefly
 *     show locked than to show clickable, let the user pick, and then
 *     have the permission patch silently reject).
 *
 * The Rust engine has zero knowledge of "user editable" as a concept;
 * it just stores and evaluates whatever formula the host installed on
 * the shadow ephemeral. All policy lives here.
 */

import {useEffect, useState} from 'react'
import type {FieldInfo, SheetCellId, Value} from 'logisheets-engine'
import {isErrorMessage} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'

// Module-level cache of last-known shadow values, keyed by
// `sheetIdx:row:col:formula`. Updated on every refresh (initial + on
// subscription fire); read by future mounts of the same cell to avoid
// the locked-then-unlocked flash.
const _shadowValueCache = new Map<string, boolean>()

/**
 * Coerce a shadow cell value into the editable bool the hook returns.
 *
 * Critical: anything other than a clearly-truthy value (bool true /
 * non-zero number / non-empty non-"FALSE" string) is treated as NOT
 * editable. In particular `'empty'`, `undefined`, and `error` all
 * fail closed — the formula hasn't installed yet, or it errored, or
 * the engine returned something we don't know how to interpret. The
 * craft pre-installs every userEditable shadow at newGame /
 * row-insert time so this fail-closed never bites in practice.
 */
function shadowValueIsEditable(v: Value | undefined): boolean {
    if (v === undefined || v === 'empty') return false
    if (v.type === 'bool') return v.value === true
    if (v.type === 'number') return v.value !== 0
    if (v.type === 'str')
        return v.value !== '' && v.value.toUpperCase() !== 'FALSE'
    if (v.type === 'error') return false
    return false
}

export function useEditable(
    fieldInfo: FieldInfo | undefined,
    sheetIdx: number,
    rowIdx: number,
    colIdx: number
): boolean {
    const engine = useEngine()
    const ue = fieldInfo?.userEditable

    // Static path — boolean (or undefined) goes through state
    // unchanged.
    const initial =
        typeof ue === 'boolean'
            ? ue
            : typeof ue === 'string'
            ? _shadowValueCache.get(
                  `${sheetIdx}:${rowIdx}:${colIdx}:${
                      ue.startsWith('=') ? ue : `=${ue}`
                  }`
              ) ?? false
            : true
    const [editable, setEditable] = useState<boolean>(initial)

    useEffect(() => {
        if (typeof ue !== 'string') {
            setEditable(typeof ue === 'boolean' ? ue : true)
            return
        }

        let cancelled = false
        const wb = engine.getWorkbook()
        const formula = ue.startsWith('=') ? ue : `=${ue}`
        const cacheKey = `${sheetIdx}:${rowIdx}:${colIdx}:${formula}`

        const refresh = (id: number): void => {
            wb.getShadowInfoById(id).then((info) => {
                if (cancelled) return
                if (isErrorMessage(info)) return
                const next = shadowValueIsEditable(info.value)
                _shadowValueCache.set(cacheKey, next)
                setEditable(next)
            })
        }

        wb.getShadowCellId({
            sheetIdx,
            rowIdx,
            colIdx,
            kind: 'userEditable',
        }).then((shadowCellId) => {
            if (cancelled) return
            if (isErrorMessage(shadowCellId)) return
            const sid: SheetCellId = shadowCellId
            if (sid.cellId.type !== 'ephemeralCell') return
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
    }, [engine, ue, sheetIdx, rowIdx, colIdx])

    return editable
}
