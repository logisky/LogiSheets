import {useEffect, useState} from 'react'
import {
    Box,
    Button,
    Typography,
    Dialog,
    DialogContent,
    TextField,
} from '@mui/material'
import {
    getSelectedCellRange,
    SelectedData,
    getFirstCell,
    isErrorMessage,
} from 'logisheets-engine'
import {useToast} from '@/ui/notification/useToast'
import {firstFieldFormulaError} from './field-formula'
import {useEngine, useOps} from '@/core/engine/provider'
import type {FieldTypeEnum} from 'logisheets-engine'
import {FieldList} from './field_list'
import {FieldConfigPanel} from './config_panel'
import {dialogPaperSx} from './styles'
import type {FieldSetting, FormBlockField} from 'logisheets-core'

export * from './types'

export interface BlockComposerProps {
    selectedData?: SelectedData
    close: () => void
    /**
     * When set, the composer runs in *convert* mode: instead of creating a
     * fresh 1-row block at the selection top-left (`createFormBlock`), it turns
     * the selected region into a block in place (`convertToFormBlock`) — keeping
     * its cells/values and remapping formulas that reference the range. The
     * field count is fixed to the region's column count (one field per column).
     * This is what the Link picker's "create a new block from selection" uses.
     */
    convertRegion?: {rowCnt: number; colCnt: number}
    /**
     * Seed the field list instead of the built-in defaults. Used by the Ctrl+T
     * "convert selection to block" flow, which infers field names/types from the
     * selected data (see ./infer) so the composer opens pre-filled. The user
     * still edits everything before saving. In convert mode the length must
     * match the region's column count.
     */
    initialFields?: FieldSetting[]
    /**
     * When set, the composer runs in *edit* mode on an EXISTING form block:
     * the block's ref name and current fields are loaded on open, and Save
     * dispatches `editFormBlock` (a tail `resizeBlock` + re-`bindFormSchema`)
     * instead of creating a block.
     *
     * Existing fields are EDITABLE — name, type, validation rule, and required
     * can be changed; each is rebuilt preserving its original `renderId` so the
     * block's cells stay wired (via `FieldManager.upsert`). Fields cannot be
     * DELETED, so the column count stays monotonically non-decreasing: only a
     * tail resize is needed and no schema entry is orphaned. New fields are
     * appended at the end.
     */
    editTarget?: {sheetIdx: number; sheetId: number; blockId: number}
}

