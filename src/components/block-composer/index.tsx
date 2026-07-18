import {useState} from 'react'
import {Box, Typography, Dialog, DialogContent, TextField} from '@mui/material'
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
}

export const BlockComposerComponent = (props: BlockComposerProps) => {
    const {selectedData, close, convertRegion} = props
    const {toast} = useToast()
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
    const ops = useOps()
    const BLOCK_MANAGER = engine.getBlockManager()

    const [fields, setFields] = useState<FieldSetting[]>(() =>
        convertRegion
            ? Array.from({length: convertRegion.colCnt}, (_, i) => ({
                  id: String(i + 1),
                  name: `Field ${i + 1}`,
                  type: 'number',
                  required: false,
                  primary: i === 0,
              }))
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

    if (!selectedData) {
        return null
    }
    const range = getSelectedCellRange(selectedData)
    if (!range) {
        return null
    }
    const [refName, setRefName] = useState('')

    const selectedField = fields.find((f) => f.id === selectedFieldId)

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
        setFields(fields.filter((f) => f.id !== id))
        if (selectedFieldId === id) {
            setSelectedFieldId(fields[0]?.id || null)
        }
    }

    const handleSave = async () => {
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

        let ty: FieldTypeEnum

        // Compose the final validation formula for string/number fields by
        // joining the user-typed rule with a generated uniqueness check.
        // The unique check uses BLOCKREFSB to read every value in this field
        // across the whole block, then COUNTIF to ensure the current value
        // appears exactly once. #PLACEHOLDER expands to the cell's value at
        // evaluation time.
        const composeValidation = (field: FieldSetting): string => {
            const userValidation = (field.validation ?? '').trim()
            if (!field.unique) return userValidation
            const escapedName = field.name.replace(/"/g, '""')
            const uniqueCheck = `COUNTIF(BLOCKREFSB(${currentSheetId}, ${blockId}, "*", "${escapedName}"), #PLACEHOLDER) = 1`
            if (!userValidation) return uniqueCheck
            return `AND(${userValidation}, ${uniqueCheck})`
        }

        // For a fieldRef cell we auto-inject an existence check pointing at
        // the target block: any value picked from the dropdown should still
        // be present there. If the source row is later deleted/renamed the
        // ref becomes dangling and surfaces via the existing validation
        // warning indicator. For a self-ref target we resolve to the block
        // being composed (its id was allocated above).
        const resolveRefTarget = (
            field: FieldSetting
        ): {sheetId: number; blockId: number} => {
            if (field.refSelf) {
                return {sheetId: currentSheetId, blockId}
            }
            return {
                sheetId: field.refSheetId!,
                blockId: field.refBlockId!,
            }
        }
        const composeRefValidation = (field: FieldSetting): string => {
            const {sheetId, blockId: bid} = resolveRefTarget(field)
            const escapedName = (field.refFieldName ?? '').replace(/"/g, '""')
            return `COUNTIF(BLOCKREFSB(${sheetId}, ${bid}, "*", "${escapedName}"), #PLACEHOLDER) >= 1`
        }

        const fs: [string, FieldInfo][] = fields.map((field) => {
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
                const {sheetId, blockId: bid} = resolveRefTarget(field)
                ty = {
                    type: 'fieldRef',
                    sheetId,
                    blockId: bid,
                    fieldName: field.refFieldName!,
                    validation: composeRefValidation(field),
                }
            } else if (field.type === 'multiSelectRef') {
                // multiSelectRef stores a comma-separated string of values.
                // Auto-validation isn't injected for v1 — a CSV value would
                // require splitting + per-item COUNTIF, which the existing
                // ValidationCell shadow-cell pipeline doesn't natively
                // express. The dropdown only offers existing target values,
                // so well-behaved edits stay valid; renames in the source
                // block will silently produce dangling refs until v2.
                const {sheetId, blockId: bid} = resolveRefTarget(field)
                ty = {
                    type: 'multiSelectRef',
                    sheetId,
                    blockId: bid,
                    fieldName: field.refFieldName!,
                    validation: '',
                }
            }
            // Primary keys are unique by definition; stamp it so cross-block
            // enumeration doesn't have to special-case them.
            const isUnique = !!field.unique || !!field.primary
            // valueFormula was previously stored on FieldInfo for the
            // composer's edit-time use; post-Phase-1+2 the template is
            // engine-managed and reachable via `BlockInfo.schema.fields[i]
            // .valueFormula`. FieldSetting still carries it for the
            // composer form, but we no longer mirror it onto FieldInfo.
            const f: FieldInfo = {
                id: field.id,
                sheetId: currentSheetId,
                blockId,
                name: field.name,
                type: ty,
                description: field.description,
                required: field.required,
                unique: isUnique,
            }
            const r = BLOCK_MANAGER.fieldManager.create(
                currentSheetId,
                blockId,
                f
            )
            return [r.id, r]
        })
        const {y: row, x: col} = getFirstCell(selectedData)
        const keyIdx = fields.findIndex((f) => f.primary)

        // Flatten each resolved field into the engine-neutral shape the
        // operation layer needs; the validation/FieldInfo composition and
        // FieldManager registration above stay here (engine render state).
        const formBlockFields: FormBlockField[] = fs.map(([fieldId, field], i) => {
            let diyRender = false
            let numFmt = ''
            switch (field.type.type) {
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
                    numFmt = field.type.formatter
                    break
                default:
                    break
            }
            return {
                name: field.name,
                renderId: fieldId,
                valueFormula: fields[i].valueFormula ?? '',
                diyRender,
                numFmt,
            }
        })

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
            PaperProps={{sx: {height: '80vh'}}}
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
                    {selectedField ? (
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
