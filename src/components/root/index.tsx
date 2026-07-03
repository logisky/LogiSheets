import {RootContainer} from './container'
import styles from './root.module.scss'
import {ErrorBoundary} from '@/ui/error'
import {NotificatonComponent} from '@/ui/notification'
import {WorkbookLoadConfirm} from '@/components/workbook-load-confirm'
import {SettingContext, Settings} from '@/core/settings'
import {AuthorServiceContext} from '@/core/author'
import {GlobalContext, GlobalStore} from '@/store'
import {useRef} from 'react'
import {DefaultAuthorService} from 'logisheets-web'

export const SpreadsheetRoot = () => {
    const globalStore = useRef(new GlobalStore())
    // Open-source build: the author types their own name (see the comment
    // composer). Enterprise builds swap this provider for a directory-backed
    // AuthorService.
    const authorService = useRef(new DefaultAuthorService())

    return (
        <div className={styles.host}>
            <AuthorServiceContext.Provider value={authorService.current}>
                <GlobalContext.Provider value={globalStore}>
                    <ErrorBoundary>
                        <SettingContext.Provider value={new Settings()}>
                            <RootContainer />
                        </SettingContext.Provider>
                    </ErrorBoundary>
                </GlobalContext.Provider>
            </AuthorServiceContext.Provider>
            <WorkbookLoadConfirm />
            <NotificatonComponent />
        </div>
    )
}
