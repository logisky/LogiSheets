import {makeAutoObservable} from 'mobx'
import {observer} from 'mobx-react'
import Box from '@mui/material/Box'
import Settings from '@mui/icons-material/Settings'
import {useState} from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import {ZINDEX_BLOCK_OUTLINER} from '../const'
import {MenuComponent} from './menu'

export class BlockOutlinerProps {
    constructor() {
        makeAutoObservable(this)
    }
    x = 0
    y = 0
    width = 0
    height = 0
    blockId = 0
    sheetId = 0
}
export interface IBlockOutlinerProps {
    blockOutliner: BlockOutlinerProps
}

export const BlockOutlinerComponent = observer((props: IBlockOutlinerProps) => {
    const {blockOutliner} = props
    const {x, y, width, height, blockId, sheetId} = blockOutliner
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [descriptorUrl, setDescriptorUrl] = useState<string | undefined>(
        undefined
    )
    const [successMessage, setSuccessMessage] = useState<string | undefined>(
        undefined
    )
    const [error, setError] = useState<string | undefined>(undefined)
    const [copySuccess, setCopySuccess] = useState(false)

    const [clickMousePosition, setClickMousePosition] = useState({
        x: 0,
        y: 0,
    })

    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault()
        setClickMousePosition({
            x: event.clientX,
            y: event.clientY,
        })
        setIsMenuOpen(true)
    }

    return (
        <Box
            sx={{
                position: 'absolute',
                width: `${width}px`,
                height: `${height}px`,
                left: `${x}px`,
                top: `${y}px`,
                pointerEvents: 'auto',
                zIndex: ZINDEX_BLOCK_OUTLINER,
            }}
        >
            <Box
                className="block-outliner-hover-area"
                sx={{
                    position: 'absolute',
                    inset: '-6px',
                    pointerEvents: 'auto',
                    background: 'transparent',
                    borderRadius: 1,
                    '&:hover .block-outliner-border': {
                        borderColor: 'rgb(30, 144, 255)',
                    },
                    '&:hover .block-outliner-action': {
                        display: 'flex',
                    },
                    zIndex: ZINDEX_BLOCK_OUTLINER,
                }}
            >
                <Box
                    className="block-outliner-border"
                    sx={{
                        position: 'absolute',
                        inset: '6px',
                        border: '2px solid rgb(2, 63, 124)',
                        background: 'transparent',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                        pointerEvents: 'none',
                    }}
                />
                <Box
                    className="block-outliner-action"
                    sx={{
                        display: 'none',
                        position: 'absolute',
                        top: '-10px',
                        right: '-10px',
                        width: 32,
                        height: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'white',
                        borderRadius: '50%',
                        boxShadow: 3,
                        border: '2px solid rgb(30, 144, 255)',
                        color: 'rgb(30, 144, 255)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 20,
                        transition: 'background 0.2s, color 0.2s',
                        '&:hover': {
                            background: 'rgb(30, 144, 255)',
                            color: '#fff',
                        },
                        userSelect: 'none',
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        handleClick(e)
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation()
                    }}
                >
                    <Settings sx={{fontSize: 20}} />
                </Box>
            </Box>
            {isMenuOpen && (
                <MenuComponent
                    sheetId={sheetId}
                    blockId={blockId}
                    isOpen={isMenuOpen}
                    setIsOpen={setIsMenuOpen}
                    clickMousePosition={clickMousePosition}
                    setDescriptorUrl={setDescriptorUrl}
                    setError={setError}
                    setSuccessMessage={setSuccessMessage}
                />
            )}
            {descriptorUrl || error || successMessage ? (
                <Snackbar
                    open={!!descriptorUrl || !!error || !!successMessage}
                    autoHideDuration={6000}
                    anchorOrigin={{vertical: 'top', horizontal: 'center'}}
                    onClose={(_, reason) => {
                        if (reason === 'clickaway') return
                        setDescriptorUrl(undefined)
                        setError(undefined)
                        setSuccessMessage(undefined)
                    }}
                >
                    <Alert
                        severity={
                            error
                                ? 'error'
                                : successMessage
                                ? 'success'
                                : 'info'
                        }
                        onClose={() => {
                            setDescriptorUrl(undefined)
                            setError(undefined)
                            setSuccessMessage(undefined)
                        }}
                        sx={{width: '100%'}}
                        action={
                            descriptorUrl ? (
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={async (e) => {
                                        e.stopPropagation()
                                        await navigator.clipboard.writeText(
                                            descriptorUrl!
                                        )
                                        setCopySuccess(true)
                                        setTimeout(
                                            () => setCopySuccess(false),
                                            1500
                                        )
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation()
                                    }}
                                >
                                    {copySuccess ? '✅' : 'Copy'}
                                </Button>
                            ) : null
                        }
                    >
                        {error ? (
                            <span>{error}</span>
                        ) : successMessage ? (
                            <span>{successMessage}</span>
                        ) : descriptorUrl ? (
                            <span>
                                URL:{' '}
                                <a
                                    href={descriptorUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {descriptorUrl}
                                </a>
                            </span>
                        ) : null}
                    </Alert>
                </Snackbar>
            ) : null}
        </Box>
    )
})
