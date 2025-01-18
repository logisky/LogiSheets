import {getFirstCell, SelectedData} from '@/components/canvas'
import {ColorResult, SketchPicker} from 'react-color'
import styles from './start.module.scss'
import {useEffect, useState} from 'react'
import {StandardColor, StandardFont} from '@/core/standable'
import {DataService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {isErrorMessage} from 'packages/web/src/api/utils'
import Modal from 'react-modal'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill'
import FromatColorTextIcon from '@mui/icons-material/FormatColorText'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Divider from '@mui/material/Divider'

export * from './font-size'
export * from './start-item'
export * from './set-attr-event'
export * from './start-item-type'
export * from '.'
export interface StartProps {
    readonly selectedData?: SelectedData
}

export const StartComponent = ({selectedData}: StartProps) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const [openSketchPicker, setOpenSketchPicker] = useState(false)
    const [fontColor, setFontColor] = useState('#000')

    const [fontFormats, setFontFormats] = useState<string[]>([])
    const [alignment, setAlignment] = useState<string | null>('left')

    useEffect(() => {
        if (selectedData === undefined) {
            _setDefaultStyle()
            return
        }
        _initStyle()
    }, [selectedData])

    const _setDefaultStyle = () => {
        setFontColor('#000')
    }

    const _initStyle = () => {
        if (!selectedData || !selectedData.data) return
        const cell = getFirstCell(selectedData)
        const {r: row, c: col} = cell
        const sheet = DATA_SERVICE.getCurrentSheetIdx()
        const cellInfo = DATA_SERVICE.getCellInfo(sheet, row, col)
        cellInfo.then((c) => {
            if (isErrorMessage(c)) return
            const style = c.getStyle()
            const font = StandardFont.from(style.font)
            setFontColor(font.standardColor.css())
            const fontFormat = []
            if (font.bold) fontFormat.push('bold')
            if (font.italic) fontFormat.push('italic')
            if (font.underline?.val != 'none') fontFormat.push('underlined')
            setFontFormats(fontFormat)
        })
    }

    const onColorPick = (result: ColorResult) => {
        const {r, g, b, a} = result.rgb
        const standardColor = StandardColor.from(r, g, b, a)
        setFontColor(standardColor.css())
        setOpenSketchPicker(false)
    }

    const handleFontFormat = (
        _: React.MouseEvent<HTMLElement>,
        newFormats: string[]
    ) => {
        if (!selectedData || !selectedData.data) {
            return
        }
    }

    return (
        <div className={styles['host']}>
            <ToggleButton
                value="font-color"
                size="small"
                aria-label="font color formatting"
                onClick={() => setOpenSketchPicker(true)}
            >
                <FromatColorTextIcon />
            </ToggleButton>
            <ToggleButtonGroup
                value={fontFormats}
                size="small"
                onChange={handleFontFormat}
                aria-label="text formatting"
            >
                <ToggleButton value="bold" aria-label="bold">
                    <FormatBoldIcon />
                </ToggleButton>
                <ToggleButton value="italic" aria-label="italic">
                    <FormatItalicIcon />
                </ToggleButton>
                <ToggleButton value="underlined" aria-label="underlined">
                    <FormatUnderlinedIcon />
                </ToggleButton>
                <ToggleButton value="color" aria-label="color" disabled>
                    <FormatColorFillIcon />
                    <ArrowDropDownIcon />
                </ToggleButton>
            </ToggleButtonGroup>
            <Divider flexItem orientation="vertical" sx={{mx: 0.5, my: 1}} />
            <ToggleButtonGroup
                value={alignment}
                exclusive
                size="small"
                // onChange={handleAlignment}
                aria-label="text alignment"
            >
                <ToggleButton value="left" aria-label="left aligned">
                    <FormatAlignLeftIcon />
                </ToggleButton>
                <ToggleButton value="center" aria-label="centered">
                    <FormatAlignCenterIcon />
                </ToggleButton>
                <ToggleButton value="right" aria-label="right aligned">
                    <FormatAlignRightIcon />
                </ToggleButton>
                <ToggleButton value="justify" aria-label="justified" disabled>
                    <FormatAlignJustifyIcon />
                </ToggleButton>
            </ToggleButtonGroup>
            <Divider flexItem orientation="vertical" sx={{mx: 0.5, my: 1}} />
            {openSketchPicker ? (
                <Modal
                    isOpen={true}
                    shouldCloseOnEsc={true}
                    shouldCloseOnOverlayClick={true}
                    onRequestClose={() => setOpenSketchPicker(false)}
                    className={styles['modal-content']}
                    overlayClassName={styles['modal-overlay']}
                    style={{content: {top: '100px', left: '0px'}}}
                >
                    <SketchPicker
                        color={fontColor}
                        onChangeComplete={onColorPick}
                        className={styles['color-picker']}
                    />
                </Modal>
            ) : null}
        </div>
    )
}
