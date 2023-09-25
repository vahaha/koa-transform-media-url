const uuid = require('uuid')
const mongoose = require('mongoose')
const { faker } = require('@faker-js/faker')

const transformer = require('../index')

const S3_DOMAIN_LIST = 'https://s3.amazonaws.com/famtech-dev'

const MEDIA_ID_PREFIX = require('../lib/transformer').__get__('MEDIA_ID_PREFIX')

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

describe('Transform request & response', () => {
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

    describe('Transform request body', () => {
        test('Url in content', async () => {
            await require('../lib/transformer').init(() => [S3_DOMAIN_LIST])
            const ctx = {
                state: { user: { tid } },
                request: { body: { content: requestContent } },
            }
            const next = () => {}

            await transformer.transformRequest(['content'], fnGetIdByPath)(ctx, next)

            expect(ctx.request.body.content).toBe(expectedResultRequestContent)
        })

        test('Url as field value', async () => {
            await require('../lib/transformer').init(() => [S3_DOMAIN_LIST])
            const ctx = {
                state: { user: { tid } },
                request: { body: { content: realUrls[0] } },
            }
            const next = () => {}

            await transformer.transformRequest(['content'], fnGetIdByPath)(ctx, next)

            expect(ctx.request.body.content).toBe(hashedUrls[0])
        })

        test('Url in content and be as field value', async () => {
            await require('../lib/transformer').init(() => [S3_DOMAIN_LIST])
            const ctx = {
                state: { user: { tid } },
                request: {
                    body: { content: requestContent, field: realUrls[0] },
                },
            }
            const next = () => {}

            await transformer.transformRequest(['content', 'field'], fnGetIdByPath)(ctx, next)

            expect(ctx.request.body.content).toBe(expectedResultRequestContent)
            expect(ctx.request.body.field).toBe(hashedUrls[0])
        })
    })

    describe('Transform response body', () => {
        test('Url in content', async () => {
            await require('../lib/transformer').init(() => [S3_DOMAIN_LIST])
            const ctx = {
                state: { user: { tid } },
            }
            const next = async () => {
                ctx.body = { content: responseContent }
            }

            await transformer.transformResponse(['content'], fnGetSignedUrlById)(ctx, next)

            expect(ctx.body.content).toBe(expectedResultResponseContent)
        })

        test('Url as field value', async () => {
            await require('../lib/transformer').init(() => [S3_DOMAIN_LIST])
            const ctx = {
                state: { user: { tid } },
            }
            const next = async () => {
                ctx.body = { content: hashedUrls[0] }
            }

            await transformer.transformResponse(['content'], fnGetSignedUrlById)(ctx, next)

            expect(ctx.body.content).toBe(realUrls[0])
        })

        test('Url in content and be as a field value', async () => {
            await require('../lib/transformer').init(() => [S3_DOMAIN_LIST])
            const ctx = {
                state: { user: { tid } },
            }
            const next = async () => {
                ctx.body = { content: responseContent, field: hashedUrls[0] }
            }

            await transformer.transformResponse(['content', 'field'], fnGetSignedUrlById)(ctx, next)

            expect(ctx.body.content).toBe(expectedResultResponseContent)
            expect(ctx.body.field).toBe(realUrls[0])
        })
    })
})
