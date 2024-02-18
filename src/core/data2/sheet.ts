import {inject, injectable} from 'inversify'
import {getID} from '../ioc/id'
import {RenderDataProvider} from './render'
import {TYPES} from '../ioc/types'
import {WorkbookService} from './workbook'

@injectable()
export class SheetService {
    readonly id = getID()
    constructor(
        @inject(TYPES.Render) private _render: RenderDataProvider,
        @inject(TYPES.Data) private _workbook: WorkbookService
    ) {}
}
