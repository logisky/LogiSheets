import {
    SheetRenameBuilder,
    DeleteSheetBuilder,
    Transaction,
    Payload,
} from 'logisheets-web'
import {useState} from 'react'
import Modal from 'react-modal'
import {DataService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {useToast} from '@/ui/notification/useToast'
import styles from './sheets-tab.module.scss'

export interface ContextMenuProps {
    readonly index: number
    readonly sheetnames: readonly string[]
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
    readonly left: number
    readonly top: number
}

export const ContextMenuComponent = (props: ContextMenuProps) => {
    const {index, sheetnames: sheetNames, setIsOpen, top, left, isOpen} = props
    const [renameIsOpen, setRenameIsOpen] = useState(false)
    const oldName = sheetNames[index] || ''
    const [newName, setNewName] = useState(oldName)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const toast = useToast()

    const openRename = () => {
        setRenameIsOpen(true)
        setIsOpen(false)
    }

    const rename = () => {
        if (!newName) return
        if (newName === oldName) return
        const sheetRename: Payload = {
            type: 'sheetRename',
            value: new SheetRenameBuilder()
                .oldName(oldName)
                .newName(newName)
                .build(),
        }
        DATA_SERVICE.handleTransaction(new Transaction([sheetRename], true))
    }

    const deleteSheet = () => {
        if (sheetNames.length === 1) {
            toast.toast.error(
                'Deletion failed: A spreadsheet must have at least one sheet.'
            )
            return
        }
        const payload: Payload = {
            type: 'deleteSheet',
            value: new DeleteSheetBuilder().idx(index).build(),
        }
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }

    return (
        <>
            <Modal
                isOpen={isOpen}
                shouldCloseOnEsc={true}
                shouldCloseOnOverlayClick={true}
                onRequestClose={() => setIsOpen(false)}
                ariaHideApp={false}
                style={{
                    content: {
                        width: 'max-content',
                        height: 'max-content',
                        left: left,
                        top: top - 140,
                    },
                }}
            >
                <div className={styles['context-menu']} tabIndex={-1}>
                    <div
                        className={styles['context-menu-item']}
                        onClick={openRename}
                    >
                        ✏️ Rename
                    </div>
                    <div className={styles['context-menu-divider']} />
                    <div
                        className={styles['context-menu-item']}
                        onClick={deleteSheet}
                    >
                        🗑️ Delete
                    </div>
                </div>
            </Modal>
            <Modal
                isOpen={renameIsOpen}
                shouldCloseOnEsc={true}
                shouldCloseOnOverlayClick={true}
                onAfterClose={rename}
                onRequestClose={() => setRenameIsOpen(false)}
                ariaHideApp={false}
            >
                <div className={styles['rename-modal']} tabIndex={-1}>
                    <input
                        className={styles['rename-input']}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <button
                        className={styles['rename-close-button']}
                        onClick={() => setRenameIsOpen(false)}
                    >
                        Close
                    </button>
                </div>
            </Modal>
        </>
    )
}
