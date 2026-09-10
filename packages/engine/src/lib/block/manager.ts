/**
 * BlockManager - manages block fields and enum sets for the spreadsheet engine.
 * This is used to define custom field types and validations for blocks.
 */

import type {BlockField} from 'logisheets-web'
import {EnumSetManager} from './enum_set_manager'
import {FieldManager, type FieldInfo} from './field_manager'
import type {WorkbookClient} from '../clients/workbook'

export const LOGISHEETS_BUILTIN_CRAFT_ID = 'logisheets'
export const FIELD_AND_VALIDATION_TAG = 80

/**
 * BlockManager is used to load and manage block-related data,
 * including field definitions and enum sets.
 *
 * Block IDs, block ranges and craft URLs are supposed to be stored in the workbook file.
 * And when the application starts, it will fetch the craft manifest from the URL, register it and bind the blocks.
 */
export class BlockManager {
    public constructor(private readonly _workbookClient?: WorkbookClient) {}

    public enumSetManager = new EnumSetManager()
    public fieldManager = new FieldManager()

    /**
     * Serialize the host-only remainder into the opaque JSON blob the embedder
     * hands to `workbook.save` as `appData`.
     *
     * This used to carry the full field metadata and the full enum sets, and was
     * the authority for both. It is neither now: field declarations live on the
     * engine schema and enum sets live in the workbook's own enum table, so what
     * is left here is the part the engine deliberately does not carry — the
     * COLOUR of each enum variant, which is presentation.
     *
     * Colours are keyed by `setId/variantId` so they survive a set being renamed
     * or re-labelled: `hydrateEnumSetsFromWorkbook` takes the options from the
     * workbook and looks the colour up by id.
     *
     * See design/block-field-semantics.md.
     */
    public getPersistentData(_blockFields: readonly BlockField[] = []): string {
        const variantColors: Record<string, string> = {}
        for (const set of this.enumSetManager.getAll()) {
            for (const v of set.variants) {
                variantColors[`${set.id}/${v.id}`] = v.color
            }
        }
        return JSON.stringify({variantColors})
    }

    public parseAppData(data: string): void {
        const parsed = JSON.parse(data) as {
            variantColors?: Record<string, string>
            // Written by builds before the declarations moved into the schema. Read
            // so their colours are not lost; everything else those two slots held is
            // on the schema or in the enum table now, and a workbook saved by such a
            // build is migrated on open.
            enumSets?: string
        }

        if (typeof parsed.enumSets === 'string') {
            this.enumSetManager.fromJSON(parsed.enumSets)
        }
        if (parsed.variantColors) {
            for (const [key, color] of Object.entries(parsed.variantColors)) {
                const slash = key.lastIndexOf('/')
                if (slash < 0) continue
                const setId = key.slice(0, slash)
                const variantId = key.slice(slash + 1)
                const existing = this.enumSetManager.get(setId)
                if (existing) {
                    const v = existing.variants.find((x) => x.id === variantId)
                    if (v) {
                        v.color = color
                        continue
                    }
                }
                // The set itself comes from the workbook a moment later
                // (hydrateEnumSetsFromWorkbook); seed a placeholder so the colour is
                // there to be picked up when it does.
                this.enumSetManager.set(setId, setId, [
                    ...(existing?.variants ?? []),
                    {id: variantId, value: variantId, color},
                ])
            }
        }
    }

    /**
     * Drop the host-only remainder. Call before loading a workbook so a book with
     * no block AppData does not inherit the previously-open book's enum colours.
     *
     * Nothing to clear on the field side any more: render ids are minted, never
     * stored, and everything a field means is on the schema the new workbook
     * brings with it.
     */
    public clear(): void {
        this.enumSetManager.clear()
    }
}
