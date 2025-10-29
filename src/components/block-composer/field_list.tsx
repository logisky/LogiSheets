import {useState, useEffect} from 'react'
import {
    Box,
    Button,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
} from '@mui/material'
import {
    Add as AddIcon,
    DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material'
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from 'react-beautiful-dnd'
import {FieldSetting} from './types'

interface FieldListProps {
    fields: FieldSetting[]
    selectedFieldId: string | null
    onFieldSelect: (id: string) => void
    onFieldsReorder: (fields: FieldSetting[]) => void
    onAddField: () => void
}

export const FieldList = ({
    fields,
    selectedFieldId,
    onFieldSelect,
    onFieldsReorder,
    onAddField,
}: FieldListProps) => {
    const [isDragEnabled, setIsDragEnabled] = useState(false)

    // Enable drag after component mounts to avoid timing issues with react-beautiful-dnd
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsDragEnabled(true)
        }, 100)
        return () => clearTimeout(timer)
    }, [])

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return
        }

        const items = Array.from(fields)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        onFieldsReorder(items)
    }

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
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
                {/* Header with Add Button */}
                <Box
                    sx={{
                        p: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        fullWidth
                        onClick={onAddField}
                        sx={{textTransform: 'none'}}
                    >
                        Add New Field
                    </Button>
                </Box>

                {/* Field List */}
                {isDragEnabled ? (
                    <Droppable droppableId="fields-list">
                        {(provided) => (
                            <List
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                sx={{flex: 1, overflow: 'auto', py: 0}}
                            >
                                {fields.map((field, index) => (
                                    <Draggable
                                        key={field.id}
                                        draggableId={field.id}
                                        index={index}
                                    >
                                        {(provided, snapshot) => (
                                            <ListItem
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                disablePadding
                                                sx={{
                                                    bgcolor: snapshot.isDragging
                                                        ? 'action.hover'
                                                        : 'transparent',
                                                }}
                                            >
                                                <ListItemButton
                                                    selected={
                                                        selectedFieldId ===
                                                        field.id
                                                    }
                                                    onClick={() =>
                                                        onFieldSelect(field.id)
                                                    }
                                                    sx={{
                                                        py: 1.5,
                                                        borderLeft:
                                                            '3px solid transparent',
                                                        '&.Mui-selected': {
                                                            borderLeftColor:
                                                                'primary.main',
                                                            bgcolor:
                                                                'primary.50',
                                                        },
                                                    }}
                                                >
                                                    <Box
                                                        {...provided.dragHandleProps}
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            mr: 1,
                                                            color: 'text.disabled',
                                                        }}
                                                    >
                                                        <DragIndicatorIcon fontSize="small" />
                                                    </Box>
                                                    <ListItemText
                                                        primary={field.name}
                                                        secondary={
                                                            field.type
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                            field.type.slice(1)
                                                        }
                                                        slotProps={{
                                                            primary: {
                                                                style: {
                                                                    fontWeight: 500,
                                                                    fontSize:
                                                                        '0.9rem',
                                                                },
                                                            },
                                                            secondary: {
                                                                style: {
                                                                    fontSize:
                                                                        '0.75rem',
                                                                },
                                                            },
                                                        }}
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </List>
                        )}
                    </Droppable>
                ) : (
                    <List sx={{flex: 1, overflow: 'auto', py: 0}}>
                        {fields.map((field) => (
                            <ListItem key={field.id} disablePadding>
                                <ListItemButton
                                    selected={selectedFieldId === field.id}
                                    onClick={() => onFieldSelect(field.id)}
                                    sx={{
                                        py: 1.5,
                                        borderLeft: '3px solid transparent',
                                        '&.Mui-selected': {
                                            borderLeftColor: 'primary.main',
                                            bgcolor: 'primary.50',
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            mr: 1,
                                            color: 'text.disabled',
                                        }}
                                    >
                                        <DragIndicatorIcon fontSize="small" />
                                    </Box>
                                    <ListItemText
                                        primary={field.name}
                                        secondary={
                                            field.type.charAt(0).toUpperCase() +
                                            field.type.slice(1)
                                        }
                                        slotProps={{
                                            primary: {
                                                style: {
                                                    fontWeight: 500,
                                                    fontSize: '0.9rem',
                                                },
                                            },
                                            secondary: {
                                                style: {
                                                    fontSize: '0.75rem',
                                                },
                                            },
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </Box>
        </DragDropContext>
    )
}
