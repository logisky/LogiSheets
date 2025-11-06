import {useState} from 'react'
import {Box, Typography, Dialog, DialogContent} from '@mui/material'
import {getFirstCell, getSelectedCellRange, SelectedData} from '../canvas'
import {useToast} from '@/ui/notification/useToast'
import {TYPES} from '@/core/ioc/types'
import {useInjection} from '@/core/ioc/provider'
import {DataServiceImpl as DataService} from '@/core/data'
import {CraftManager, FieldInfo, FieldTypeEnum} from '@/core/data/craft'
import {FieldList} from './field_list'
import {FieldConfigPanel} from './config_panel'
import {FieldSetting, COLORS} from './types'
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
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)

    const [fields, setFields] = useState<FieldSetting[]>([
        {
            id: '1',
            name: 'Customer Status',
            type: 'string',
            description: 'Current status of the customer',
            required: true,
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

    const selectedField = fields.find((f) => f.id === selectedFieldId)

    const handleAddField = () => {
        const newField: FieldSetting = {
            id: Date.now().toString(),
            name: 'New Field',
            type: 'string',
            required: false,
        }
        setFields([...fields, newField])
        setSelectedFieldId(newField.id)
    }

    const handleUpdateField = (field: FieldSetting) => {
        setFields(fields.map((f) => (f.id === field.id ? field : f)))
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
            const r = CRAFT_MANAGER.fieldManager.create(
                currentSheetId,
                blockId,
                f
            )
            return [r.id, f]
        })
        const {r: row, c: col} = getFirstCell(selectedData)
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

        fs.forEach(([fieldId, field], i) => {
            let diyRender = false
            switch (field.type.type) {
                case 'enum':
                case 'multiSelect':
                    diyRender = true
                    break
                case 'datetime': {
                    const formatter = field.type.formatter
                    const p = new SetBlockLineNumFmtBuilder()
                        .sheetIdx(currentSheetIdx)
                        .blockId(blockId)
                        .from(i)
                        .to(i)
                        .isRow(false)
                        .numFmt(formatter)
                        .build()
                    const payload: Payload = {
                        type: 'setBlockLineNumFmt',
                        value: p,
                    }
                    payloads.push(payload)
                    break
                }
                case 'boolean':
                case 'string':
                    break
                case 'number': {
                    const formatter = field.type.formatter
                    const p = new SetBlockLineNumFmtBuilder()
                        .sheetIdx(currentSheetIdx)
                        .blockId(blockId)
                        .from(i)
                        .to(i)
                        .isRow(false)
                        .numFmt(formatter)
                        .build()
                    const payload: Payload = {
                        type: 'setBlockLineNumFmt',
                        value: p,
                    }
                    payloads.push(payload)
                    break
                }
                default:
                    break
            }

            const p = new SetBlockLineNameFieldBuilder()
                .sheetIdx(currentSheetIdx)
                .blockId(blockId)
                .line(i)
                .isRow(false)
                .fieldId(fieldId)
                .name(field.name)
                .diyRender(diyRender)
                .build()
            const payload: Payload = {
                type: 'setBlockLineNameField',
                value: p,
            }
            payloads.push(payload)
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
                {/* Left Panel - Field List */}
                <FieldList
                    fields={fields}
                    selectedFieldId={selectedFieldId}
                    onFieldSelect={setSelectedFieldId}
                    onFieldsReorder={setFields}
                    onAddField={handleAddField}
                />

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
                            enumSetManager={CRAFT_MANAGER.enumSetManager}
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
