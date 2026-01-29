import {useState} from 'react'
import {Box, Typography, Dialog, DialogContent, TextField} from '@mui/material'
import {getSelectedCellRange} from '../canvas'
import {
    BindFormSchemaBuilder,
    SelectedData,
    UpsertFieldRenderInfoBuilder,
    getFirstCell,
} from 'logisheets-web'
import {useToast} from '@/ui/notification/useToast'
import {TYPES} from '@/core/ioc/types'
import {useInjection} from '@/core/ioc/provider'
import {DataServiceImpl as DataService} from '@/core/data'
import {BlockManager, FieldInfo, FieldTypeEnum} from '@/core/data/block'
import {FieldList} from './field_list'
import {FieldConfigPanel} from './config_panel'
import {FieldSetting} from './types'
import {
    CreateBlockBuilder,
    isErrorMessage,
    Payload,
    SetBlockLineNameFieldBuilder,
    SetBlockLineNumFmtBuilder,
    Transaction,
} from 'logisheets-web'

export * from './types'

export interface BlockComposerProps {
    selectedData?: SelectedData
    close: () => void
}

export const BlockComposerComponent = (props: BlockComposerProps) => {
    const {selectedData, close} = props
    const {toast} = useToast()
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const BLOCK_MANAGER = useInjection<BlockManager>(TYPES.BlockManager)

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
                ty = {type: 'string', validation: field.validation ?? ''}
            } else if (field.type === 'number') {
                ty = {
                    type: 'number',
                    validation: field.validation ?? '',
                    formatter: field.format ?? '',
                }
            } else if (field.type === 'image') {
                ty = {type: 'image'}
            }
            const f: FieldInfo = {
                id: field.id,
                sheetId: currentSheetId,
                blockId,
                name: field.name,
                type: ty,
                description: field.description,
                required: field.required,
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

        const result = await DATA_SERVICE.handleTransaction(
            new Transaction(payloads, true)
        )
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
