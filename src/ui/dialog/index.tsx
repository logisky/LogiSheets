import Modal, {Props} from 'react-modal'
import './dialog.scss'

export interface DialogProps extends Props {
    readonly close$?: () => void
}

export const DialogComponent = (props: DialogProps) => {
    Modal.setAppElement('#root')
    return (
        <Modal
            shouldCloseOnEsc={true}
            shouldCloseOnOverlayClick={true}
            onRequestClose={props.close$}
            {...props}
        />
    )
}
