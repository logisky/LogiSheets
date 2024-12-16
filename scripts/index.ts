import {MergeJsonWebpackPlugin} from './merge-jsons'

const plugins = [
    new MergeJsonWebpackPlugin({
        debug: false,
        mergeToArray: true,
        output: {
            groupBy: [
                {
                    pattern: 'resources/funcs/*.json',
                    fileName: 'resources/funcs/out/funcs.json',
                },
            ],
        },
        globOptions: {
            nosort: true,
        },
    }),
]
plugins.forEach((plugin) => {
    plugin.apply()
})
