import { DATA_SERVICE } from 'core/data'
import { Payload, SheetRename, SheetShift, ShiftType } from 'proto/message'
import { useState } from 'react'
import Modal from 'react-modal'

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
    const openRename = () => {
        setRenameIsOpen(true)
        setIsOpen(false)
    }
    const rename = () => {
        if (sheetName === oldName)
            return
        const sheetRename: SheetRename = {
            oldName,
            newName: sheetName,
        }
        const payload: Payload = {
            payloadOneof: {
                $case:'sheetRename',
                sheetRename,
            }
        }
        DATA_SERVICE.backend.sendTransaction([payload])
    }

    const deleteSheet = () => {
        const sheetShift: SheetShift = {
            sheetIdx: index,
            type: ShiftType.DELETE,
        }
        const payload: Payload = {
            payloadOneof: {
                $case: 'sheetShift',
                sheetShift
            }
        }
        DATA_SERVICE.backend.sendTransaction([payload])
    }
    return <div>
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
                <input value={sheetName} onChange={e => setSheetName(e.target.value)} />
                <button onClick={() => setRenameIsOpen(true)}>关闭</button>
            </Modal>
    </div>
}
