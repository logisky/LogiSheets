import {useState} from 'react'
import {Box, Typography, Dialog, DialogContent} from '@mui/material'
import {getSelectedCellRange, SelectedData} from '../canvas'
import {useToast} from '@/ui/notification/useToast'
import {TYPES} from '@/core/ioc/types'
import {useInjection} from '@/core/ioc/provider'
import {DataServiceImpl as DataService} from '@/core/data'
import {FieldList} from './field_list'
import {FieldConfigPanel} from './config_panel'
import {FieldSetting, COLORS} from './types'

export * from './types'

export interface BlockComposerProps {
    selectedData?: SelectedData
    close: () => void
}

export const BlockComposerComponent = (props: BlockComposerProps) => {
    const {selectedData, close} = props
    const {toast} = useToast()
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)

    const [fields, setFields] = useState<FieldSetting[]>([
        {
            id: '1',
            name: 'Customer Status',
            type: 'enum',
            description: 'Current status of the customer',
            required: true,
            showInSummary: true,
            enumValues: [
                {
                    id: '1',
                    label: 'Active',
                    description: 'Active customers',
                    color: COLORS[0],
                },
                {
                    id: '2',
                    label: 'Pending',
                    description: 'Pending approval',
                    color: COLORS[1],
                },
                {
                    id: '3',
                    label: 'Inactive',
                    description: 'Inactive accounts',
                    color: COLORS[2],
                },
            ],
            defaultValue: '1',
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
            showInSummary: false,
            enumValues: [],
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

    const handleSave = () => {
        toast('Fields configured successfully!', {type: 'success'})
        close()
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
