import {SelectedData} from '@/components/canvas'
import {DataService} from '@/core/data'
import {useInjection} from '@/core/ioc/provider'
import {TYPES} from '@/core/ioc/types'
import {ToggleButton} from '@mui/material'
import Modal from 'react-modal'
import {CreateDiyBtnComponent} from './create-diy-btn'
import {useState} from 'react'
import {BlockComposerComponent} from '@/components/block-composer'
import styles from '../content/start.module.scss'

export interface BlockProps {
    readonly selectedData?: SelectedData
}

export const BlockComponent = ({selectedData}: BlockProps) => {
    const [composer, setComposer] = useState<boolean>(false)
    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)

    return (
        <div>
            <ToggleButton
                value="create-block"
                size="small"
                aria-label="create-block"
                onClick={() => setComposer(true)}
            >
                Create A Block
            </ToggleButton>
            <CreateDiyBtnComponent selectedData={selectedData} />
            <Modal
                isOpen={composer}
                className={styles['modal-content']}
                onRequestClose={() => setComposer(false)}
                shouldCloseOnEsc={true}
                shouldCloseOnOverlayClick={true}
                ariaHideApp={false}
                style={{
                    content: {
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                    },
                }}
            >
                <BlockComposerComponent
                    selectedData={selectedData}
                    close={() => setComposer(false)}
                />
            </Modal>
        </div>
    )
}
