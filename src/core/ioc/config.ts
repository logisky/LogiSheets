import {Container} from 'inversify'
//reflect-metadata should be imported before any interface or other imports also
//it should be imported only once so that a singleton is created.
import 'reflect-metadata'
import {
    DataServiceImpl,
    WorkbookClient,
    CraftManager,
    OffscreenClient,
} from '@/core/data'
import type {Client} from 'logisheets-web'
import {TYPES} from './types'
import {Pool} from '../pool'

export const CONTAINER = new Container()

export async function setup() {
    const pool = new Pool()
    CONTAINER.bind<Pool>(TYPES.Pool).toConstantValue(pool)
    const worker = new Worker(new URL('../worker/worker.ts', import.meta.url))
    const workbook = new WorkbookClient(worker)
    CONTAINER.bind<Client>(TYPES.Workbook).toConstantValue(workbook)
    CONTAINER.bind<CraftManager>(TYPES.CraftManager).toConstantValue(
        new CraftManager(workbook)
    )

    const offscreen = new OffscreenClient(worker)
    CONTAINER.bind<OffscreenClient>(TYPES.Offscreen).toConstantValue(offscreen)
    return workbook.isReady().then((_) => {
        CONTAINER.bind<DataServiceImpl>(TYPES.Data)
            .to(DataServiceImpl)
            .inSingletonScope()
    })
}
