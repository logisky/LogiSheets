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
import {useEngine, useOps} from '@/core/engine/provider'
import type {FieldInfo, FieldTypeEnum} from 'logisheets-engine'
import {FieldList} from './field_list'
import {FieldConfigPanel} from './config_panel'
import {dialogPaperSx, buttonSx, primaryButtonSx, sectionLabelSx} from './styles'
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
     * v1 contract — **existing fields are immutable pass-throughs**: they are
     * shown read-only, cannot be deleted, renamed, or re-typed (which would
     * break `BLOCKREF` / `#FIELD` references). Editing is limited to renaming
     * the block and APPENDING new fields at the end. This keeps the column
     * count monotonically non-decreasing, so only a tail resize is needed and
     * no existing cell/formula is disturbed.
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
            // The field *type* only lives host-side in FieldManager (keyed by
            // renderId == FieldInfo.id). Use it for a read-only type label; a
            // block loaded from file with no host state falls back to 'string'.
            const infoByRender = new Map(
                BLOCK_MANAGER.fieldManager
                    .getByBlock(editTarget.sheetId, editTarget.blockId)
                    .map((fi) => [fi.id, fi])
            )
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
                const fi = infoByRender.get(fe.renderId)
                return {
                    id: fe.renderId,
                    name: fe.field,
                    type: (fi?.type.type ?? 'string') as FieldSetting['type'],
                    required: fi?.required ?? false,
                    primary: fe.idx === keyIdx,
                }
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
        (field: FieldSetting): FormBlockField => {
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
            } else if (field.type === 'fieldRef') {
                const {sheetId: rSheetId, blockId: bid} = resolveRefTarget(field)
                ty = {
                    type: 'fieldRef',
                    sheetId: rSheetId,
                    blockId: bid,
                    fieldName: field.refFieldName!,
                    validation: composeRefValidation(field),
                }
            } else {
                // multiSelectRef — no auto-validation in v1 (see create path).
                const {sheetId: rSheetId, blockId: bid} = resolveRefTarget(field)
                ty = {
                    type: 'multiSelectRef',
                    sheetId: rSheetId,
                    blockId: bid,
                    fieldName: field.refFieldName!,
                    validation: '',
                }
            }
            const isUnique = !!field.unique || !!field.primary
            const f: FieldInfo = {
                id: field.id,
                sheetId,
                blockId,
                name: field.name,
                type: ty,
                description: field.description,
                required: field.required,
                unique: isUnique,
            }
            const r = BLOCK_MANAGER.fieldManager.create(sheetId, blockId, f)

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
            return {
                name: field.name,
                renderId: r.id,
                valueFormula: field.valueFormula ?? '',
                diyRender,
                numFmt,
            }
        }

    const handleSaveEdit = async () => {
        if (!editTarget || !editMeta) return
        const {sheetIdx, sheetId, blockId} = editTarget
        const build = makeFieldBuilder(sheetId, blockId)
        // Existing fields pass through verbatim (keep renderId); only the
        // appended new fields are registered/built.
        const formBlockFields: FormBlockField[] = fields.map((f) => {
            const original = originalById.get(f.id)
            return original ?? build(f)
        })
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
        const currentSheetIdx = DATA_SERVICE.getCurrentSheetIdx()
        const currentSheetId = DATA_SERVICE.getCurrentSheetId()
        const blockId = await DATA_SERVICE.getAvailableBlockId(currentSheetIdx)
        if (isErrorMessage(blockId)) {
            toast(blockId.msg, {type: 'error'})
            return
        }

        const build = makeFieldBuilder(currentSheetId, blockId)
        const formBlockFields: FormBlockField[] = fields.map(build)
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
                    ) : selectedField && isOriginal(selectedField.id) ? (
                        <Box
                            sx={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <Box
                                sx={{
                                    p: 3,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0.75,
                                    flex: 1,
                                }}
                            >
                                <Typography sx={sectionLabelSx}>
                                    Existing field
                                </Typography>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                >
                                    {selectedField.name}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    Type: {selectedField.type}
                                    {selectedField.primary ? ' · key' : ''}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{mt: 1}}
                                >
                                    Existing fields can’t be renamed, re-typed,
                                    or deleted in this version (that would break
                                    references). Use “Add New Field” on the left
                                    to append new fields.
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    p: 2,
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: 1,
                                    borderTop: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <Button onClick={close} sx={buttonSx}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    disableElevation
                                    onClick={handleSave}
                                    sx={primaryButtonSx}
                                >
                                    Save Changes
                                </Button>
                            </Box>
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
                            canDelete={!convertRegion}
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
