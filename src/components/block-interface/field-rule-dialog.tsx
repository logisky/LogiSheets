// Edit ONE rule on ONE field of a live block, straight from the grid.
//
// The composer can do this too, but it opens the block's whole schema to reach
// it. Wanting to change what a column computes, or what it accepts, is a small
// and frequent enough thing to deserve its own door — and it is the one edit
// that is safe to make on a block already full of records, because the engine
// re-materializes every row from the new rule.

import {useEffect, useState} from 'react'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material'
import {
    FieldRuleEditor,
    RULE_HELPER_TEXT,
    RULE_PLACEHOLDER,
    ruleError,
} from '@/components/block-composer/field-rule-editor'
import type {FieldRuleKind} from '@/components/block-composer/field-formula'

export interface FieldRuleDialogProps {
    kind: FieldRuleKind
    fieldName: string
    /** Every field name in the block, including `fieldName`. */
    allFieldNames: readonly string[]
    /** The rule as it currently stands; '' when the field has none. */
    initialValue: string
    onSave: (rule: string) => void
    onClose: () => void
}

const TITLE: Record<FieldRuleKind, string> = {
    value: 'Field formula',
    validation: 'Validation rule',
}

export const FieldRuleDialog = ({
    kind,
    fieldName,
    allFieldNames,
    initialValue,
    onSave,
    onClose,
}: FieldRuleDialogProps) => {
    const [value, setValue] = useState(initialValue)

    // Re-seed when the dialog is pointed at a different field or rule without
    // unmounting in between.
    useEffect(() => {
        setValue(initialValue)
    }, [initialValue, kind, fieldName])

    const error = ruleError(kind, value, fieldName, allFieldNames)
    const unchanged = value.trim() === initialValue.trim()

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{pb: 0.5}}>
                {TITLE[kind]}
                <Typography variant="body2" color="text.secondary">
                    {fieldName}
                </Typography>
            </DialogTitle>
            <DialogContent sx={{pt: 2}}>
                <FieldRuleEditor
                    kind={kind}
                    fieldName={fieldName}
                    allFieldNames={allFieldNames}
                    value={value}
                    onChange={setValue}
                    autoFocus
                    placeholder={RULE_PLACEHOLDER[kind]}
                    helperText={
                        // Clearing the box is a real operation, not a no-op, so
                        // say so rather than leaving the person to guess whether
                        // an empty save sticks.
                        initialValue.trim() !== '' && value.trim() === ''
                            ? 'Saving with the box empty removes this rule from every row.'
                            : RULE_HELPER_TEXT[kind]
                    }
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{textTransform: 'none'}}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={!!error || unchanged}
                    onClick={() => onSave(value.trim())}
                    sx={{textTransform: 'none'}}
                >
                    Apply
                </Button>
            </DialogActions>
        </Dialog>
    )
}
