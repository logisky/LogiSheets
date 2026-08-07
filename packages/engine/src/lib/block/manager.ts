/**
 * BlockManager - manages block fields and enum sets for the spreadsheet engine.
 * This is used to define custom field types and validations for blocks.
 */

import type { BlockField } from "logisheets-web";
import { EnumSetManager } from "./enum_set_manager";
import { FieldManager, type FieldInfo } from "./field_manager";
import type { WorkbookClient } from "../clients/workbook";

export const LOGISHEETS_BUILTIN_CRAFT_ID = "logisheets";
export const FIELD_AND_VALIDATION_TAG = 80;

/**
 * BlockManager is used to load and manage block-related data,
 * including field definitions and enum sets.
 *
 * Block IDs, block ranges and craft URLs are supposed to be stored in the workbook file.
 * And when the application starts, it will fetch the craft manifest from the URL, register it and bind the blocks.
 */
export class BlockManager {
  public constructor(private readonly _workbookClient?: WorkbookClient) {}

  public enumSetManager = new EnumSetManager();
  public fieldManager = new FieldManager();

  /**
   * Serialize host-side block metadata (FieldManager + EnumSetManager) into the
   * opaque JSON blob the embedder hands to `workbook.save` as `appData`. On load
   * `parseAppData` rebuilds both managers from it. This is the single channel
   * for host-owned block metadata — the engine stores the blob verbatim and
   * hands it back via `getAppData`; it never interprets it.
   *
   * NOTE: `blockFields` is retained only for call-site back-compat and ignored;
   * FieldManager is the host-side source of truth and is serialized directly.
   * Safe to pass `[]`.
   */
  public getPersistentData(_blockFields: readonly BlockField[] = []): string {
    const fieldInfosJson = JSON.stringify(this.fieldManager.getAll());
    const enumSetJson = this.enumSetManager.toJSON();
    return JSON.stringify({ fields: fieldInfosJson, enumSets: enumSetJson });
  }

  public parseAppData(data: string): void {
    const { fields, enumSets } = JSON.parse(data);
    if (typeof enumSets === "string") this.enumSetManager.fromJSON(enumSets);
    if (typeof fields === "string") this.fieldManager.fromJSON(fields);
  }

  /**
   * Drop all host-side block metadata. Call before loading a workbook so a
   * book with no block AppData doesn't inherit the previously-open book's
   * fields/enum sets.
   */
  public clear(): void {
    this.fieldManager.clear();
    this.enumSetManager.clear();
  }
}
