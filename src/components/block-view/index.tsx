import {Box, Drawer, IconButton, Stack} from '@mui/material'
import {ChevronRight} from '@mui/icons-material'
import {Selection, SelectedData} from 'logisheets-web'
import {useEffect, useRef} from 'react'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {DataServiceImpl} from '@/core/data'

type BlockViewProps = {
    selectedData?: SelectedData
    onClose: () => void
}

export const BlockView = ({onClose, selectedData}: BlockViewProps) => {
    const iframeSrc = '/markdown-table-extractor/index.html'
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const DATA_SERVICE = useInjection<DataServiceImpl>(TYPES.Data)

    useEffect(() => {
        const iframe = iframeRef.current
        if (!iframe) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = iframe.contentWindow as any
        if (!win) return

        win.selection = {
            sheetIdx: DATA_SERVICE.getCurrentSheetIdx(),
            data: selectedData,
        } as Selection
        win.workbook = DATA_SERVICE.getWorkbook()
    }, [selectedData, DATA_SERVICE])

    return (
        <Box>
            <Drawer
                variant="temporary"
                anchor="right"
                open={true}
                hideBackdrop
                disablePortal
                ModalProps={{
                    keepMounted: true,
                    disableScrollLock: true,
                }}
                sx={{
                    width: '360px',
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: '360px',
                        boxSizing: 'border-box',
                        backgroundColor: '#f2f4f7',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                }}
            >
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="flex-end"
                    sx={{p: 1}}
                >
                    <IconButton size="small" color="default" onClick={onClose}>
                        <ChevronRight />
                    </IconButton>
                </Stack>
                <Box sx={{flex: 1, borderTop: '1px solid #e0e0e0'}}>
                    <iframe
                        ref={iframeRef}
                        src={iframeSrc}
                        style={{
                            border: 'none',
                            width: '100%',
                            height: '100%',
                        }}
                    />
                </Box>
            </Drawer>
        </Box>
    )
}
