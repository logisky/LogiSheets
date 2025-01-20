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
import {generateAlgnmentPayload, generateFontPayload} from './payload'
import {Transaction, Alignment, HorizontalAlignment} from 'logisheets-web'

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

    const [fontBold, setFontBold] = useState(false)
    const [fontItalic, setFontItalic] = useState(false)
    const [fontUnderlined, setFontUnderline] = useState(false)
    const [alignment, setAlignment] = useState<string | null>(null)

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
            const alignment = style.alignment
            if (alignment) {
                const hAlign = alignment.horizontal
                if (hAlign) {
                    if (hAlign === 'center') {
                        setAlignment('center')
                    } else if (hAlign === 'left') {
                        setAlignment('left')
                    } else if (hAlign === 'right') {
                        setAlignment('right')
                    } else {
                        setAlignment(null)
                    }
                } else {
                    setAlignment(null)
                }
            } else {
                setAlignment(null)
            }
            const font = StandardFont.from(style.font)
            setFontColor(font.standardColor.css())
            setFontBold(font.bold)
            setFontItalic(font.italic)
            const v =
                font.underline === undefined
                    ? false
                    : font.underline.val != 'none'
            setFontUnderline(v)
        })
    }

    const onColorPick = (result: ColorResult) => {
        if (!selectedData) return
        const {r, g, b, a} = result.rgb
        const standardColor = StandardColor.from(r, g, b, a)
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {color: standardColor.argb()}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            (resp) => {
                if (!resp) {
                    setFontColor(standardColor.css())
                    setOpenSketchPicker(false)
                }
            }
        )
    }

    const onFontBoldClick = () => {
        if (!selectedData) return
        const v = !fontBold
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {bold: v}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            (resp) => {
                if (!resp) setFontBold(v)
            }
        )
    }

    const onFontUnderlineClick = () => {
        if (!selectedData) return
        const v = !fontUnderlined
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {underline: v}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            (resp) => {
                if (!resp) setFontUnderline(v)
            }
        )
    }

    const onFontItalicClick = () => {
        if (!selectedData) return
        const v = !fontItalic
        const payloads = generateFontPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {italic: v}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            (resp) => {
                if (!resp) setFontItalic(v)
            }
        )
    }

    const handleAlignment = (
        _event: React.MouseEvent<HTMLElement>,
        v: string | null
    ) => {
        if (!selectedData || !v) return
        const hAlign = v as HorizontalAlignment
        const payloads = generateAlgnmentPayload(
            DATA_SERVICE.getCurrentSheetIdx(),
            selectedData,
            {horizontal: hAlign}
        )
        DATA_SERVICE.handleTransaction(new Transaction(payloads, true)).then(
            (resp) => {
                if (!resp) setAlignment(v)
            }
        )
    }

    return (
        <div className={styles['host']}>
            <ToggleButton
                style={{color: fontColor}}
                value="font-color"
                size="small"
                aria-label="font color formatting"
                onClick={() => setOpenSketchPicker(true)}
            >
                <FromatColorTextIcon />
            </ToggleButton>
            <ToggleButton
                value="bold"
                aria-label="bold"
                size="small"
                selected={fontBold}
                onClick={onFontBoldClick}
            >
                <FormatBoldIcon />
            </ToggleButton>
            <ToggleButton
                value="italic"
                aria-label="italic"
                size="small"
                selected={fontItalic}
                onClick={onFontItalicClick}
            >
                <FormatItalicIcon />
            </ToggleButton>
            <ToggleButton
                value="underlined"
                aria-label="underlined"
                size="small"
                selected={fontUnderlined}
                onClick={onFontUnderlineClick}
            >
                <FormatUnderlinedIcon />
            </ToggleButton>
            {/* <ToggleButton value="color" aria-label="color" disabled>
                <FormatColorFillIcon />
                <ArrowDropDownIcon />
            </ToggleButton> */}
            <Divider flexItem orientation="vertical" sx={{mx: 0.5, my: 1}} />
            <ToggleButtonGroup
                value={alignment}
                exclusive
                size="small"
                onChange={handleAlignment}
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
            <Modal
                isOpen={openSketchPicker}
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
        </div>
    )
}
