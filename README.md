The koa-transform-media-url is a koa middleware. It's used to transform media link to id.

## Installation

### install packages

```
npm install @vahaha/koa-transform-media-url
// yarn install @vahaha/koa-transform-media-url
```

## Usage

#### Setting

The first setting is called onetime when start programming.

```
function fnGetBaseUrlList() {
    return ['https://s3.amazonaws.com/package-name', 'https://cdn.example.com/]
}

require('@vahaha/koa-transform-media-url').init(fnGetBaseUrlList) // init is a async function.

```

#### Using in declaring endpoint

```
const transformer = require('@vahaha/koa-transform-media-url')
const Router = require('@koa/router')
const ctrl = require('./controller')

const router = new Router()

router.post('/files', transformer.transformRequest({
    responseFields: ['fieldName', 'urlInContent'],
    fnGetIdByPaths
}), ctrl.createFile)

router.get('/files', transformer.transformResponse({
    responseFields: ['link', 'urlInContent'],
    fnGetUrlByIds
}), ctrl.getFiles)

// or
// router.use(transformer.transformBoth({
//    requestFields: ['fieldName', 'urlInContent'],
//    responseFields: ['link', 'urlInContent']
//    fnGetIdByPaths,
//    fnGetUrlByIds
// }))

/*
ex: Transform request (body)
--------------------------------
input:
{
    fieldName: 'https://s3.amazonaws.com/package-name/e4630b7d-18c2-4d87-adb7-5e7dccc5d633/image/0d64132a-d58a-48f7-907f-0fd93a4a0bff.jpg',
    urlInContent: 'Example image <img src="http://s3.amazonaws.com/package-name/e4630b7d-18c2-4d87-adb7-5e7dccc5d633/image/0d64132a-d58a-48f7-907f-0fd93a4a0bff.jpg">',
    otherField: 'value'
}

output:
{
    fieldName: ':media@app://625d32c61a0d682cbb64ff0c',
    urlInContent: 'Example image <img src=":media@app://625d32c61a0d682cbb64ff0c">',
    otherField: 'value'
}

ex: Transform response (body)
--------------------------------
input:
{
    link: ':media@app://625d32c61a0d682cbb64ff0c',
    urlInContent: 'Example image <img src=":media@app://625d32c61a0d682cbb64ff0c">',
    otherField: 'value'
}

output:
{
    link: 'https://s3.amazonaws.com/package-name/e4630b7d-18c2-4d87-adb7-5e7dccc5d633/image/0d64132a-d58a-48f7-907f-0fd93a4a0bff.jpg',
    urlInContent: 'Example image <img src="http://s3.amazonaws.com/package-name/e4630b7d-18c2-4d87-adb7-5e7dccc5d633/image/0d64132a-d58a-48f7-907f-0fd93a4a0bff.jpg">',
    otherField: 'value'
}
*/
```
