import {Container} from 'inversify'
//reflect-metadata should be imported before any interface or other imports also
//it should be imported only once so that a singleton is created.
import 'reflect-metadata'
import {Backend} from '@/core/data/backend'
import {SheetService} from '@/core/data/sheet'
import {DataService} from '@/core/data/service'
import {TYPES} from './types'

export const CONTAINER = new Container()
CONTAINER.bind<Backend>(TYPES.Backend).to(Backend).inSingletonScope()
CONTAINER.bind<SheetService>(TYPES.Sheet).to(SheetService).inSingletonScope()
CONTAINER.bind<DataService>(TYPES.Data).to(DataService).inSingletonScope()
