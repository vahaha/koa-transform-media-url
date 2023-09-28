const _ = require('lodash')
const Promise = require('bluebird')
const NodeCache = require('node-cache')
const cachingSignedUrl = new NodeCache({
    stdTTL: 10 * 60, // 10 minutes
    checkperiod: 3 * 60, // 3 minutes
})

const strRegexUuid =
    '[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}'
const regexPrefixTid = new RegExp('^' + strRegexUuid + '\\/')
const MEDIA_ID_PREFIX = ':media@app:'
const mediaIdRegex = /:media@app:\/\/[a-fA-F0-9]{24}/g
const sourceMediaIdRegex = /src\s*=\s*":media@app:\/\/[a-fA-F0-9]{24}"/g

// const domains = S3_DOMAIN_LIST.split('|')
//     .map(e => e?.replace(/\s/g, ''))
//     .filter(e => !!e)
let baseUrls = []
let baseUrlRegex = []
let urlRegex = []
let arrSourceRegex = []
let getUrlByIds
let getIdByUrls

exports.init = async function init({ fnGetBaseUrls, fnGetUrlByIds, fnGetIdByPaths }) {
    baseUrls = await Promise.resolve(fnGetBaseUrls())

    if (!baseUrls.length) {
        return
    }

    getUrlByIds = fnGetUrlByIds
    getIdByUrls = fnGetIdByPaths

    baseUrlRegex = baseUrls.map(baseUrl => {
        const fixBaseUrl = baseUrl.replace(/\./g, '\\.').replace(/\//g, '\\/')
        const reg = new RegExp(`${fixBaseUrl}\\/`)

        return reg
    })

    urlRegex = baseUrls.map(baseUrl => {
        const fixBaseUrl = baseUrl.replace(/\./g, '\\.').replace(/\//g, '\\/')
        const formular = `${fixBaseUrl}\\/${strRegexUuid}.+`
        const regexEndpoint = new RegExp(formular, 'g')

        return regexEndpoint
    })

    arrSourceRegex = baseUrls.map(baseUrl => {
        const fixBaseUrl = baseUrl.replace(/\./g, '\\.').replace(/\//g, '\\/')
        const testEndpoint = `src\\s*=\\s*"${fixBaseUrl}\\/${strRegexUuid}\\/.+?"`
        const regexEndpoint = new RegExp(testEndpoint, 'g')

        return regexEndpoint
    })
}

exports.scanMediaUrls = function scanMediaUrls(
    entity,
    path = 'entity',
    key,
    validFields,
    result = {},
) {
    if (!entity) {
        return result
    }

    if (Array.isArray(entity)) {
        for (let i = 0; i < entity.length; i++) {
            scanMediaUrls(entity[i], `${path}[${i}]`, null, validFields, result)
        }
    } else if (typeof entity === 'object') {
        const keys = Object.keys(entity)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            scanMediaUrls(entity[key], `${path}['${key}']`, key, validFields, result)
        }
    } else if (typeof entity === 'string') {
        if (validFields.length && !validFields.includes(key)) {
            return result
        }

        let found = false

        urlRegex.forEach(regexEndpoint => {
            regexEndpoint.lastIndex = 0
            if (regexEndpoint.test(entity)) {
                found = true
            }
        })

        if (found) {
            result[path] = entity
        }
    }

    return result
}

exports.scanMediaIds = function scanMediaIds(
    entity,
    path = 'entity',
    key,
    validFields,
    result = {},
) {
    if (!entity) {
        return result
    }

    if (Array.isArray(entity)) {
        for (let i = 0; i < entity.length; i++) {
            scanMediaIds(entity[i], `${path}[${i}]`, null, validFields, result)
        }
    } else if (typeof entity === 'object') {
        const keys = Object.keys(entity)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            scanMediaIds(entity[key], `${path}['${key}']`, key, validFields, result)
        }
    } else if (typeof entity === 'string') {
        if (validFields.length && !validFields.includes(key)) {
            return result
        }

        mediaIdRegex.lastIndex = 0
        const found = mediaIdRegex.test(entity)

        if (found) {
            result[path] = entity
        }
    }

    return result
}

exports.transformUrlToIdInContent = async function transformUrlToIdInContent(
    tid,
    content,
    fnGetIdByUrls = getIdByUrls,
) {
    let newContent = content
    const { links, paths, mapLinkToPath } = detectUrlFromContent(newContent)
    let mapPathToSignedUrl = {}
    const missedPaths = []

    paths.forEach(path => {
        const signedUrl = cachingSignedUrl.get(`${tid}/${path}`)
        if (signedUrl) {
            mapPathToSignedUrl[path] = signedUrl
        } else {
            missedPaths.push(path)
        }
    })

    const missedSignedUrls = await getAndCacheMapping(tid, missedPaths, fnGetIdByUrls)
    mapPathToSignedUrl = { ...mapPathToSignedUrl, ...missedSignedUrls }

    links.forEach(link => {
        const newLink = mapPathToSignedUrl[mapLinkToPath[link]] || 'invalid-uri'
        newContent = newContent.replaceAll(link, newLink)
    })

    return newContent
}

exports.transformIdToUrlInContent = async function transformIdToUrlInContent(
    tid,
    content,
    fnGetUrlByIds = getUrlByIds,
) {
    let newContent = content
    const { links, ids, mapLinkToId } = detectIdFromContent(newContent)
    let mapIdToSignedUrl = {}
    const missedIds = []

    ids.forEach(id => {
        const signedUrl = cachingSignedUrl.get(`${tid}/${id}`)
        if (signedUrl) {
            mapIdToSignedUrl[id] = signedUrl
        } else {
            missedIds.push(id)
        }
    })

    const missedSignedUrls = await getAndCacheMapping(tid, missedIds, fnGetUrlByIds)
    mapIdToSignedUrl = { ...mapIdToSignedUrl, ...missedSignedUrls }

    links.forEach(link => {
        const newLink = mapIdToSignedUrl[mapLinkToId[link]] || 'invalid-uri'
        newContent = newContent.replaceAll(link, newLink)
    })

    return newContent
}

exports.transformUrlAsFieldValueToId = async function transformUrlAsFieldValueToId(
    tid,
    value,
    fnGetIdByUrls = getIdByUrls,
) {
    let isMatched = false
    let caseNumber = -1

    urlRegex.some((regex, idx) => {
        regex.lastIndex = 0
        isMatched = regex.test(value)
        if (isMatched) {
            caseNumber = idx
        }

        return isMatched
    })

    if (!isMatched) {
        return value
    }

    const path = value
        .replace(/\?.*/, '') // remove query in url
        .replace(baseUrlRegex[caseNumber], '') // remove base url (ex: https://base.url/prefix/)
        .replace(regexPrefixTid, '')

    const signedUrl = cachingSignedUrl.get(`${tid}/${path}`)
    if (signedUrl) {
        return signedUrl
    }

    const missedSignedUrls = await getAndCacheMapping(tid, [path], fnGetIdByUrls)

    return missedSignedUrls[path] || 'invalid-uri'
}

exports.transformIdAsFieldValueToUrl = async function transformIdAsFieldValueToUrl(
    tid,
    value,
    fnGetUrlByIds = getUrlByIds,
) {
    mediaIdRegex.lastIndex = 0
    if (!mediaIdRegex.test(value)) {
        return value
    }

    const signedUrl = cachingSignedUrl.get(`${tid}/${value}`)

    if (signedUrl) {
        return signedUrl
    }

    const id = value.replace(`${MEDIA_ID_PREFIX}//`, '')
    const missedSignedUrls = await getAndCacheMapping(tid, [id], fnGetUrlByIds)

    return missedSignedUrls[id] || 'invalid-uri'
}

function detectUrlFromContent(content) {
    const links = []
    const paths = []
    const mapLinkToPath = {}

    arrSourceRegex.forEach((sourceRegex, idx) => {
        const sources = content.match(sourceRegex) || []
        const sourceUrls = sources.map(e =>
            e.replace(/\s/g, '').replace(/src="/, '').replace(/"/, ''),
        )
        links.push(...sourceUrls)

        sourceUrls.forEach(sourceUrl => {
            const path = sourceUrl
                .replace(/\?.*/, '') // remove query in url
                .replace(baseUrlRegex[idx], '') // remove base url (ex: https://base.url/prefix/)
                .replace(regexPrefixTid, '')
            paths.push(path)
            mapLinkToPath[sourceUrl] = path
        })
    })

    return {
        links: Array.from(new Set(links)),
        paths: Array.from(new Set(paths)),
        mapLinkToPath,
    }
}

function detectIdFromContent(content) {
    const links = []
    const ids = []
    const mapLinkToId = {}

    const sources = content.match(sourceMediaIdRegex) || []
    const sourceIds = sources.map(e => e.replace(/\s/g, '').replace(/src="/, '').replace(/"/, ''))
    links.push(...sourceIds)

    sourceIds.forEach(sourceId => {
        const id = sourceId.replace(`${MEDIA_ID_PREFIX}//`, '')
        ids.push(id)
        mapLinkToId[sourceId] = id
    })

    return {
        links: Array.from(new Set(links)),
        ids: Array.from(new Set(ids)),
        mapLinkToId,
    }
}

async function getAndCacheMapping(tid, items, fnTransform) {
    const batchPaths = _.chunk(items, 10)
    const setSignedUrls = await Promise.map(batchPaths, batchPath => fnTransform(tid, batchPath), {
        concurrency: 1,
    })
    const signedUrls = _.flatten(setSignedUrls)
    const mapPathToSignedUrl = {}

    items.forEach((path, index) => {
        const signedUrl = signedUrls[index] || 'invalid-path'
        cachingSignedUrl.set(`${tid}/${path}`, signedUrl)

        mapPathToSignedUrl[path] = signedUrl
    })

    return mapPathToSignedUrl
}
