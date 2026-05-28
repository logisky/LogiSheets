import {useState} from 'react'
import {Box, Typography, Dialog, DialogContent, TextField} from '@mui/material'
import {getSelectedCellRange} from 'logisheets-engine'
import {
    BindFormSchemaBuilder,
    SelectedData,
    UpsertFieldRenderInfoBuilder,
    getFirstCell,
} from 'logisheets-engine'
import {useToast} from '@/ui/notification/useToast'
import {useEngine} from '@/core/engine/provider'
import type {FieldInfo, FieldTypeEnum} from 'logisheets-engine'
import {FieldList} from './field_list'
import {FieldConfigPanel} from './config_panel'
import {FieldSetting} from './types'
import {CreateBlockBuilder, isErrorMessage, Payload} from 'logisheets-engine'
import {tx} from '@/core/transaction'

export * from './types'

export interface BlockComposerProps {
    selectedData?: SelectedData
    close: () => void
}

export const BlockComposerComponent = (props: BlockComposerProps) => {
    const {selectedData, close} = props
    const {toast} = useToast()
    const engine = useEngine()
    const DATA_SERVICE = engine.getDataService()
    const BLOCK_MANAGER = engine.getBlockManager()

    const [fields, setFields] = useState<FieldSetting[]>([
        {
            id: '1',
            name: 'Customer Status',
            type: 'string',
            description: 'Current status of the customer',
            required: true,
            primary: false,
        },
    ])
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
            // Empty-string valueFormula is treated as "no template" so
            // the composer doesn't accidentally mark every untouched
            // string/number field as constrained.
            const valueFormula =
                field.valueFormula && field.valueFormula.trim()
                    ? field.valueFormula.trim()
                    : undefined
            const f: FieldInfo = {
                id: field.id,
                sheetId: currentSheetId,
                blockId,
                name: field.name,
                type: ty,
                description: field.description,
                required: field.required,
                unique: isUnique,
                valueFormula,
            }
            const r = BLOCK_MANAGER.fieldManager.create(
                currentSheetId,
                blockId,
                f
            )
            return [r.id, r]
        })
        const {y: row, x: col} = getFirstCell(selectedData)
        const len = fs.length
        // check if the block range is available

        const payloads: Payload[] = []
        const createBlockPayload: Payload = {
            type: 'createBlock',
            value: new CreateBlockBuilder()
                .sheetIdx(currentSheetIdx)
                .id(blockId)
                .masterRow(row)
                .masterCol(col)
                .rowCnt(1)
                .colCnt(len)
                .build(),
        }
        payloads.push(createBlockPayload)
        const keyIdx = fields.findIndex((f) => f.primary)

        const bindFormSchemaPayload: Payload = {
            type: 'bindFormSchema',
            value: new BindFormSchemaBuilder()
                .refName(refName)
                .sheetIdx(currentSheetIdx)
                .blockId(blockId)
                .fieldFrom(0)
                .row(true)
                .keyIdx(keyIdx < 0 ? 0 : keyIdx)
                .fields(fs.map((f) => f[1].name))
                .renderIds(fs.map((f) => f[0]))
                // Per-field value-formula templates (#FIELD("X") / #KEY).
                // The composer's FieldSetting carries `valueFormula`;
                // forward it (empty string for free-form fields).
                .fieldFormulas(fields.map((f) => f.valueFormula ?? ''))
                .build(),
        }
        payloads.push(bindFormSchemaPayload)

        fs.forEach(([fieldId, field], i) => {
            let diyRender = false
            let formatter = ''
            switch (field.type.type) {
                case 'image':
                case 'enum':
                case 'multiSelect':
                case 'boolean':
                case 'fieldRef':
                case 'multiSelectRef':
                    diyRender = true
                    break
                case 'string':
                    break
                case 'datetime':
                case 'number':
                    formatter = field.type.formatter
                    break
                default:
                    break
            }
            const p = new UpsertFieldRenderInfoBuilder()
                .renderId(fieldId)
                .diyRender(diyRender)
                .styleUpdate({
                    setNumFmt: formatter,
                })
                .build()
            payloads.push({type: 'upsertFieldRenderInfo', value: p})
        })

        const result = await DATA_SERVICE.handleTransaction(tx(payloads, true))
        if (isErrorMessage(result)) {
            toast(result.msg, {type: 'error'})
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
