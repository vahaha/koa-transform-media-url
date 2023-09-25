const uuid = require('uuid')
const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')

const S3_DOMAIN_LIST = 'https://s3.amazonaws.com/famtech-dev'

const MEDIA_ID_PREFIX = require('../../lib/transformer').__get__('MEDIA_ID_PREFIX')
const cachingSignedUrl = require('../../lib/transformer').__get__('cachingSignedUrl')

const tid = uuid.v4()

// const size = Math.round(Math.random() * 10 + 3)
const size = 23
const s3FileNames = Array(size)
    .fill(0)
    .map(() => uuid.v4() + '.jpg')
const mediaIds = Array(size)
    .fill(0)
    .map(() => new mongoose.Types.ObjectId().toString())
const paths = s3FileNames.map(fileName => `image/${fileName}`)
const mappingPathToId = {}
const mappingIdToRealUrl = {}
mediaIds.forEach((mediaId, idx) => {
    mappingPathToId[paths[idx]] = `${MEDIA_ID_PREFIX}//${mediaId}`
    mappingIdToRealUrl[mediaId] = `${S3_DOMAIN_LIST}/${tid}/${paths[idx]}?signed=true`
})

function fnGetIdByPath(tid, arrPath) {
    return arrPath.map(path => mappingPathToId[path])
}

function fnGetSignedUrlById(tid, arrId) {
    return arrId.map(id => mappingIdToRealUrl[id])
}

describe('Transform between url and id', () => {
    const hashedUrls = fnGetIdByPath(tid, paths)
    const realUrls = fnGetSignedUrlById(tid, mediaIds)
    let requestContent = ''
    let expectedResultRequestContent = ''
    hashedUrls.forEach((hashedUrl, idx) => {
        const randomText = faker.lorem.paragraph({ min: 1, max: 3 })
        requestContent += `<img src="${realUrls[idx]}"/>` + randomText
        expectedResultRequestContent += `<img src="${hashedUrl}"/>` + randomText
    })

    let responseContent = ''
    let expectedResultResponseContent = ''
    realUrls.forEach((realUrl, idx) => {
        const randomText = faker.lorem.paragraph({ min: 1, max: 3 })
        responseContent += `<img src="${hashedUrls[idx]}"/>` + randomText
        expectedResultResponseContent += `<img src="${realUrl}"/>` + randomText
    })

    describe('Get and cache mapping', () => {
        const getAndCacheMapping = require('../../lib/transformer').__get__('getAndCacheMapping')

        test('Get id by url', async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const expectedResult = {}
            const expectedCachedUrls = []
            paths.forEach((path, idx) => {
                expectedResult[path] = hashedUrls[idx]
                expectedCachedUrls[idx] = hashedUrls[idx]
            })

            const result = await getAndCacheMapping(tid, paths, fnGetIdByPath)
            const cachedUrls = paths.map(path => cachingSignedUrl.get(`${tid}/${path}`))

            expect(result).toMatchObject(expectedResult)
            expect(cachedUrls).toMatchObject(expectedCachedUrls)
        })

        test('Signed by id', async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const expectedResult = {}
            const expectedCachedUrls = []
            mediaIds.forEach((path, idx) => {
                expectedResult[path] = realUrls[idx]
                expectedCachedUrls[idx] = realUrls[idx]
            })

            const result = await getAndCacheMapping(tid, mediaIds, fnGetSignedUrlById)
            const cachedUrls = mediaIds.map(id => cachingSignedUrl.get(`${tid}/${id}`))

            expect(result).toMatchObject(expectedResult)
            expect(cachedUrls).toMatchObject(expectedCachedUrls)
        })
    })

    describe('Detect id from content', () => {
        const detectIdFromContent = require('../../lib/transformer').__get__('detectIdFromContent')

        test('Match one id', async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const id = mediaIds[0]
            const link = `${MEDIA_ID_PREFIX}//${id}`
            const content = `<img src="${link}"/>`
            const expectedResult = {
                links: [link],
                ids: [id],
                mapLinkToId: { [link]: id },
            }

            const result = await detectIdFromContent(content)

            expect(result).toMatchObject(expectedResult)
        })

        test('Match many id', async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const links = mediaIds.map(id => `${MEDIA_ID_PREFIX}//${id}`)
            const content = links
                .map(
                    link =>
                        `<img src="${link}"/>${faker.lorem.paragraph({
                            min: 1,
                            max: 3,
                        })}`,
                )
                .join()
            const mapLinkToId = {}
            links.forEach((link, idx) => (mapLinkToId[link] = mediaIds[idx]))
            const expectedResult = {
                links: Array.from(new Set(links)),
                ids: Array.from(new Set(mediaIds)),
                mapLinkToId,
            }

            const result = await detectIdFromContent(content)

            expect(result).toMatchObject(expectedResult)
        })
    })

    describe('Detect url from content', () => {
        const detectUrlFromContent = require('../../lib/transformer').__get__(
            'detectUrlFromContent',
        )

        test('Match one url', async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const path = paths[0]
            const link = `${S3_DOMAIN_LIST}/${tid}/${path}`
            const content = `<img src="${link}"/>`
            const expectedResult = {
                links: [link],
                paths: [path],
                mapLinkToPath: { [link]: path },
            }

            const result = await detectUrlFromContent(content)

            expect(result).toMatchObject(expectedResult)
        })

        test('Match many url', async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const links = paths.map(path => `${S3_DOMAIN_LIST}/${tid}/${path}`)
            const content = links
                .map(
                    link =>
                        `<img src="${link}"/>${faker.lorem.paragraph({
                            min: 1,
                            max: 3,
                        })}`,
                )
                .join()
            const mapLinkToPath = {}
            links.forEach((link, idx) => (mapLinkToPath[link] = paths[idx]))
            const expectedResult = {
                links: Array.from(new Set(links)),
                paths: Array.from(new Set(paths)),
                mapLinkToPath,
            }

            const result = await detectUrlFromContent(content)

            expect(result).toMatchObject(expectedResult)
        })
    })

    describe('Transform id to url in content', () => {
        const transformIdToUrlInContent = require('../../lib/transformer').transformIdToUrlInContent

        test("It's worked", async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const result = await transformIdToUrlInContent(tid, responseContent, fnGetSignedUrlById)

            expect(result).toBe(expectedResultResponseContent)
        })
    })

    describe('Transform url to id in content', () => {
        const transformUrlToIdInContent = require('../../lib/transformer').transformUrlToIdInContent

        test("It's worked", async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const result = await transformUrlToIdInContent(tid, requestContent, fnGetIdByPath)

            expect(result).toBe(expectedResultRequestContent)
        })
    })

    describe('Transform id to url as field value', () => {
        const transformIdAsFieldValueToUrl = require('../../lib/transformer')
            .transformIdAsFieldValueToUrl

        test("It's worked", async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const result = await transformIdAsFieldValueToUrl(
                tid,
                hashedUrls[0],
                fnGetSignedUrlById,
            )

            expect(result).toBe(realUrls[0])
        })
    })

    describe('Transform url to id as field value', () => {
        const transformUrlAsFieldValueToId = require('../../lib/transformer')
            .transformUrlAsFieldValueToId

        test("It's worked", async () => {
            await require('../../lib/transformer').init({ fnGetBaseUrls: () => [S3_DOMAIN_LIST] })
            const result = await transformUrlAsFieldValueToId(tid, realUrls[0], fnGetIdByPath)

            expect(result).toBe(hashedUrls[0])
        })
    })
})
