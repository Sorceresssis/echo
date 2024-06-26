import path from "path"
import fs from "fs"
import fm from "../util/FileManager"
import { injectable, inject } from "inversify"
import InjectType from "../provider/injectType"
import DIContainer, { type LibraryEnv } from "../provider/container"
import i18n from "../locale"
import Result from "../util/Result"
import ImageService from "./ImageService"
import RecordDao, { type QueryRecordsSortRule } from "../dao/RecordDao"
import type RecordExtraDao from "../dao/RecordExtraDao"
import type DirnameDao from "../dao/DirnameDao"
import type AuthorDao from "../dao/AuthorDao"
import type RecordAuthorDao from "../dao/RecordAuthorDao"
import type TagDao from "../dao/TagDao"
import type RecordTagDao from "../dao/RecordTagDao"
import type SeriesDao from "../dao/SeriesDao"
import type RecordSeriesDao from "../dao/RecordSeriesDao"
import type AuthorService from "./AuthorService"
import { isNotEmptyString } from "../util/common"


@injectable()
class RecordService {
    private infoStatusFilterMap: Map<string, string[]>

    public constructor(
        @inject(InjectType.LibraryEnv) private libEnv: LibraryEnv,
        @inject(InjectType.RecordDao) private recordDao: RecordDao,
        @inject(InjectType.RecordExtraDao) private recordExtraDao: RecordExtraDao,
        @inject(InjectType.DirnameDao) private dirnameDao: DirnameDao,
        @inject(InjectType.AuthorDao) private authorDao: AuthorDao,
        @inject(InjectType.RecordTagDao) private recordTagDao: RecordTagDao,
        @inject(InjectType.TagDao) private tagDao: TagDao,
        @inject(InjectType.RecordSeriesDao) private recordSeriesDao: RecordSeriesDao,
        @inject(InjectType.SeriesDao) private seriesDao: SeriesDao,
        @inject(InjectType.RecordAuthorDao) private recordAuthorDao: RecordAuthorDao,
    ) {
        this.infoStatusFilterMap = new Map<string, string[]>()
    }

    public queryRecordDetail(id: number): VO.RecordDetail | undefined {
        const record = this.recordDao.queryRecordById(id) as VO.RecordDetail | undefined
        if (record === void 0) return record

        record.resourcePath = record.dirname && record.basename ? path.join(record.dirname, record.basename) : null
        record.authors = DIContainer.get<AuthorService>(InjectType.AuthorService).queryAuthorsByRecordId(id)
        record.tags = this.tagDao.queryTagsByRecordId(id)
        record.series = this.seriesDao.querySeriesByRecordId(id)

        const extra = this.recordExtraDao.queryRecordExtraByRecordId(id)
        record.intro = extra?.intro || ''
        record.info = extra?.info || ''

        const {
            main,
            sampleImages
        } = this.libEnv.genRecordImagesDirPathConstructor(record.id).findMainAndSampleImageFilePaths()

        record.cover = main
        record.sampleImages = sampleImages

        return record
    }

    public queryRecordRecmds(options: DTO.QueryRecordRecommendationsOptions): DTO.Page<VO.RecordRecommendation> {
        const defaultSortRule: QueryRecordsSortRule[] = [
            { field: 'id', order: 'ASC' },
            { field: 'title', order: 'ASC' },
            { field: 'rate', order: 'DESC' },
            { field: 'release_date', order: 'DESC' }
        ]
        const sortRule: QueryRecordsSortRule[] = []
        switch (options.sortField) {
            case 'time':
                sortRule.push({ field: 'id', order: options.order })
                break
            case 'title':
                sortRule.push({ field: 'title', order: options.order })
                break
            case 'rate':
                sortRule.push({ field: 'rate', order: options.order })
                break
            case 'release_date':
                sortRule.push({ field: 'release_date', order: options.order })
                break
            default:
                throw Error('invalid sort field')
        }
        defaultSortRule.forEach((rule) => {
            if (rule.field !== sortRule[0].field) {
                sortRule.push(rule)
            }
        })
        const page = this.recordDao.queryRecordsByKeyword(
            options.keyword.trim(),
            sortRule,
            this.generateFilters(options.filters),
            (options.pn - 1) * options.ps,
            options.ps,
            {
                type: options.type,
                authorId: options.authorId,
                seriesId: options.seriesId
            },
        ) as DTO.Page<any>

        // 添加作者和标签
        page.rows.forEach(row => {
            row.cover = this.libEnv.genRecordImagesDirPathConstructor(row.id).findMainImageFilePath()
            row.resourcePath = row.dirname && row.basename ? path.join(row.dirname, row.basename) : null
            delete row.dirname
            delete row.basename
            row.authors = DIContainer.get<AuthorService>(InjectType.AuthorService).queryAuthorsByRecordId(row.id)
            row.tags = this.tagDao.queryTagsByRecordId(row.id)
        })

        return page
    }

