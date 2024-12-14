import {
    SheetRenameBuilder,
    DeleteSheetBuilder,
    Transaction,
} from 'logisheets-web'
import {useState} from 'react'
import Modal from 'react-modal'
import {DataService} from '@/core/data2'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'

export interface ContextMenuProps {
    readonly index: number
    readonly sheetnames: readonly string[]
    readonly isOpen: boolean
    readonly setIsOpen: (isOpen: boolean) => void
}

export const ContextMenuComponent = (props: ContextMenuProps) => {
    const {index, sheetnames, isOpen, setIsOpen} = props
    const [renameIsOpen, setRenameIsOpen] = useState(false)
    const oldName = sheetnames[index]
    const [sheetName, setSheetName] = useState(oldName)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const openRename = () => {
        setRenameIsOpen(true)
        setIsOpen(false)
    }
    const rename = () => {
        if (sheetName === oldName) return
        const sheetRename = new SheetRenameBuilder()
            .oldName(oldName)
            .newName(sheetName)
            .build()
        DATA_SERVICE.handleTransaction(new Transaction([sheetRename], true))
    }

    const deleteSheet = () => {
        const payload = new DeleteSheetBuilder().sheetIdx(index).build()
        DATA_SERVICE.handleTransaction(new Transaction([payload], true))
    }
    return (
        <div>
            <Modal
                isOpen={isOpen}
                shouldCloseOnEsc={true}
                shouldCloseOnOverlayClick={true}
            >
                <div onClick={openRename}>重命名</div>
                <div onClick={deleteSheet}>删除</div>
            </Modal>
            <Modal
                isOpen={renameIsOpen}
                shouldCloseOnEsc={true}
                shouldCloseOnOverlayClick={true}
                onAfterClose={rename}
            >
                <input
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                />
                <button onClick={() => setRenameIsOpen(true)}>关闭</button>
            </Modal>
        </div>
    )
}
