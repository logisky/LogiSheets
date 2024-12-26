import {Container} from 'inversify'
//reflect-metadata should be imported before any interface or other imports also
//it should be imported only once so that a singleton is created.
import 'reflect-metadata'
import {
    DataService,
    DataServiceImpl,
    WorkbookClient,
    IWorkbookClient,
} from '@/core/data2'
import {TYPES} from './types'

export const CONTAINER = new Container()

export async function setup() {
    console.log('gggggnew web worker')
    const workbook = new WorkbookClient()
    CONTAINER.bind<IWorkbookClient>(TYPES.Workbook).toConstantValue(workbook)
    return workbook.isReady().then((_) => {
        CONTAINER.bind<DataService>(TYPES.Data)
            .to(DataServiceImpl)
            .inSingletonScope()
    })
}
