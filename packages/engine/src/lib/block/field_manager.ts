/**
 * Represents a field's type and configuration
 */
export type FieldTypeEnum =
    /**
     * A field whose type has not been declared. Free-form: rendered as a plain
     * cell (no widget), no type validation, not a membership field, no
     * number/date formatting. The explicit "not yet decided" state.
     */
    | {type: 'unspecified'}
    | {type: 'enum'; id: string}
    | {type: 'multiSelect'; id: string}
    | {type: 'datetime'; formatter: string}
    | {type: 'boolean'}
    | {type: 'string'; validation: string}
    | {type: 'number'; validation: string; formatter: string}
    | {type: 'image'}
    /**
     * Reference to another block's field. The dropdown options are pulled
     * dynamically from the target block at render time. The existence check
     * that surfaces a dangling ref is derived by the engine from this
     * declaration; `validation` here carries only the author's own rule.
     */
    | {
          type: 'fieldRef'
          sheetId: number
          blockId: number
          fieldName: string
          validation: string
      }
    /**
     * Reference to another block's field, picking multiple values. Storage
     * is a comma-separated string in the cell. Renderer parses the string
     * into a list and shows a multi-select dropdown sourced from the same
     * (sheetId, blockId, fieldName) target as `fieldRef`. v1 does not
     * auto-inject existence validation — dangling refs are not surfaced.
     */
    | {
          type: 'multiSelectRef'
          sheetId: number
          blockId: number
          fieldName: string
          validation: string
      }

/**
 * Represents a complete field definition
 */
export interface FieldInfo {
    /** Unique identifier for this field (cannot be changed or reused) */
    id: string
    /** Sheet ID this field belongs to */
    sheetId: number
    /** Block ID this field belongs to */
    blockId: number
    /**
     * Block-schema ref name (the `refName` passed to `bindFormSchema`).
     * Optional because fields may be created before the schema is bound;
     * the host fills this in once the bind happens.
     */
    refName?: string
    /** Name of the field */
    name: string
    /** Type of the field */
    type: FieldTypeEnum
    /** Optional description */
    description?: string
    /** Whether this field is required */
    required: boolean
    /**
     * Whether this field's values must be unique within the block.
     * Used by the composer to enumerate eligible target fields when
     * configuring a `fieldRef` cell. The duplicate check itself is DERIVED by
     * the engine from the schema's `unique` declaration — nothing composes a
     * COUNTIF into a stored formula any more, which is what lets a field rename
     * regenerate the rule instead of leaving one naming a dead field.
     */
    unique: boolean
    /** Default value */
    defaultValue?: string
    /**
     * The user's own validation rule, as typed in the composer.
     *
     * Historically this existed because the host wrapped the auto unique /
     * reference checks around it and needed the original back for the edit
     * dialog. Those are derived engine-side now, so the schema's
     * `validationFormula` IS the author's rule and this is simply a copy of it —
     * kept because the migration that adopts an older workbook's declarations
     * relies on it to tell the author's rule from the composed one
     * (`src/core/blocks/backfill.ts`).
     */
    validationRaw?: string
    /**
     * Static field-level write permission flag for the player (non-owner
     * caller). Read by the host permission patch:
     *
     *   - `false`     — permanently locks the field's cells against
     *                   player edits; the owner is still allowed.
     *   - `true`      — always allows player edits (overrides
     *                   block-owner restrictions).
     *   - `undefined` — fall back to block-owner rules (default): only
     *                   the owner can write; if there's no owner, anyone
     *                   can.
     *
     * For dynamic, formula-based editability rules, declare a
     * `editabilityFormula` (string) on the schema field at
     * `BindFormSchema` time — the Rust engine auto-installs a
     * `ShadowKind::UserEditable` shadow per row, and the host permission
     * patch reads the schema (via `BlockInfo.schema.fields[i]`) to
     * decide when to consult the shadow. FieldInfo no longer carries the
     * formula itself.
     */
    userEditable?: boolean
}

/**
 * Mints render ids.
 *
 * This was the host-side field store: it held a full `FieldInfo` per field —
 * type, description, `required`, `unique`, `defaultValue`, `writePolicy` — and
 * was the authority for all of it, persisted as an opaque JSON blob inside the
 * workbook's AppData. That is why a headless host had no field semantics and
 * `describe_block` could not report a field type in any host.
 *
 * All of it is on the engine schema now, and the app projects a `FieldInfo`
 * straight off the schema (`src/core/blocks/field-projection.ts`). What is
 * left is the one thing the schema cannot do for itself: hand out a fresh
 * render id when a field is created. A render id is the stable key that ties a
 * field to its cells and to its render info, so it has to be minted before the
 * schema can be bound with it — and it is the host that is creating the field.
 *
 * See design/block-field-semantics.md.
 */
export class FieldManager {
    private counter = 0

    /**
     * A render id nothing else will be given.
     *
     * The timestamp keeps two sessions apart; the counter keeps two fields in
     * the same session apart. Never reused, because a reused id would silently
     * attach a new field to the old one's cells and render info.
     */
    nextRenderId(): string {
        return `field_${Date.now()}_${++this.counter}`
    }
}
