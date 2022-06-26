import {Container} from 'inversify'
//reflect-metadata should be imported before any interface or other imports also
//it should be imported only once so that a singleton is created.
import 'reflect-metadata'
import {Backend} from '@/core/data/backend'
import {ScrollPosition} from '@/core/data/scroll'
import {SheetService} from '@/core/data/sheet'
import {DataService} from '@/core/data/service'
import {Render} from '@/components/canvas/managers/render'
import {TYPES} from './types'

export const CONTAINER = new Container()
CONTAINER.bind<Backend>(TYPES.Backend).to(Backend).inSingletonScope()
CONTAINER.bind<ScrollPosition>(TYPES.Scroll).to(ScrollPosition).inSingletonScope()
CONTAINER.bind<SheetService>(TYPES.Sheet).to(SheetService).inSingletonScope()
CONTAINER.bind<DataService>(TYPES.Data).to(DataService).inSingletonScope()
CONTAINER.bind<Render>(TYPES.Render).to(Render).inSingletonScope()
