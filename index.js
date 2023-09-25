const Promise = require('bluebird')
const _ = require('lodash')
const transformer = require('./lib/transformer')

exports.init = async function init(fnGetBaseUrlList) {
    return transformer.init(fnGetBaseUrlList)
}

exports.transformRequest = (validFields = [], fnGetIdByPath) => async (ctx, next) => {
    const { tid } = ctx.state.user
    const entity = ctx.request.body
    const root = 'entity'

    const matchedFields = transformer.scanMediaUrls(entity, root, null, validFields)
    const paths = Object.keys(matchedFields)

    if (paths.length) {
        await Promise.map(
            paths,
            async path => {
                matchedFields[path] = await transformer.transformUrlToIdInContent(
                    tid,
                    matchedFields[path],
                    fnGetIdByPath,
                )
                matchedFields[path] = await transformer.transformUrlAsFieldValueToId(
                    tid,
                    matchedFields[path],
                    fnGetIdByPath,
                )
            },
            { concurrency: 1 },
        )

        paths.forEach(path => {
            _.set({ [root]: entity }, path, matchedFields[path])
        })
    }

    return next()
}

exports.transformResponse = (validFields = [], fnGetSignedUrlById) => async (ctx, next) => {
    const { tid } = ctx.state.user

    await Promise.resolve(next())

    const entity = ctx.body
    const root = 'entity'

    const matchedFields = transformer.scanMediaIds(entity, root, null, validFields)
    const paths = Object.keys(matchedFields)

    if (paths.length) {
        await Promise.map(
            paths,
            async path => {
                matchedFields[path] = await transformer.transformIdToUrlInContent(
                    tid,
                    matchedFields[path],
                    fnGetSignedUrlById,
                )
                matchedFields[path] = await transformer.transformIdAsFieldValueToUrl(
                    tid,
                    matchedFields[path],
                    fnGetSignedUrlById,
                )
            },
            { concurrency: 1 },
        )

        paths.forEach(path => {
            _.set({ [root]: entity }, path, matchedFields[path])
        })
    }
}

exports.transformBoth = (requestFields, responseFields) => async (ctx, next) => {
    this.transformRequest(requestFields)(ctx, next)
    this.transformResponse(responseFields)(ctx, next)
}
