import {injectable} from 'inversify'
import {WorkbookClient} from '../clients'
import {BlockField} from 'logisheets-web'
import {EnumSetManager} from './enum_set_manager'
import {FieldInfo, FieldManager} from './field_manager'

export const LOGISHEETS_BUILTIN_CRAFT_ID = 'logisheets'
export const FIELD_AND_VALIDATION_TAG = 80

/**
 * Craft manager is used to load and manage the crafts, provide the iframes and bind the blocks with the crafts.
 *
 * Block IDs, block ranges and craft URLs are supposed to be stored in the workbook file.
 * And when the application starts, it will fetch the craft manifest from the URL, register it and bind the blocks.
 */
@injectable()
export class BlockManager {
    public constructor(private readonly _workbookClient: WorkbookClient) {}

    public enumSetManager = new EnumSetManager()
    public fieldManager = new FieldManager()

    public getPersistentData(blockFields: readonly BlockField[]): string {
        const fieldInfos: FieldInfo[] = []
        blockFields.forEach((f) => {
            const info = this.fieldManager.get(f.fieldId)
            if (info === undefined) return
            fieldInfos.push(info)
        })
        const fieldInfosJson = JSON.stringify(fieldInfos)
        const enumSetJson = this.enumSetManager.toJSON()

        return JSON.stringify({fields: fieldInfosJson, enumSets: enumSetJson})
    }

    public parseAppData(data: string) {
        const {fields, enumSets} = JSON.parse(data)
        this.enumSetManager.fromJSON(enumSets)
        this.fieldManager.fromJSON(fields)
    }
}
