import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import NumFmtPanel, {type NumFmtPanelHandle} from './num-fmt'
import BorderPanel, {type BorderModel, type BorderPanelHandle} from './border'
import {SelectedData} from 'logisheets-engine'

export interface FormatDialogValue {
    numFmt?: string
    border?: BorderModel
}

export interface FormatDialogContentProps {
    value?: FormatDialogValue
    selectedData: SelectedData
    onChange?: (v: FormatDialogValue) => void
    onCancel?: () => void
}

const TAB_KEYS = ['number', 'alignment', 'font', 'border', 'image'] as const
type TabKey = (typeof TAB_KEYS)[number]

export const FormatDialogContent: React.FC<FormatDialogContentProps> = ({
    selectedData,
    value,
    onChange,
    onCancel,
}) => {
    const [tab, setTab] = React.useState<TabKey>('number')
    const [state, setState] = React.useState<FormatDialogValue>(value ?? {})
    const numRef = React.useRef<NumFmtPanelHandle>(null)
    const borderRef = React.useRef<BorderPanelHandle>(null)

    const setNumFmt = (fmt?: string) => {
        const next = {...state, numFmt: fmt}
        setState(next)
        onChange?.(next)
    }

    return (
        <Box
            sx={{
                width: '100%',
                height: 500,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box sx={{borderBottom: '1px solid #eee', px: 1}}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{minHeight: 42}}
                >
                    {TAB_KEYS.map((k) => (
                        <Tab key={k} value={k} label={k} sx={{minHeight: 42}} />
                    ))}
                </Tabs>
            </Box>

            <Box sx={{flex: 1, minHeight: 0, overflow: 'hidden'}}>
                {tab === 'number' && (
                    <NumFmtPanel
                        ref={numRef}
                        value={state.numFmt}
                        onChange={(fmt) => setNumFmt(fmt)}
                        showActions={false}
                        height={420}
                        selectedData={selectedData}
                    />
                )}
                {tab === 'border' && (
                    <BorderPanel
                        ref={borderRef}
                        value={state.border}
                        onChange={(v) => {
                            const next = {...state, border: v}
                            setState(next)
                            onChange?.(next)
                        }}
                        selectedData={selectedData}
                    />
                )}
                {tab !== 'number' && tab !== 'border' && (
                    <Box sx={{p: 3, color: 'text.secondary'}}>
                        Will be provided later
                    </Box>
                )}
            </Box>

            <Box
                sx={{
                    borderTop: '1px solid #eee',
                    p: 1.5,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1,
                }}
            >
                <Button onClick={onCancel}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={() => {
                        if (tab === 'number') numRef.current?.confirm()
                        else if (tab === 'border') borderRef.current?.confirm()
                        onCancel?.()
                    }}
                >
                    OK
                </Button>
            </Box>
        </Box>
    )
}

export default FormatDialogContent
