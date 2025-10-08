import {useState, FC, useEffect} from 'react'
import styles from './sheets-tab.module.scss'
import {ContextMenuComponent} from './contextmenu'
import {
    DeleteSheetBuilder,
    CreateSheetBuilder,
    isErrorMessage,
    Payload,
    Transaction,
} from 'logisheets-web'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import {Subscription} from 'rxjs'
import {DataServiceImpl as DataService} from '@/core/data'

export interface SheetTabProps {
    activeSheet: number
    activeSheet$: (s: number) => void
}

export const SheetsTabComponent: FC<SheetTabProps> = ({
    activeSheet,
    activeSheet$,
}) => {
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const [sheets, setSheets] = useState([] as string[])
    const [isOpen, setIsOpen] = useState(false)
    const [modalPosition, setModalPosition] = useState({top: 0, left: 0})

    useEffect(() => {
        DATA_SERVICE.getWorkbook()
            .getAllSheetInfo()
            .then((v) => {
                if (isErrorMessage(v)) return
                setSheets(v.map((s) => s.name))
            })
    }, [])

    useEffect(() => {
        const subs = new Subscription()
        subs.add(
            DATA_SERVICE.registerSheetUpdatedCallback(() => {
                setSheets(
                    DATA_SERVICE.getCacheAllSheetInfo().map((s) => s.name)
                )
            })
        )
        return () => {
            subs.unsubscribe()
        }
    }, [])

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

    const onDelete = (i: number) => {
        const payload: Payload = {
            type: 'deleteSheet',
            value: new DeleteSheetBuilder().idx(i).build(),
        }
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }
    const addSheet = () => {
        const newSheetName = findNewSheetName(sheets)
        const newIdx = sheets.length
        const payload: Payload = {
            type: 'createSheet',
            value: new CreateSheetBuilder()
                .newName(newSheetName)
                .idx(newIdx)
                .build(),
        }
        DATA_SERVICE.handleTransaction(new Transaction([payload], true)).then(
            (v) => {
                if (v) return
                activeSheet$(newIdx)
            }
        )
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
                        key={sheet}
                        sx={{textTransform: 'none'}}
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
                                    setModalPosition({
                                        top: e.clientY,
                                        left: e.clientX,
                                    })
                                }}
                            >
                                <span>{sheet}</span>
                                <Box
                                    component="span"
                                    role="button"
                                    aria-label="close sheet"
                                    tabIndex={0}
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 20,
                                        height: 20,
                                        ml: 0.5,
                                        borderRadius: '50%',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: 'action.hover',
                                        },
                                        outline: 'none',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDelete(i)
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' ||
                                            e.key === ' '
                                        ) {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onDelete(i)
                                        }
                                    }}
                                >
                                    <CloseIcon fontSize="inherit" />
                                </Box>
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
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                index={activeSheet}
                sheetnames={sheets}
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
