# merge-jsons-webpack-plugin

see:

https://github.com/tettusud/merge-jsons-webpack-plugin/edit/master/index.ts

## Why we need this plugin

### Generated file not meet the requirement

This plugin is mainly used in merge function jsons to one json file.

Origin plugin only merge all files to result:

```json
{
  "name": ["COUNTBLANK", "PI", "SUM", "SWITCH"],
  "argCount": [{ "eq": 1 }, { "eq": 0 }, { "ge": 1 }, { "ge": 3, "odd": true }],
  "args": [
    { "argName": "area", "refOnly": true },
    { "argName": "element", "startRepeated": true },
    { "argName": "expr" },
    { "argName": "condition", "startRepeated": true },
    { "argName": "caseValue" }
  ],
  "description": ["functions.pi.description", "functions.switch.description"]
}
```

But I need the result is:

```json
[
  {
    "name": "COUNTBLANK",
    "argCount": {
      "eq": 1
    },
    "args": [
      {
        "argName": "area",
        "refOnly": true
      }
    ]
  },
  {
    "name": "PI",
    "description": "functions.pi.description",
    "argCount": {
      "eq": 0
    },
    "args": []
  }
]
```

### Not generate file in debug mode

Files are generated in `yarn build`, but I need the file in `yarn start`.