    public querySimilarRecordRecmds(id: number, count: number = 10): VO.RecordRecommendation[] {
        const similarMap = new Map<number, number>()

        // 标签相似度
        this.recordTagDao.querySimilarRecordIdsByRecordId(id, count).forEach(({ id, similarity }) => {
            similarMap.set(id, similarity)
        })

        // 作者相似度, 相当于0.1的标签相似度
        this.recordAuthorDao.queryRandomRecordIdsOfSameAuthorByRecordId(id, count).forEach(id => {
            if (similarMap.has(id)) {
                similarMap.set(id, similarMap.get(id) as number + 0.1)
            } else {
                similarMap.set(id, 0.1)
            }
        })

        // 系列相似度, 相当于0.1的标签相似度
        this.recordSeriesDao.queryRandomRecordIdsOfSameSeriesByRecordId(id, count).forEach(id => {
            if (similarMap.has(id)) {
                similarMap.set(id, similarMap.get(id) as number + 0.1)
            } else {
                similarMap.set(id, 0.1)
            }
        })

        const similar: any[] = Array.from(similarMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(item => this.recordDao.queryRecordById(item[0]))
            .filter(record => record)

        similar.forEach(record => {
            record.cover = this.libEnv.genRecordImagesDirPathConstructor(record.id).findMainImageFilePath()
            record.resourcePath = record.dirname && record.basename ? path.join(record.dirname, record.basename) : null
            delete record.dirname
            delete record.basename
            record.authors = DIContainer.get<AuthorService>(InjectType.AuthorService).queryAuthorsByRecordId(record.id)
            record.tags = this.tagDao.queryTagsByRecordId(record.id)
        })

        return similar
    }

    private generateFilters(input: boolean[]): string[] {
        const key = input.toString()
        if (this.infoStatusFilterMap.has(key)) {
            return this.infoStatusFilterMap.get(key) as string[]
        }

        const result: string[] = []
        const current: string[] = new Array(input.length)
        this.generateFilter(input, 0, current, result)
        this.infoStatusFilterMap.set(key, result)

        return result
    }

    private generateFilter(input: boolean[], index: number, current: string[], result: string[]): void {
        if (index === input.length) {
            result.push(current.join(''))
            return
        }
        // 如果是0，既可以是0，也可以是1，如果是1，只能是1
        if (input[index]) {
            current[index] = '1'
            this.generateFilter(input, index + 1, current, result)
        }
        else {
            current[index] = '0'
            this.generateFilter(input, index + 1, current, result)
            current[index] = '1'
            this.generateFilter(input, index + 1, current, result)
        }
    }

    // 查询作者的作品
    public queryAuthorMasterpieces(authorId: number): { id: number, title: string, cover: string | undefined }[] {
        const records = this.recordDao.queryRecordProfilesOfOrderRateByAuthor(authorId, 3)
        records.forEach(record => record.cover = this.libEnv.genRecordImagesDirPathConstructor(record.id).findMainImageFilePath())
        return records
    }

    // 根据属性回收
    public recycleRecordByAttribute(formData: DTO.DeleteRecordByAttributeForm): void {
        this.libEnv.db.transaction(() => {
            const dirnamePath = formData.dirnamePath.trim()
            const tagTitle = formData.tagTitle.trim()
            const seriesName = formData.seriesName.trim()

            let pn = 0
            const rowCount = 200
            let recordIds: number[]

            if (dirnamePath.length) {
                const dirnameId = this.dirnameDao.queryDirnameIdByPath(formData.dirnamePath)
                if (dirnameId) {
                    pn = 0
                    do {
                        recordIds = this.recordDao.queryRecordIdsByDirnameId(dirnameId, pn++ * rowCount, rowCount)
                        this.recordDao.updateRecordRecycledByIds(recordIds, 1)
                    } while (recordIds.length === rowCount)
                }
            }

            if (tagTitle.length) {
                const tagId = this.tagDao.queryTagIdByTitle(formData.tagTitle)
                if (tagId) {
                    pn = 0
                    do {
                        recordIds = this.recordTagDao.queryRecordIdsByTagId(tagId, pn++ * rowCount, rowCount)
                        this.recordDao.updateRecordRecycledByIds(recordIds, 1)
                    } while (recordIds.length === rowCount)
                }
            }

            if (seriesName.length) {
                const seriesId = this.seriesDao.querySeriesIdByName(formData.seriesName)
                if (seriesId) {
                    pn = 0
                    do {
                        recordIds = this.recordSeriesDao.queryRecordIdsBySeriesId(seriesId, pn++ * rowCount, rowCount)
                        this.recordDao.updateRecordRecycledByIds(recordIds, 1)
                    } while (recordIds.length === rowCount)
                }
            }
        })
    }

    public batchProcessing(type: DTO.RecordBatchProcessingType, recordIds: number[]) {
        switch (type) {
            case 'recycle':
                this.recycleRecord(recordIds)
                break
            case 'recover':
                this.recoverRecycledRecord(recordIds)
                break
            case 'delete_recycled':
                this.deleteRecycledRecord(recordIds)
                break
            case 'delete_recycled_all':
                this.deleteAllRecycledRecord()
                break
            default:
                throw Error('invalid type')
        }
    }

    public recycleRecord(recordIds: number[]): void {
        this.recordDao.updateRecordRecycledByIds(recordIds, 1)
    }

    public recoverRecycledRecord(recordIds: number[]): void {
        this.recordDao.updateRecordRecycledByIds(recordIds, 0)
    }

    public deleteRecycledRecord(recordIds: number[]): void {
        recordIds.forEach(id => this.libEnv.db.transaction(() => {
            const record = this.recordDao.queryRecordById(id)
            if (record && this.recordDao.deleteRecordOfRecycledById(id) > 0) {
                // 如果删除record不成功，说明不存在或者没有被回收
                this.recordExtraDao.deleteRecordExtraById(id) // 删除extra
                this.recordAuthorDao.deleteRecordAuthorByRecordId(id) // author链接
                this.recordTagDao.deleteRecordTagByRecordId(id) // tag链接
                this.recordSeriesDao.deleteRecordSeriesByRecordId(id) // series链接

                fm.rmdirRecursive(this.libEnv.genRecordImagesDirPathConstructor(id).getImagesDirPath())
            }
        }))
    }

    public deleteAllRecycledRecord(): void {
        const rowCount = 200
        let recordIds: number[]
        do {
            recordIds = this.recordDao.queryRecordIdsByRecycled(1, 0, rowCount)
            this.deleteRecycledRecord(recordIds)
        } while (rowCount === recordIds.length)
    }

    public updateRecordTagAuthorSum(id: PrimaryKey, value?: string): void {
        if (value === void 0) { value = this.getTagAuthorSum(id) }
        this.recordDao.updateRecordTagAuthorSumById(id, value)
    }

    private getTagAuthorSum(id: PrimaryKey): string {
        const authors = this.authorDao.queryAuthorsAndRoleByRecordId(id)
        const tags = this.tagDao.queryTagsByRecordId(id)
        return authors.map(author => author.name).concat(tags.map(tag => tag.title)).join(' ')
    }

    private editRecordAttribute(
        recordId: PrimaryKey,
        addAuthors: DTO.AuthorIdAndRole[],
        editAuthorsRole: DTO.AuthorIdAndRole[],
        removeAuthorIds: PrimaryKey[],
        addTagIds: PrimaryKey[],
        removeTagIds: PrimaryKey[],
        addSeriesIds: PrimaryKey[],
        removeSeriesIds: PrimaryKey[],
    ) {
        this.recordAuthorDao.insertRecordAuthorByRecordIdAuthorIds(recordId, addAuthors)
        this.recordAuthorDao.updateRoleByRecordIdAuthorId(recordId, editAuthorsRole)
        this.recordAuthorDao.deleteRecordAuthorByRecordIdAuthorIds(recordId, removeAuthorIds)

        this.recordTagDao.insertRecordTagByRecordIdTagIds(recordId, addTagIds)
        this.recordTagDao.deleteRecordTagByRecordIdTagIds(recordId, removeTagIds)

        this.recordSeriesDao.insertRecordSeriesByRecordIdSeriesIds(recordId, addSeriesIds)
        this.recordSeriesDao.deleteRecordSeriesByRecordIdSeriesIds(recordId, removeSeriesIds)
    }

    private generateInfoStatus<T extends string | null | undefined>(cover: T, hyperlink: T, basename: T) {
        return (cover ? '1' : '0') + (hyperlink ? '1' : '0') + (basename ? '1' : '0');
    }

    public async editRecord(formData: DTO.EditRecordForm): Promise<Result> {
        formData.dirname = formData.dirname.trim()
        formData.basename = formData.basename.trim()
        // 检查路径是否合法
        if ((formData.dirname !== '' && !fm.isLegalAbsolutePath(formData.dirname))
            || (formData.basename !== '' && !fm.isLegalFileName(formData.basename))) {
            return Result.error(i18n.global.t('resourcePathIllegal'))
        }

        const opType = formData.id === 0 ? 'add' : 'edit'

        const record = {} as Entity.Record
        record.id = formData.id
        record.title = formData.title.trim()
        record.rate = formData.rate
        record.hyperlink = formData.hyperlink.trim() || null
        record.releaseDate = isNotEmptyString(formData.releaseDate) ? formData.releaseDate : null
        record.basename = formData.basename || null
        record.infoStatus = this.generateInfoStatus(
            opType === 'add' ? formData.cover : formData.originCover, // add => cover, edit => originCover
            record.hyperlink, record.basename)
        record.tagAuthorSum = null

        const recordExtra: Entity.RecordExtra = {
            id: formData.id,
            info: formData.info,
            intro: formData.intro
        }

        this.libEnv.db.transaction(() => {
            // 如果dirname存在返回id，不存在插入dirname表返回id
            if (formData.dirname === '') {
                record.dirnameId = 0
            } else {
                formData.dirname = path.resolve(formData.dirname)
                record.dirnameId = this.dirnameDao.queryDirnameIdByPath(formData.dirname) || this.dirnameDao.insertDirname(formData.dirname)
            }

            // record 和 recordExtra 表
            if (opType === 'add') {
                recordExtra.id = record.id = this.recordDao.insertRecord(record)
                this.recordExtraDao.insetRecordExtra(recordExtra)
            } else {
                this.recordDao.updateRecord(record)
                this.recordExtraDao.updateRecordExtra(recordExtra)
            }

            // tag, author, series 表
            const addTagIds = formData.addTags.map(title => this.tagDao.queryTagIdByTitle(title) || this.tagDao.insertTag(title))
            const addSeriesIds = formData.addSeries.map(name => this.seriesDao.querySeriesIdByName(name) || this.seriesDao.insertSeries(name))
            this.editRecordAttribute(
                record.id,
                formData.addAuthors,
                formData.editAuthorsRole,
                formData.removeAuthors,
                addTagIds,
                formData.removeTags,
                addSeriesIds,
                formData.removeSeries
            )

            // 等待record的属性都设置完毕,开始更新冗余字段tagAuthorSum
            this.updateRecordTagAuthorSum(record.id)
        })
        const recordImagesDirPathConstructor = this.libEnv.genRecordImagesDirPathConstructor(record.id)
        // cover != originCover 说明cover有变化
        if (formData.cover && isNotEmptyString(formData.cover) && formData.cover !== formData.originCover) {
            if (opType === 'edit') {
                const oldMain = recordImagesDirPathConstructor.findMainImageFilePath()
                if (oldMain) fm.unlinkIfExistsSync(oldMain)
            }

            await ImageService.handleNormalImage(formData.cover, recordImagesDirPathConstructor.getNewMainImageFilePath())
        }

        formData.removeSampleImages.forEach(image => fm.unlinkIfExistsSync(image))

        const editSampleImages = formData.editSampleImages
        for (let i = 0; i < editSampleImages.length; i++) {
            const { type, path, idx } = editSampleImages[i]
            if (type === 'add') {
                await ImageService.handleNormalImage(path, recordImagesDirPathConstructor.getNewSampleImageFilePath(idx))
            } else if (type === 'move') {
                fs.renameSync(path, recordImagesDirPathConstructor.getNewSampleImageFilePath(idx))
            }
        }
        // formData.editSampleImages.forEach(item => {
        //     if (item.type === 'add') {
        //         ImageService.handleNormalImage(item.path, recordImagesDirPathConstructor.getNewSampleImageFilePath(item.idx))
        //     } else if (item.type === 'move') {
        //         fs.renameSync(item.path, recordImagesDirPathConstructor.getNewSampleImageFilePath(item.idx))
        //     }
        // })

        return Result.success()
    }

    public async addBatchRecord(formData: DTO.EditRecordForm, distinct: boolean): Promise<Result> {
        if (!fm.isFolderExists(formData.batchDir)) {
            return Result.error(i18n.global.t('folderNotExists')) // 文件夹不存在, 直接返回
        }

        // 准备数据
        const record = {} as Entity.Record
        record.id = formData.id
        record.rate = formData.rate
        record.hyperlink = formData.hyperlink.trim() || null
        record.releaseDate = isNotEmptyString(formData.releaseDate) ? formData.releaseDate : null
        record.infoStatus = this.generateInfoStatus(void 0, record.hyperlink, 'batch')
        record.tagAuthorSum = null

        const recordExtra: Entity.RecordExtra = {
            id: formData.id,
            info: formData.info,
            intro: formData.intro
        }

        this.libEnv.db.transaction(() => {
            // 插入tag, series, author
            const addTagIds = formData.addTags.map(
                title => this.tagDao.queryTagIdByTitle(title) || this.tagDao.insertTag(title)
            )
            const addSeriesIds = formData.addSeries.map(
                name => this.seriesDao.querySeriesIdByName(name) || this.seriesDao.insertSeries(name)
            )

            formData.batchDir = path.resolve(formData.batchDir)
            record.dirnameId = this.dirnameDao.queryDirnameIdByPath(formData.batchDir) || this.dirnameDao.insertDirname(formData.batchDir)

            const dirContents = fm.dirContentsWithType(formData.batchDir)
            dirContents.forEach((item, index) => {
                // 如果是文件，去掉后缀
                record.title = item.type === 'file' ? path.parse(item.name).name : item.name
                // 如果存在，跳过
                if (distinct && this.recordDao.queryRecordIdByTitle(record.title)) return
                record.basename = item.name
                // 向record和recordExtra表插入数据
                recordExtra.id = record.id = this.recordDao.insertRecord(record)
                this.recordExtraDao.insetRecordExtra(recordExtra)

                // 得到了record的id，开始插入把关系链接起来
                this.editRecordAttribute(
                    record.id,
                    formData.addAuthors,
                    formData.editAuthorsRole,
                    formData.removeAuthors,
                    addTagIds,
                    formData.removeTags,
                    addSeriesIds,
                    formData.removeSeries
                )

                // 因为是批量添加，所有的record的tagAuthorSum都是一样的，所以只需要在第一个record的时候更新一次
                if (index === 0) {
                    record.tagAuthorSum = this.getTagAuthorSum(record.id)
                    this.updateRecordTagAuthorSum(record.id, record.tagAuthorSum)
                }
            })
        })

        return Result.success()
    }
}


export default RecordService