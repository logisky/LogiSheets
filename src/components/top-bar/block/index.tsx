import Button from '@mui/material/Button'
import Modal from 'react-modal'
import TextField from '@mui/material/TextField'
import styles from '../content/start.module.scss'
import {BlockComposerComponent} from '@/components/block-composer'
import {CraftManager} from '@/core/data'
import {CreateDiyBtnComponent} from './create-diy-btn'
import {DataServiceImpl as DataService} from '@/core/data'
import {TYPES} from '@/core/ioc/types'
import {ToggleButton} from '@mui/material'
import {Transaction} from 'logisheets-web'
import {getFirstCell, SelectedData} from '@/components/canvas'
import {useInjection} from '@/core/ioc/provider'
import {useState} from 'react'

export interface BlockProps {
    readonly selectedData?: SelectedData
}

export const BlockComponent = ({selectedData}: BlockProps) => {
    const [composer, setComposer] = useState<boolean>(false)
    const [importFromUrl, setImportFromUrl] = useState<boolean>(false)
    const [importUrl, setImportUrl] = useState<string>('')

    const hasSelectedData =
        selectedData !== undefined && selectedData.data !== undefined

    const DATA_SERVICE = useInjection<DataService>(TYPES.Data)
    const CRAFT_MANAGER = useInjection<CraftManager>(TYPES.CraftManager)
    const importBlock = async () => {
        if (!selectedData) return
        const firstCell = getFirstCell(selectedData)
        const payloads = await CRAFT_MANAGER.downloadDescriptorFromUrl(
            DATA_SERVICE.getCurrentSheetIdx(),
            firstCell.r,
            firstCell.c,
            importUrl
        )
        if (payloads.isErr()) return
        await DATA_SERVICE.handleTransaction(
            new Transaction(payloads._unsafeUnwrap(), true)
        )
        setImportFromUrl(false)
    }

    return (
        <div>
            <ToggleButton
                value="create-block"
                size="small"
                aria-label="create-block"
                onClick={() => setComposer(true)}
                disabled={!hasSelectedData}
            >
                Create A Block
            </ToggleButton>
            <CreateDiyBtnComponent selectedData={selectedData} />
            <ToggleButton
                value="import-block"
                size="small"
                aria-label="import-block"
                onClick={() => setImportFromUrl(true)}
                disabled={!hasSelectedData}
            >
                Import A Block
            </ToggleButton>
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
            <Modal
                isOpen={importFromUrl}
                className={styles['modal-content']}
                onRequestClose={() => setImportFromUrl(false)}
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
                <div style={{minWidth: 400}}>
                    <h3>Import Block by URL</h3>
                    <TextField
                        label="Block URL"
                        variant="outlined"
                        fullWidth
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="Paste the exported block URL here"
                        sx={{mb: 2}}
                    />
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 8,
                        }}
                    >
                        <Button
                            onClick={() => setImportFromUrl(false)}
                            color="secondary"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            disabled={!importUrl}
                            onClick={importBlock}
                        >
                            Import
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
