import {Container} from 'inversify'
//reflect-metadata should be imported before any interface or other imports also
//it should be imported only once so that a singleton is created.
import 'reflect-metadata'
import {DataService, DataServiceImpl} from '@/core/data2'
import {TYPES} from './types'

export const CONTAINER = new Container()
CONTAINER.bind<DataService>(TYPES.Data).to(DataServiceImpl).inSingletonScope()
