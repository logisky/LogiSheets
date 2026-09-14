// One field rule — a value formula or a validation rule — as a text box with
// the block's own placeholders offered underneath.
//
// Shared by the composer (authoring a block that does not exist yet) and the
// grid's per-field dialog (editing a live one) so the two cannot drift on what
// a rule may say or how it explains itself.

import {useEffect, useRef} from 'react'
import {useTranslation} from 'react-i18next'
import {Box, Chip, Stack, TextField, Typography} from '@mui/material'
import {FieldRuleKind, validateRuleText} from './field-formula'

export interface FieldRuleEditorProps {
    kind: FieldRuleKind
    /** The field this rule belongs to — excluded from the sibling chips. */
    fieldName: string
    /** Every field name in the block, including `fieldName`. */
    allFieldNames: readonly string[]
    value: string
    onChange: (next: string) => void
    /** Rendered under the box when the rule checks out. */
    helperText: string
    label?: string
    placeholder?: string
    autoFocus?: boolean
}

/** The error to show for a rule, or `null`. Exported so a save can reuse it. */
export function ruleError(
    kind: FieldRuleKind,
    value: string,
    fieldName: string,
    allFieldNames: readonly string[]
): string | null {
    return validateRuleText(kind, value, fieldName, allFieldNames)
}

export const FieldRuleEditor = ({
    kind,
    fieldName,
    allFieldNames,
    value,
    onChange,
    helperText,
    label,
    placeholder,
    autoFocus,
}: FieldRuleEditorProps) => {
    const {t} = useTranslation()
    const inputRef = useRef<HTMLInputElement>(null)
    const pendingCaret = useRef<number | null>(null)

    const error = ruleError(kind, value, fieldName, allFieldNames)

    // Splice a placeholder in at the caret (or append when the box isn't
    // focused), then put the caret after it so several inserts compose into
    // one expression. The box is controlled, so the caret has to be restored
    // AFTER React has written the new value into the DOM — hence the ref plus
    // effect rather than setting it here, which the re-render would undo.
    const insert = (snippet: string) => {
        const input = inputRef.current
        const at =
            input && document.activeElement === input
                ? input.selectionStart ?? value.length
                : value.length
        pendingCaret.current = at + snippet.length
        onChange(value.slice(0, at) + snippet + value.slice(at))
    }

    useEffect(() => {
        const caret = pendingCaret.current
        if (caret === null) return
        pendingCaret.current = null
        const el = inputRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(caret, caret)
    })

    return (
        <Box>
            <TextField
                fullWidth
                size="small"
                label={label}
                inputRef={inputRef}
                autoFocus={autoFocus}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                error={!!error}
                helperText={error ?? helperText}
            />
            {/* The placeholders are the whole point of a field rule and are
                easy to get subtly wrong by hand (a field since renamed, a
                quote missed), so offer them as the block actually defines
                them. */}
            <Stack
                direction="row"
                spacing={0.5}
                useFlexGap
                flexWrap="wrap"
                sx={{mt: 1, alignItems: 'center'}}
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{mr: 0.5}}
                >
                    {t('block.rule.insert')}
                </Typography>
                {kind === 'validation' && (
                    <Chip
                        size="small"
                        variant="outlined"
                        label="#PLACEHOLDER"
                        onClick={() => insert('#PLACEHOLDER')}
                    />
                )}
                {allFieldNames
                    .filter(
                        // A value formula cannot read its own column — that is
                        // the cell being computed. A validation rule can, but
                        // `#PLACEHOLDER` says it better, so leave it out of
                        // both.
                        (n) => n !== fieldName && n.trim() !== ''
                    )
                    .map((n) => (
                        <Chip
                            key={n}
                            size="small"
                            variant="outlined"
                            label={n}
                            onClick={() =>
                                insert(`#FIELD("${n.replace(/"/g, '""')}")`)
                            }
                        />
                    ))}
                <Chip
                    size="small"
                    variant="outlined"
                    label="#KEY"
                    onClick={() => insert('#KEY')}
                />
            </Stack>
        </Box>
    )
}

/**
 * Translation keys, not text: these are module-level constants shared by three
 * dialogs, and the language can change under them. Callers resolve with `t()`.
 */

/** The helper text each rule kind shows when it checks out. */
export const RULE_HELPER_TEXT: Record<FieldRuleKind, string> = {
    value: 'block.rule.valueHelp',
    validation: 'block.rule.validationHelp',
}

/** The placeholder each rule kind shows in an empty box. */
export const RULE_PLACEHOLDER: Record<FieldRuleKind, string> = {
    value: 'block.rule.valuePlaceholder',
    validation: 'block.rule.validationPlaceholder',
}

/** The dialog title for each rule kind. */
export const RULE_TITLE: Record<FieldRuleKind, string> = {
    value: 'block.rule.valueTitle',
    validation: 'block.rule.validationTitle',
}
