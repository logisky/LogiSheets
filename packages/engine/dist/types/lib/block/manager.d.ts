/**
 * BlockManager - manages block fields and enum sets for the spreadsheet engine.
 * This is used to define custom field types and validations for blocks.
 */
import type { BlockField } from "logisheets-web";
import { EnumSetManager } from "./enum_set_manager";
import { FieldManager } from "./field_manager";
import type { WorkbookClient } from "../clients/workbook";
export declare const LOGISHEETS_BUILTIN_CRAFT_ID = "logisheets";
export declare const FIELD_AND_VALIDATION_TAG = 80;
/**
 * BlockManager is used to load and manage block-related data,
 * including field definitions and enum sets.
 *
 * Block IDs, block ranges and craft URLs are supposed to be stored in the workbook file.
 * And when the application starts, it will fetch the craft manifest from the URL, register it and bind the blocks.
 */
export declare class BlockManager {
    private readonly _workbookClient?;
    constructor(_workbookClient?: WorkbookClient | undefined);
    enumSetManager: EnumSetManager;
    fieldManager: FieldManager;
    /**
     * Serialize host-side block metadata (FieldManager + EnumSetManager)
     * into the opaque JSON blob the embedder hands to `workbook.save` as
     * `appData`.
     *
     * NOTE: The `blockFields` parameter exists only for API back-compat —
     * earlier versions used it to filter FieldManager entries by what the
     * worker reported via `getAllBlockFields()`. That filter dropped every
     * field for crafts that populate FieldManager (via `fieldManager.create`)
     * but never push the IDs into the worker's `block_line_info_manager`
     * (e.g. factory-simulator), which is the common case. FieldManager is
     * the host-side source of truth; we serialize it directly here and
     * ignore the parameter. Safe to pass `[]`.
     */
    getPersistentData(_blockFields?: readonly BlockField[]): string;
    parseAppData(data: string): void;
}
