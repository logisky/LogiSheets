import {Container} from 'inversify'
//reflect-metadata should be imported before any interface or other imports also
//it should be imported only once so that a singleton is created.
import 'reflect-metadata'
import {DataService, DataServiceImpl, WorkbookClient} from '@/core/data'
import type {Client} from 'logisheets-web'
import {TYPES} from './types'
import {Pool} from '../pool'

export const CONTAINER = new Container()

export async function setup() {
    const pool = new Pool()
    CONTAINER.bind<Pool>(TYPES.Pool).toConstantValue(pool)
    const workbook = new WorkbookClient()
    if (typeof window !== 'undefined') {
        // @ts-expect-error export the workbook client to the window
        window.workbookClient = workbook
    } else if (typeof global !== 'undefined') {
        // @ts-expect-error export the workbook client to the global
        global.workbookClient = workbook
    }
    CONTAINER.bind<Client>(TYPES.Workbook).toConstantValue(workbook)
    return workbook.isReady().then((_) => {
        CONTAINER.bind<DataService>(TYPES.Data)
            .to(DataServiceImpl)
            .inSingletonScope()
    })
}
