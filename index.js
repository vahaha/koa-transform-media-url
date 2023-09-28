const Promise = require('bluebird')
const _ = require('lodash')
const transformer = require('./lib/transformer')

exports.init = async function init({ fnGetBaseUrls, fnGetUrlByIds, fnGetIdByPaths }) {
    return transformer.init({ fnGetBaseUrls, fnGetUrlByIds, fnGetIdByPaths })
}

exports.transformRequest = ({ requestFields = [], fnGetIdByPaths }) => async (ctx, next) => {
    const { tid } = ctx.state.user
    const entity = ctx.request.body
    const root = 'entity'

    const matchedFields = transformer.scanMediaUrls(entity, root, null, requestFields)
    const paths = Object.keys(matchedFields)

    if (paths.length) {
        await Promise.map(
            paths,
            async path => {
                matchedFields[path] = await transformer.transformUrlToIdInContent(
                    tid,
                    matchedFields[path],
                    fnGetIdByPaths,
                )
                matchedFields[path] = await transformer.transformUrlAsFieldValueToId(
                    tid,
                    matchedFields[path],
                    fnGetIdByPaths,
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

exports.transformResponse = ({ responseFields = [], fnGetUrlByIds }) => async (ctx, next) => {
    const { tid } = ctx.state.user

    await Promise.resolve(next())

    const entity = ctx.body
    const root = 'entity'

    const matchedFields = transformer.scanMediaIds(entity, root, null, responseFields)
    const paths = Object.keys(matchedFields)

    if (paths.length) {
        await Promise.map(
            paths,
            async path => {
                matchedFields[path] = await transformer.transformIdToUrlInContent(
                    tid,
                    matchedFields[path],
                    fnGetUrlByIds,
                )
                matchedFields[path] = await transformer.transformIdAsFieldValueToUrl(
                    tid,
                    matchedFields[path],
                    fnGetUrlByIds,
                )
            },
            { concurrency: 1 },
        )

        paths.forEach(path => {
            _.set({ [root]: entity }, path, matchedFields[path])
        })
    }
}

exports.transformBoth = ({
    requestFields = [],
    responseFields = [],
    fnGetIdByPaths,
    fnGetUrlByIds,
}) => async (ctx, next) => {
    this.transformRequest({ requestFields, fnGetIdByPaths })(ctx, next)
    this.transformResponse({ responseFields, fnGetUrlByIds })(ctx, next)
}
