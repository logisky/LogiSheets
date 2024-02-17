import {injectable} from 'inversify'
import {getID} from '../ioc/id'

@injectable()
export class SheetService {
    readonly id = getID()
}
