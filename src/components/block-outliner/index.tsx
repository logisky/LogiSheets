import {makeAutoObservable} from 'mobx'
import {observer} from 'mobx-react'
import Box from '@mui/material/Box'
import Settings from '@mui/icons-material/Settings'
import {useEffect, useState} from 'react'
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
    const [isHover, setIsHover] = useState(false)

    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault()
        setClickMousePosition({
            x: event.clientX,
            y: event.clientY,
        })
        setIsMenuOpen(true)
    }

    // Non-intercepting hover detection via global mousemove
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const mx = e.clientX
            const my = e.clientY
            const left = x - 6
            const top = y - 6
            const right = x + width + 6
            const bottom = y + height + 6
            const inside =
                mx >= left && mx <= right && my >= top && my <= bottom
            setIsHover(inside)
        }
        window.addEventListener('mousemove', onMove)
        return () => window.removeEventListener('mousemove', onMove)
    }, [x, y, width, height])

    return (
        <Box
            sx={{
                position: 'absolute',
                width: `${width}px`,
                height: `${height}px`,
                left: `${x}px`,
                top: `${y}px`,
                pointerEvents: 'none',
                zIndex: ZINDEX_BLOCK_OUTLINER,
            }}
        >
            <Box
                className="block-outliner-hover-area"
                sx={{
                    position: 'absolute',
                    inset: '-6px',
                    pointerEvents: 'none',
                    background: 'transparent',
                    borderRadius: 1,
                    zIndex: ZINDEX_BLOCK_OUTLINER,
                }}
            >
                <Box
                    className="block-outliner-border"
                    sx={{
                        position: 'absolute',
                        inset: '6px',
                        border: '2px solid',
                        borderColor: isHover
                            ? 'rgb(30, 144, 255)'
                            : 'rgb(2, 63, 124)',
                        background: 'transparent',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                        pointerEvents: 'none',
                    }}
                />
                <Box
                    className="block-outliner-action"
                    sx={{
                        display: isHover ? 'flex' : 'none',
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
                        pointerEvents: 'auto',
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
