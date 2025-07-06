import {makeAutoObservable} from 'mobx'
import {observer} from 'mobx-react'
import Box from '@mui/material/Box'
import Settings from '@mui/icons-material/Settings'
import {useState} from 'react'
import {ContextMenuComponent as BlockOutlinerContextMenu} from './contextmenu' // 菜单组件

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

    return (
        <Box
            sx={{
                position: 'absolute',
                width: `${width}px`,
                height: `${height}px`,
                left: `${x}px`,
                top: `${y}px`,
                pointerEvents: 'none',
            }}
        >
            <Box
                className="block-outliner-hover-area"
                sx={{
                    position: 'absolute',
                    inset: '-6px',
                    pointerEvents: 'auto',
                    background: 'transparent',
                    zIndex: 2,
                    borderRadius: 1,
                    '&:hover .block-outliner-border': {
                        borderColor: 'rgb(30, 144, 255)',
                    },
                    '&:hover .block-outliner-action': {
                        display: 'flex',
                    },
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
                        zIndex: 10,
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
                        setIsMenuOpen(true)
                    }}
                >
                    <Settings sx={{fontSize: 20}} />
                </Box>
            </Box>
            {isMenuOpen && (
                <BlockOutlinerContextMenu
                    sheetId={sheetId}
                    blockId={blockId}
                    isOpen={isMenuOpen}
                    setIsOpen={setIsMenuOpen}
                />
            )}
        </Box>
    )
})