export const BlockComposerComponent = (props: BlockComposerProps) => {
    const {selectedData, close, convertRegion, initialFields, editTarget} =
        props
    const {toast} = useToast()
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
    const ops = useOps()
    const BLOCK_MANAGER = engine.getBlockManager()

    const [fields, setFields] = useState<FieldSetting[]>(() =>
        initialFields && initialFields.length > 0
            ? initialFields
            : convertRegion
            ? Array.from({length: convertRegion.colCnt}, (_, i) => ({
                  id: String(i + 1),
                  name: `Field ${i + 1}`,
                  type: 'number',
                  required: false,
                  primary: i === 0,
              }))
            : editTarget
            ? []
            : [
                  {
                      id: '1',
                      name: 'Customer Status',
                      type: 'string',
                      description: 'Current status of the customer',
                      required: true,
                      primary: false,
                  },
              ]
    )
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
        fields[0]?.id || null
    )
    const [refName, setRefName] = useState('')

    // Edit-mode state. `originalById` holds the verbatim FormBlockField for
    // each pre-existing field, keyed by its stable renderId — these are
    // passed through on save untouched (never re-`create`d, so the block's
    // cells stay wired to their render/type metadata). `editMeta` carries the
    // block's current column count + key index, needed by `editFormBlock`.
    const [editLoading, setEditLoading] = useState<boolean>(!!editTarget)
    const [originalById, setOriginalById] = useState<
        Map<string, FormBlockField>
    >(() => new Map())
    const [editMeta, setEditMeta] = useState<{
        colCnt: number
        keyIdx: number
    } | null>(null)

    useEffect(() => {
        if (!editTarget) return
        let cancelled = false
        ;(async () => {
            const info = await DATA_SERVICE.getWorkbook().getBlockInfo({
                sheetId: editTarget.sheetId,
                blockId: editTarget.blockId,
            })
            if (cancelled) return
            if (isErrorMessage(info) || !info.schema) {
                toast('Could not read this block’s structure', {
                    type: 'error',
                })
                close()
                return
            }
            const schema = info.schema
            const renders = new Map(
                info.fieldRenders.map((r) => [r.renderId, r])
            )
            // Field authoring info (type / validation / …) lives host-side in
            // FieldManager, restored from the workbook's AppData on load
            // (BlockManager.parseAppData). Look each field up by renderId — the
            // stable key the schema uses — so it resolves even if sheet/block
            // ids shifted across a save/load. A field with no host entry (e.g. a
            // foreign file) falls back to a plain 'string' below.
            const keyIdx = schema.keys[0]?.idx ?? 0
            const sorted = [...schema.fields].sort((a, b) => a.idx - b.idx)
            const orig = new Map<string, FormBlockField>()
            const seedFields: FieldSetting[] = sorted.map((fe) => {
                const render = renders.get(fe.renderId)
                orig.set(fe.renderId, {
                    name: fe.field,
                    renderId: fe.renderId,
                    valueFormula: fe.valueFormula ?? '',
                    diyRender: render?.diyRender ?? false,
                    numFmt: render?.style?.formatter ?? '',
                })
                // Reconstruct the full authoring setting from the host
                // FieldInfo so the panel shows the field's real type +
                // validation and edits are non-lossy. A block loaded from file
                // with no host state falls back to a plain 'string'.
                const fi = BLOCK_MANAGER.fieldManager.get(fe.renderId)
                const setting: FieldSetting = {
                    id: fe.renderId,
                    name: fe.field,
                    type: (fi?.type.type ?? 'string') as FieldSetting['type'],
                    required: fi?.required ?? false,
                    unique: fi?.unique ?? false,
                    primary: fe.idx === keyIdx,
                    description: fi?.description,
                    validation: fi?.validationRaw,
                    valueFormula: fe.valueFormula ?? undefined,
                }
                if (fi) {
                    const t = fi.type
                    if (t.type === 'enum' || t.type === 'multiSelect') {
                        setting.enumId = t.id
                    } else if (t.type === 'datetime') {
                        setting.format = t.formatter
                    } else if (t.type === 'number') {
                        setting.format = t.formatter
                    } else if (
                        t.type === 'fieldRef' ||
                        t.type === 'multiSelectRef'
                    ) {
                        setting.refSheetId = t.sheetId
                        setting.refBlockId = t.blockId
                        setting.refFieldName = t.fieldName
                        setting.refSelf =
                            t.sheetId === editTarget.sheetId &&
                            t.blockId === editTarget.blockId
                    }
                }
                return setting
            })
            setOriginalById(orig)
            setFields(seedFields)
            setSelectedFieldId(seedFields[0]?.id ?? null)
            setRefName(schema.name)
            setEditMeta({colCnt: info.colCnt, keyIdx})
            setEditLoading(false)
        })()
        return () => {
            cancelled = true
        }
        // editTarget is a stable prop for the lifetime of the dialog.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editTarget])

    if (!editTarget && !selectedData) {
        return null
    }
    // create/convert need a real selection; edit does not.
    if (!editTarget && selectedData && !getSelectedCellRange(selectedData)) {
        return null
    }

    const selectedField = fields.find((f) => f.id === selectedFieldId)
    const isOriginal = (id: string | null | undefined) =>
        !!id && originalById.has(id)

    const handleAddField = () => {
        const newField: FieldSetting = {
            id: Date.now().toString(),
            name: 'New Field',
            type: 'string',
            required: false,
            primary: false,
        }
        setFields([...fields, newField])
        setSelectedFieldId(newField.id)
    }

    const handleUpdateField = (field: FieldSetting) => {
        setFields(
            fields.map((f) => {
                if (f.id === field.id) {
                    return field
                }
                if (field.primary) {
                    return {...f, primary: false}
                }
                return f
            })
        )
    }

    const handleDeleteField = (id: string) => {
        // Existing fields are immutable in edit mode — never deletable.
        if (isOriginal(id)) return
        setFields(fields.filter((f) => f.id !== id))
        if (selectedFieldId === id) {
            setSelectedFieldId(fields[0]?.id || null)
        }
    }

    // Build one engine-neutral FormBlockField for a NEW field: registers a
    // FieldInfo in the host FieldManager (allocating a fresh renderId),
    // composes validation, and flattens to the operation-layer shape. Shared
    // by create / convert / edit so field semantics stay identical.
    const makeFieldBuilder =
        (sheetId: number, blockId: number) =>
        (field: FieldSetting, existingRenderId?: string): FormBlockField => {
            const composeValidation = (f: FieldSetting): string => {
                const userValidation = (f.validation ?? '').trim()
                if (!f.unique) return userValidation
                const escapedName = f.name.replace(/"/g, '""')
                const uniqueCheck = `COUNTIF(BLOCKREFSB(${sheetId}, ${blockId}, "*", "${escapedName}"), #PLACEHOLDER) = 1`
                if (!userValidation) return uniqueCheck
                return `AND(${userValidation}, ${uniqueCheck})`
            }
            const resolveRefTarget = (
                f: FieldSetting
            ): {sheetId: number; blockId: number} => {
                if (f.refSelf) {
                    return {sheetId, blockId}
                }
                return {sheetId: f.refSheetId!, blockId: f.refBlockId!}
            }
            const composeRefValidation = (f: FieldSetting): string => {
                const {sheetId: rSheetId, blockId: bid} = resolveRefTarget(f)
                const escapedName = (f.refFieldName ?? '').replace(/"/g, '""')
                return `COUNTIF(BLOCKREFSB(${rSheetId}, ${bid}, "*", "${escapedName}"), #PLACEHOLDER) >= 1`
            }

            let ty: FieldTypeEnum
            if (field.type === 'enum') {
                ty = {type: 'enum', id: field.enumId!}
            } else if (field.type === 'multiSelect') {
                ty = {type: 'multiSelect', id: field.enumId!}
            } else if (field.type === 'datetime') {
                ty = {type: 'datetime', formatter: field.format ?? ''}
            } else if (field.type === 'boolean') {
                ty = {type: 'boolean'}
            } else if (field.type === 'string') {
                ty = {type: 'string', validation: composeValidation(field)}
            } else if (field.type === 'number') {
                ty = {
                    type: 'number',
                    validation: composeValidation(field),
                    formatter: field.format ?? '',
                }
            } else if (field.type === 'image') {
                ty = {type: 'image'}
            } else if (field.type === 'unspecified') {
                // Free-form: no widget, no validation, no formatting.
                ty = {type: 'unspecified'}
            } else if (field.type === 'fieldRef') {
                const {sheetId: rSheetId, blockId: bid} =
                    resolveRefTarget(field)
                ty = {
                    type: 'fieldRef',
                    sheetId: rSheetId,
                    blockId: bid,
                    fieldName: field.refFieldName!,
                    validation: composeRefValidation(field),
                }
            } else {
                // multiSelectRef — no auto-validation in v1 (see create path).
                const {sheetId: rSheetId, blockId: bid} =
                    resolveRefTarget(field)
                ty = {
                    type: 'multiSelectRef',
                    sheetId: rSheetId,
                    blockId: bid,
                    fieldName: field.refFieldName!,
                    validation: '',
                }
            }
            const isUnique = !!field.unique || !!field.primary
            const fieldData = {
                name: field.name,
                type: ty,
                description: field.description,
                required: field.required,
                unique: isUnique,
                // Keep the raw user rule so a later edit shows/re-composes it
                // without re-wrapping the auto unique/ref checks.
                validationRaw: field.validation,
            }
            // Editing an existing field: reuse its renderId (so the block's
            // cells stay wired) and update its FieldInfo in place. New field:
            // allocate a fresh renderId.
            let renderId: string
            if (existingRenderId) {
                BLOCK_MANAGER.fieldManager.upsert({
                    ...fieldData,
                    id: existingRenderId,
                    sheetId,
                    blockId,
                })
                renderId = existingRenderId
            } else {
                const r = BLOCK_MANAGER.fieldManager.create(
                    sheetId,
                    blockId,
                    fieldData
                )
                renderId = r.id
            }

            let diyRender = false
            let numFmt = ''
            switch (ty.type) {
                case 'image':
                case 'enum':
                case 'multiSelect':
                case 'boolean':
                case 'fieldRef':
                case 'multiSelectRef':
                    diyRender = true
                    break
                case 'datetime':
                case 'number':
                    numFmt = ty.formatter
                    break
                default:
                    break
            }
            // The validation rule goes into the SCHEMA, not just the host
            // FieldInfo: the engine then installs the per-record shadow itself
            // (including on rows added later), and the same rule answers both
            // the warning marker and the `overrideValidation` write gate.
            // Only some field types carry one — the rest send ''.
            const validationFormula =
                'validation' in ty ? ty.validation ?? '' : ''
            return {
                name: field.name,
                renderId,
                valueFormula: field.valueFormula ?? '',
                validationFormula,
                diyRender,
                numFmt,
            }
        }

    // Lightweight ref-name guard shared by create / convert / edit. Ref names
    // are the handle formulas use (`BLOCKREF("name", …)`) and are workbook-wide
    // unique keys — a duplicate silently steals the mapping from the other
    // block. Returns an error message to show, or null when the name is OK.
    const validateRefName = async (): Promise<string | null> => {
        const name = refName.trim()
        if (!name) return 'Please enter a block ref name.'
        const all = await DATA_SERVICE.getWorkbook().getAllBlocks({})
        if (isErrorMessage(all)) return null // can't check — don't block save
        const clash = all.some(
            (b) =>
                b.schema?.name === name &&
                // In edit mode, the block keeping its own name is not a clash.
                !(
                    editTarget &&
                    b.blockId === editTarget.blockId &&
                    b.sheetId === editTarget.sheetId
                )
        )
        if (clash)
            return `A block named “${name}” already exists — choose a unique ref name.`
        return null
    }

    /**
     * Field formulas that name a field the block doesn't have make the engine
     * refuse the whole bind, taking every other edit in the dialog with it.
     * Catch it here and say which field is at fault.
     */
    const validateFieldFormulas = (): boolean => {
        const bad = firstFieldFormulaError(fields)
        if (!bad) return true
        setSelectedFieldId(bad.field.id)
        toast(`“${bad.field.name}” — ${bad.message}`, {type: 'error'})
        return false
    }

    const handleSaveEdit = async () => {
        if (!editTarget || !editMeta) return
        if (!validateFieldFormulas()) return
        const refErr = await validateRefName()
        if (refErr) {
            toast(refErr, {type: 'error'})
            return
        }
        const {sheetIdx, sheetId, blockId} = editTarget
        const build = makeFieldBuilder(sheetId, blockId)
        // Existing fields are rebuilt preserving their renderId, so type /
        // validation / required edits take effect while the block's cells stay
        // wired; new fields get a fresh renderId.
        const formBlockFields: FormBlockField[] = fields.map((f) =>
            originalById.has(f.id) ? build(f, f.id) : build(f)
        )
        try {
            await ops.editFormBlock({
                sheetIdx,
                blockId,
                currentColCnt: editMeta.colCnt,
                refName,
                keyIdx: editMeta.keyIdx,
                fields: formBlockFields,
            })
        } catch (e) {
            toast((e as Error).message, {type: 'error'})
            return
        }
        close()
        toast('Block updated successfully!', {type: 'success'})
    }

    const handleSave = async () => {
        if (editTarget) {
            await handleSaveEdit()
            return
        }
        if (!selectedData) return
        if (convertRegion && fields.length !== convertRegion.colCnt) {
            toast(
                `Convert mode needs exactly ${convertRegion.colCnt} field(s) — one per selected column.`,
                {type: 'error'}
            )
            return
        }
        if (!validateFieldFormulas()) return
        const refErr = await validateRefName()
        if (refErr) {
            toast(refErr, {type: 'error'})
            return
        }
        const currentSheetIdx = DATA_SERVICE.getCurrentSheetIdx()
        const currentSheetId = DATA_SERVICE.getCurrentSheetId()
        const blockId = await DATA_SERVICE.getAvailableBlockId(currentSheetIdx)
        if (isErrorMessage(blockId)) {
            toast(blockId.msg, {type: 'error'})
            return
        }

        const build = makeFieldBuilder(currentSheetId, blockId)
        const formBlockFields: FormBlockField[] = fields.map((f) => build(f))
        const {y: row, x: col} = getFirstCell(selectedData)
        const keyIdx = fields.findIndex((f) => f.primary)

        try {
            if (convertRegion) {
                await ops.convertToFormBlock({
                    sheetIdx: currentSheetIdx,
                    blockId,
                    masterRow: row,
                    masterCol: col,
                    rowCnt: convertRegion.rowCnt,
                    colCnt: convertRegion.colCnt,
                    refName,
                    keyIdx,
                    fields: formBlockFields,
                })
            } else {
                await ops.createFormBlock({
                    sheetIdx: currentSheetIdx,
                    blockId,
                    masterRow: row,
                    masterCol: col,
                    refName,
                    keyIdx,
                    fields: formBlockFields,
                })
            }
        } catch (e) {
            toast((e as Error).message, {type: 'error'})
            return
        }

        close()
        toast('Fields configured successfully!', {type: 'success'})
    }

    return (
        <Dialog
            open={true}
            onClose={close}
            maxWidth="lg"
            fullWidth
            PaperProps={{sx: dialogPaperSx}}
        >
            <DialogContent sx={{p: 0, display: 'flex', height: '100%'}}>
                <Box
                    sx={{
                        width: 280,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        bgcolor: 'grey.50',
                    }}
                >
                    {/* Left Panel - Block Ref Name */}
                    <Box
                        sx={{
                            p: 2,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography
                            variant="overline"
                            color="text.secondary"
                            sx={{display: 'block', mb: 1, lineHeight: 1.2}}
                        >
                            Block Ref Name
                        </Typography>
                        <TextField
                            value={refName}
                            onChange={(e) => setRefName(e.target.value)}
                            size="small"
                            fullWidth
                            placeholder="e.g. customers"
                        />
                    </Box>

                    {/* Left Panel - Field List */}
                    <FieldList
                        embedded
                        fields={fields}
                        selectedFieldId={selectedFieldId}
                        onFieldSelect={setSelectedFieldId}
                        onFieldsReorder={setFields}
                        onAddField={handleAddField}
                        lockFieldCount={!!convertRegion}
                    />
                </Box>

                {/* Right Panel - Field Editor */}
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {editLoading ? (
                        <Box
                            sx={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Typography color="text.secondary">
                                Loading block…
                            </Typography>
                        </Box>
                    ) : selectedField ? (
                        <FieldConfigPanel
                            field={selectedField}
                            onUpdate={handleUpdateField}
                            onDelete={() => handleDeleteField(selectedField.id)}
                            onCancel={close}
                            onSave={handleSave}
                            enumSetManager={BLOCK_MANAGER.enumSetManager}
                            fieldManager={BLOCK_MANAGER.fieldManager}
                            localFields={fields}
                            // Existing fields are editable (type / validation /
                            // required) but never deletable — editFormBlock keeps
                            // the column count monotonic. Convert mode also fixes
                            // the field count.
                            canDelete={
                                !convertRegion && !isOriginal(selectedField.id)
                            }
                            // The key column is fixed once a block exists —
                            // editFormBlock always re-binds with the original
                            // keyIdx, so the toggle would be ignored on save.
                            canEditPrimary={!editTarget}
                        />
                    ) : (
                        <Box
                            sx={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Typography color="text.secondary">
                                Select a field to configure
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    )
}
