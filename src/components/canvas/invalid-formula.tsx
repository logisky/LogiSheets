import {Box, Typography, Button, Alert, AlertTitle, Stack} from '@mui/material'

export interface InvalidFormulaProps {
    close$: () => void
}
export const InvalidFormulaComponent = ({close$}: InvalidFormulaProps) => {
    return (
        <Box
            sx={{
                p: 2,
                minWidth: 320,
                maxWidth: 480,
            }}
        >
            <Stack spacing={2}>
                <Alert severity="error">
                    <AlertTitle>Invalid Formula</AlertTitle>
                    <Typography variant="body2" sx={{mb: 1}}>
                        The formula you typed contains an error.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        If you are not typing a formula, please add a single
                        quote before the first character.
                    </Typography>
                </Alert>
                <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                    <Button
                        variant="contained"
                        onClick={close$}
                        sx={{textTransform: 'none'}}
                    >
                        OK
                    </Button>
                </Box>
            </Stack>
        </Box>
    )
}
