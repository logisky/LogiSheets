import {useState, FC, useEffect} from 'react'
import {
    CreateSheetBuilder,
    isErrorMessage,
    Payload,
    SheetInfo,
    Transaction,
} from 'logisheets-engine'
import {useEngine} from '@/core/engine/provider'
import {StandardColor} from '@/core/standable'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import {ContextMenuComponent} from './contextmenu'
import styles from './sheets-tab.module.scss'

export interface SheetTabProps {
    activeSheet: number
    activeSheet$: (s: number) => void
}

export const SheetsTabComponent: FC<SheetTabProps> = ({
    activeSheet,
    activeSheet$,
}) => {
    const engine = useEngine()
    const workbook = engine.getWorkbook()
    const dataService = engine.getDataService()
    const [sheets, setSheets] = useState([] as readonly SheetInfo[])
    const [isOpen, setIsOpen] = useState(false)
    const [modalPosition, setModalPosition] = useState({
        top: 0,
        left: 0,
        tabTop: 0,
        tabLeft: 0,
        tabWidth: 0,
        tabHeight: 0,
    })

    useEffect(() => {
        workbook.getAllSheetInfo().then((v) => {
            if (isErrorMessage(v)) return
            setSheets(v)
        })

        // Listen for sheet changes
        const handleSheetChange = (newSheets: readonly SheetInfo[]) => {
            setSheets(newSheets)
        }
        engine.on('sheetChange', handleSheetChange)

        return () => {
            engine.off('sheetChange', handleSheetChange)
        }
    }, [engine, workbook])

    // Clamp active index to available tab range when sheets change
    useEffect(() => {
        if (sheets.length === 0) return
        if (activeSheet >= sheets.length) {
            activeSheet$(Math.max(0, sheets.length - 1))
        }
    }, [sheets, activeSheet, activeSheet$])

    const onTabChange = (_: unknown, idx: number) => {
        activeSheet$(idx)
    }

    const addSheet = () => {
        const newSheetName = findNewSheetName(sheets.map((s) => s.name))
        const newIdx = sheets.length
        const payload: Payload = {
            type: 'createSheet',
            value: new CreateSheetBuilder()
                .newName(newSheetName)
                .idx(newIdx)
                .build(),
        }
        dataService
            .handleTransaction(new Transaction([payload], true))
            .then((v) => {
                if (v) return
                activeSheet$(newIdx)
            })
    }

    return (
        <div className={styles['host']}>
            <Tabs
                value={
                    sheets.length
                        ? Math.min(activeSheet, sheets.length - 1)
                        : false
                }
                onChange={onTabChange}
                variant="scrollable"
                scrollButtons="auto"
            >
                {sheets.map((sheet, i) => (
                    <Tab
                        key={sheet.name}
                        sx={{
                            textTransform: 'none',
                            ...(sheet.tabColor
                                ? {
                                      backgroundColor: StandardColor.fromArgb(
                                          sheet.tabColor
                                      ).css(),
                                      borderRadius: 1,
                                      mx: 0.5,
                                  }
                                : {}),
                        }}
                        label={
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    activeSheet$(i)
                                    setIsOpen(true)
                                    const target =
                                        e.currentTarget as HTMLElement
                                    const tabEl =
                                        (target.closest(
                                            '[role="tab"]'
                                        ) as HTMLElement | null) ?? target
                                    const rect = tabEl.getBoundingClientRect()
                                    setModalPosition({
                                        top: e.clientY,
                                        left: e.clientX,
                                        tabTop: rect.top,
                                        tabLeft: rect.left,
                                        tabWidth: rect.width,
                                        tabHeight: rect.height,
                                    })
                                }}
                            >
                                <span>{sheet.name}</span>
                            </Box>
                        }
                    />
                ))}
            </Tabs>
            <div
                className={styles['pre-btns']}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <IconButton
                    size="small"
                    aria-label="add sheet"
                    onClick={addSheet}
                >
                    <AddIcon fontSize="small" />
                </IconButton>
            </div>
            <ContextMenuComponent
                left={modalPosition.left}
                top={modalPosition.top}
                tabLeft={modalPosition.tabLeft}
                tabTop={modalPosition.tabTop}
                tabWidth={modalPosition.tabWidth}
                tabHeight={modalPosition.tabHeight}
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                index={activeSheet}
                sheetnames={sheets.map((s) => s.name)}
            />
        </div>
    )
}

function findNewSheetName(sheetNames: readonly string[]): string {
    const sheetPattern = /^Sheet(\d+)$/

    const numbers = sheetNames
        .map((name) => {
            const match = name.match(sheetPattern)
            return match ? parseInt(match[1], 10) : null
        })
        .filter((num): num is number => num !== null)

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1

    return `Sheet${nextNumber}`
}
