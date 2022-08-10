/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//references https://basarat.gitbooks.io/typescript/content/docs/quick/nodejs.html
import * as path from 'path'
import * as fs from 'fs'
import * as glob from 'glob'

const UTF8_ENCODING = 'utf8'
const plugin = 'MergeJsonWebpackPlugin'

interface GroupBy {
    fileName: string
    pattern: string
}
interface OutputGroupBy {
    groupBy: GroupBy[]
}
interface OutputFile {
    fileName: string
}

/**
 * 
 *  Files to merge, and output path.
 */
interface IMergeJsonFiles {
    files: string[];
    outputPath: string;
}
interface Options {
    debug?: boolean
    encoding?: string
    overwrite?: boolean
    mergeToArray?: boolean
    output: OutputFile | OutputGroupBy
    globOptions?: glob.IOptions
    cwd?: string
}
export class MergeJsonWebpackPlugin {
    //options for the plugin
    options: any
    fileDependencies: any
    logger: Logger

    constructor(options: Options) {
        this.options = Object.assign({
            debug: false,
            encoding: UTF8_ENCODING,
            overwrite: true,
            mergeToArray: false,
            cwd: process.cwd(),
        }, options)
        this.logger = new Logger(this.options.debug)
        this.logger.debug(JSON.stringify(this.options, undefined, 2))
    }


    /**
     * Extract files from the input options.
     * It can be either string or pattern.
     * @returns Array of { files , outputPath}
     */
    getFileToProcess(): Array<IMergeJsonFiles> {
        // placeholder to collect files and output file name.
        const filesToProcess: Array<IMergeJsonFiles> = []

        const groupBy = this.options.output?.groupBy
        const files = this.options.files

        // check if groupby
        if (groupBy) {
            const defaultGlobOptions = { mark: true, cwd: this.options.cwd }
            // glob option
            const globOptions = { ...defaultGlobOptions, ...this.options.globOptions }
            // extract files
            groupBy.map((g) => {
                const { pattern, fileName } = g
                const files = glob.sync(pattern, globOptions)
                filesToProcess.push(
                    {
                        files,
                        outputPath: fileName
                    }
                )
            })
        } else if (files) {
            filesToProcess.push(
                {
                    files,
                    outputPath: this.options.output?.fileName
                }
            )
        }
        return filesToProcess
    }


    apply() {
        this.logger.debug('Running apply() ::::::')
        const fileList: Array<IMergeJsonFiles> = this.getFileToProcess()
        // process each input group.
        for (const opt of fileList) {
            this.processFiles(opt)
        }

    }

    /**
     * 
     * @param compilation webpack compilation object.
     * @param files List of file names.
     * @param outputPath Output path to write merged json files.
     */
    processFiles = (filesInfo: IMergeJsonFiles) => {
        const initValue = this.options.mergeToArray ? [] : {}
        const mergedJSON = filesInfo.files.map(file => {
            try {
                const content = this.readContent(file)
                return this.parseJson(file, content.toString())
            } catch (e) {
                this.logger.error(e)
            }
            return {}
        })
            .reduce((acc, curr) => this.mergeDeep(acc, curr), initValue)
        this.logger.debug(JSON.stringify(mergedJSON), 'result json')
        // add assets to compilation.
        const content = JSON.stringify(mergedJSON, null, this.options.space)
        const outputPathInfo = path.parse(filesInfo.outputPath)
        if (!fs.existsSync(outputPathInfo.dir))
            fs.mkdirSync(outputPathInfo.dir, {recursive: true})
        fs.writeFileSync(filesInfo.outputPath, content, {encoding: this.options.encoding})
    }


    /**
     * Reads a file from file system, if not found it will search in assets.
     * @param compilation 
     * @param contextPath 
     * @param compilation fileName
     */
    readContent = (fileName: string) => {
        //cleanup the spaces
        fileName = fileName.trim()
        //check if valid json file or not ,if not reject
        const filePath = path.join(this.options.cwd, fileName)
        try {
            return fs.readFileSync(filePath, this.options.encoding)
        } catch (e) {
            this.logger.debug(`${fileName} missing,looking for it in assets.`)
        }
    }

    /**
     * 
     * @param fileName 
     * @param content 
     */
    parseJson(fileName: string, content: string) {
        if (!content) {
            throw new Error(`Data appears to be empty in the file := [ ${fileName} ]`)
        }
        // Source: https://github.com/sindresorhus/strip-bom/blob/master/index.js
        // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
        // conversion translates it to FEFF (UTF-16 BOM)
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1)
        }
        // try to get a JSON object from the file data
        let json = {}
        // eslint-disable-next-line no-useless-catch
        try {
            const fileContent = JSON.parse(content)
            //to prefix object with filename ,requirement as request in issue#31            
            if (this.options.prefixFileName) {
                if (typeof this.options.prefixFileName === 'function') {
                    json[this.options.prefixFileName(fileName)] = fileContent
                } else {
                    json[path.basename(fileName, '.json')] = fileContent
                }
            } else {
                json = fileContent
            }
        } catch (e) {
            throw e
        }
        if (typeof json !== 'object') {
            throw new Error(`Not a valid json data in ${fileName}`)
        }
        return json
    }

    /**
     * deep merging of json child object
     * code contributed by @leonardopurro
     */
    mergeDeep = (target, source) => {
        if (Array.isArray(target) && typeof source === 'object' && this.options.mergeToArray)
            target.push(source)
        else if (typeof target == 'object' && typeof source == 'object') {
            for (const key in source) {
                // check if merge is false, then preserve in an array
                if (!target[key]) {
                    target[key] = source[key]
                } else {
                    // check if overwrite is false, then merge into array.
                    if (this.options.overwrite === false) {
                        target[key] = [].concat(target[key], source[key])
                    } else {
                        if (typeof source[key] == 'object') {
                            this.mergeDeep(target[key], source[key])
                        } else {
                            target[key] = source[key]
                        }
                    }
                }
            }
        }
        return target
    }
}

class Logger {
    isDebug = false
    constructor(isDebug: boolean) {
        this.isDebug = isDebug
    }
    debug = (...logs) => {
        if (this.isDebug) {
            // eslint-disable-next-line no-console
            console.log('\x1b[36m%s\x1b[0m', `${plugin} :: ${logs}`)
        }
    }
    error = (e: any) => {
        // eslint-disable-next-line no-console
        console.error('\x1b[41m%s\x1b[0m', `${plugin} : ${e.message}`)
    }
}
