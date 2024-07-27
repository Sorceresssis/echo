import n_path from "path"
import n_fs, { promises as n_fsp } from "fs"
import { injectable, inject } from "inversify"
import Ajv from "ajv"
import { type OutputInfo } from "sharp"
import ECHO_METADATA_SCHEMA from "../constant/echo_metadata_schema"
import DIContainer, { type LibraryEnv } from "../provider/container"
import InjectType from "../provider/injectType"
import fm from "../util/FileManager"
import appPaths from "../app/appPaths"
import { isNotEmptyString, diffArray } from "../util/common"
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


@injectable()
class RecordService {
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
        private infoStatusFilterMap = new Map<string, string[]>(),
        private echoMetadataValidator = new Ajv().compile(ECHO_METADATA_SCHEMA)
    ) {
    }

    public queryRecordDetail(id: number): VO.RecordDetail | undefined {
        const record = this.recordDao.queryRecordById(id) as VO.RecordDetail | undefined
        if (!record) return

        record.resourcePath = record.dirname && record.basename ? n_path.join(record.dirname, record.basename) : null
        record.authors = DIContainer.get<AuthorService>(InjectType.AuthorService).queryAuthorsByRecordId(id)
        record.tags = this.tagDao.queryTagsByRecordId(id)
        record.series = this.seriesDao.querySeriesByRecordId(id)

        const extra = this.recordExtraDao.queryRecordExtraByRecordId(id)

        if (!extra) return
        record.plot = extra.plot
        record.reviews = extra.reviews
        record.info = extra.info

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
            row.resourcePath = row.dirname && row.basename ? n_path.join(row.dirname, row.basename) : null
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
            record.resourcePath = record.dirname && record.basename ? n_path.join(record.dirname, record.basename) : null
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
        this.libEnv.db.transactionExec(() => {
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
        recordIds.forEach(id => this.libEnv.db.transactionExec(() => {
            const record = this.recordDao.queryRecordById(id)
            if (record && this.recordDao.deleteRecordOfRecycledById(id) > 0) {
                // 如果删除record不成功，说明不存在或者没有被回收
                this.recordExtraDao.deleteRecordExtraById(id) // 删除extra
                this.recordAuthorDao.deleteByRecordId(id) // author链接
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
        this.recordAuthorDao.insertByRecordIdAuthorIds(recordId, addAuthors)
        this.recordAuthorDao.updateRoleByRecordIdAuthorId(recordId, editAuthorsRole)
        this.recordAuthorDao.deleteByRecordIdAuthorIds(recordId, removeAuthorIds)

        this.recordTagDao.insertRecordTagByRecordIdTagIds(recordId, addTagIds)
        this.recordTagDao.deleteRecordTagByRecordIdTagIds(recordId, removeTagIds)

        this.recordSeriesDao.insertRecordSeriesByRecordIdSeriesIds(recordId, addSeriesIds)
        this.recordSeriesDao.deleteRecordSeriesByRecordIdSeriesIds(recordId, removeSeriesIds)
    }

    private generateInfoStatus(cover: any, hyperlink: any, basename: any) {
        return (cover ? '1' : '0') + (hyperlink ? '1' : '0') + (basename ? '1' : '0');
    }

    // NOTE 涉及路径的保存，保存前用 path.resolve 处理一下。把`C:bar\foo\`转化成`C:bar\foo`。
    public async editRecord(formData: DTO.EditRecordForm): Promise<Result> {
        formData.dirname = formData.dirname.trim()
        formData.basename = formData.basename.trim()

        // 检查路径是否合法, 不检查是否存在
        if ((formData.dirname !== '' && !fm.isLegalAbsolutePath(formData.dirname))
            || (formData.basename !== '' && !fm.isLegalFileName(formData.basename))) {
            return Result.error(i18n.global.t('resourcePathIllegal'))
        }

        const opType = formData.id === 0 ? 'add' : 'edit'

        formData.hyperlink = formData.hyperlink.trim()
        formData.title = formData.title.trim()
        formData.searchText = formData.searchText.trim()
        const record = this.recordDao.recordEntityFactory(
            formData.title.trim(),
            formData.rate,
            formData.hyperlink,
            formData.basename,
            formData.releaseDate,
            this.generateInfoStatus(opType === 'add' ? formData.cover : formData.originCover, formData.hyperlink, formData.basename),
            null,
            formData.searchText.trim(),
            0,
            formData.id,
        )
        const recordExtra = this.recordExtraDao.recordExtraFactory(
            formData.id,
            formData.plot,
            formData.reviews,
            formData.info,
        )

        let srcFileIsBound = false
        const updatedAuthors: VO.RecordAuthorProfile[] = []
        const updatedTags: Domain.Tag[] = []
        const updatedSeries: Domain.Series[] = []
        this.libEnv.db.transactionExec(() => {
            if (formData.dirname) {
                formData.dirname = n_path.resolve(formData.dirname)
                record.dirnameId = this.dirnameDao.queryDirnameIdByPath(formData.dirname) || this.dirnameDao.insertDirname(formData.dirname)
            }

            if (opType === 'add') {
                if (record.dirnameId
                    && record.basename
                    && this.recordDao.queryRecordIdByDirnameIdAndBasename(record.dirnameId, record.basename)
                ) {
                    srcFileIsBound = true
                    return
                }
                recordExtra.id = record.id = this.recordDao.insertRecord(record)
                this.recordExtraDao.insetRecordExtra(recordExtra)
            } else {
                this.recordDao.updateRecord(record)
                this.recordExtraDao.updateRecordExtra(recordExtra)
            }

            // tag, author, series 表
            const addTagIds = formData.addTags
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)
                .map(tag => this.tagDao.queryTagIdByTitle(tag) || this.tagDao.insertTag(tag))
            const addSeriesIds = formData.addSeries
                .map(serie => serie.trim())
                .filter(serie => serie.length > 0)
                .map(serie => this.seriesDao.querySeriesIdByName(serie) || this.seriesDao.insertSeries(serie))
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
            updatedAuthors.push(...this.authorDao.queryAuthorsAndRoleByRecordId(record.id))
            updatedTags.push(... this.tagDao.queryTagsByRecordId(record.id))
            updatedSeries.push(...this.seriesDao.querySeriesByRecordId(record.id))

            const tagAuthorSum = updatedAuthors.map(author => author.name).concat(updatedTags.map(tag => tag.title)).join(' ')
            this.recordDao.updateRecordTagAuthorSumById(record.id, tagAuthorSum || null)
        })

        // 直接退出
        if (srcFileIsBound) {
            return Result.error('添加的源文件已经被其他记录绑定')
        }

        // 图片处理
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
                n_fs.renameSync(path, recordImagesDirPathConstructor.getNewSampleImageFilePath(idx))
            }
        }

        // 把数据写回 metadata
        if (record.dirnameId && record.basename) {
            const srcPath = n_path.join(formData.dirname, record.basename)
            try {
                const stats = await n_fsp.stat(srcPath)
                if (stats.isDirectory()) {
                    const metaFilePath = appPaths.getEchoMetadataPath(srcPath)
                    let oldMetadata: Object = {}
                    try {
                        const parsedData = JSON.parse(await n_fsp.readFile(metaFilePath, 'utf-8'))
                        oldMetadata = typeof parsedData === 'object' ? parsedData : {}
                    } catch { }
                    const newMetadata: Entity.EchoMetadata = {
                        ...oldMetadata,
                        ...{
                            title: record.title,
                            plot: recordExtra.plot,
                            release_date: record.releaseDate ?? '',
                            authors: updatedAuthors.map(author => ({ name: author.name, role: author.role ?? '' })),
                            series: updatedSeries.map(series => series.name),
                            tags: updatedTags.map(tag => tag.title),
                            rate: record.rate,
                            reviews: recordExtra.reviews,
                            info: recordExtra.info,
                            hyperlink: record.hyperlink ?? '',
                            search_text: record.search_text
                        }
                    }
                    await n_fsp.mkdir(appPaths.getMetadataDir(srcPath), { recursive: true })
                    await n_fsp.writeFile(metaFilePath, JSON.stringify(newMetadata, null, 4))
                }
            } catch { }
        }

        return Result.success()
    }

    private async getMetadata(srcPath: string) {
        const metaFilePath = appPaths.getEchoMetadataPath(srcPath)
        let rawData: string
        try {
            rawData = await n_fsp.readFile(metaFilePath, 'utf-8')
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw Error('Error: metadata file not found')
            } else if (error.code === 'EACCES') {
                throw Error('Error: No permission to read the metadata file')
            } else {
                throw Error('Error: Unknown error, ' + error.message)
            }
        }

        let metadata: Entity.EchoMetadata
        try {
            metadata = JSON.parse(rawData)
            // NOTE 过滤掉空值字符串
            metadata.authors = metadata.authors
                .map(author => ({ name: author.name.trim(), role: author.role.trim() }))
                .filter(author => author.name !== '')
            metadata.tags = metadata.tags
                .map(tag => tag.trim())
                .filter(tag => tag !== '')
            metadata.series = metadata.series
                .map(series => series.trim())
                .filter(series => series !== '')

            if (!this.echoMetadataValidator(metadata)) throw Error()
        } catch (error: any) {
            throw Error('Error: metadata 格式不合法')
        }

        const imagesDir = appPaths.getEchoMetadataImagesDirPath(srcPath)
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        let images: string[] = []
        try {
            // 使用Intl.Collator进行自然排序
            images = (await n_fsp.readdir(imagesDir, { withFileTypes: true }))
                .filter(dirent => dirent.isFile())
                .sort((a, b) => collator.compare(a.name, b.name))
                .map(dirent => n_path.join(imagesDir, dirent.name))
        } catch { }

        return { metadata, images }
    }

    // NOTE 涉及路径的保存
    public async addRecordFromMetadata(srcPath: string, dirnameId?: PrimaryKey): Promise<void> {
        if (!n_fs.existsSync(srcPath)) throw Error('文件夹不存在')

        const dirname = n_path.dirname(srcPath)
        const basename = n_path.basename(srcPath)

        // 没有传入dirnameId, 代表是直接调用的addRecordFromMetadata, 没有做是否可执行检查。
        // 传入了dirnameId, 代表是被importRecordFromMetadata调用的, 已经做了可执行检查。所以跳过这一步。
        if (!dirnameId) {
            dirnameId = this.dirnameDao.queryDirnameIdByPath(dirname)
            if (dirnameId && this.recordDao.queryRecordIdByDirnameIdAndBasename(dirnameId, basename)) {
                throw Error('Error: 选择的源已经绑定了Record')
            }
        }

        const { metadata, images } = await this.getMetadata(srcPath)

        let recordId: PrimaryKey = 0
        this.libEnv.db.transactionExec(() => {
            if (!dirnameId) dirnameId = this.dirnameDao.insertDirname(dirname)

            const record = this.recordDao.recordEntityFactory(
                metadata.title.trim(),
                metadata.rate,
                metadata.hyperlink,
                basename,
                metadata.release_date,
                this.generateInfoStatus(images.length > 0, metadata.hyperlink, basename),
                [...metadata.tags, ...metadata.authors].join(' '),
                metadata.search_text,
                dirnameId
            )
            recordId = record.id = this.recordDao.insertRecord(record)

            const recordExtra = {} as Entity.RecordExtra
            recordExtra.id = record.id
            recordExtra.plot = metadata.plot
            recordExtra.reviews = metadata.reviews
            recordExtra.info = metadata.info

            this.recordExtraDao.insetRecordExtra(recordExtra)

            const addTagIds = metadata.tags.map(title => this.tagDao.queryTagIdByTitle(title) || this.tagDao.insertTag(title))
            const addSeriesIds = metadata.series.map(name => this.seriesDao.querySeriesIdByName(name) || this.seriesDao.insertSeries(name))
            const authorIdAndRoles: DTO.AuthorIdAndRole[] = metadata.authors.map(author => {
                const id = this.authorDao.queryAuthorByName(author.name)?.id
                    || this.authorDao.insertAuthor(this.authorDao.authorEntityFactory(author.name))
                const role = author.role.trim() || null
                return { id, role }
            })
            this.recordTagDao.insertRecordTagByRecordIdTagIds(record.id, addTagIds)
            this.recordSeriesDao.insertRecordSeriesByRecordIdSeriesIds(record.id, addSeriesIds)
            this.recordAuthorDao.insertByRecordIdAuthorIds(record.id, authorIdAndRoles)
        })

        // 图片操作
        if (recordId && images.length) {  // 在事务回调中如果出错依然会到这里, 此时recordId为0, 直接返回。
            const recordImagesDirPathConstructor = this.libEnv.genRecordImagesDirPathConstructor(recordId)
            const handleImagePromises: Promise<OutputInfo>[] = []
            handleImagePromises.push(ImageService.handleNormalImage(images[0], recordImagesDirPathConstructor.getNewMainImageFilePath()))
            for (let i = 1; i < images.length; i++) {
                handleImagePromises.push(ImageService.handleNormalImage(images[i], recordImagesDirPathConstructor.getNewSampleImageFilePath(i)))
            }
            await Promise.all(handleImagePromises);
        }
    }

    // NOTE 涉及路径的保存
    public async updateRecordFromMetadata(srcPath: string, dirnameId?: PrimaryKey, recordId?: PrimaryKey): Promise<void> {
        if (!n_fs.existsSync(srcPath)) throw Error('文件夹不存在')

        const dirname = n_path.dirname(srcPath)
        const basename = n_path.basename(srcPath)

        if (!dirnameId) dirnameId = this.dirnameDao.queryDirnameIdByPath(dirname)
        if (!dirnameId) throw Error('Error: 选择的源未绑定Record, 无法更新。')

        if (!recordId) recordId = this.recordDao.queryRecordIdByDirnameIdAndBasename(dirnameId, basename)
        if (!recordId) throw Error('Error: 选择的源未绑定Record, 无法更新。')

        const { metadata, images } = await this.getMetadata(srcPath)

        const record = this.recordDao.recordEntityFactory(
            metadata.title.trim(),
            metadata.rate,
            metadata.hyperlink,
            basename,
            metadata.release_date,
            this.generateInfoStatus(images.length > 0, metadata.hyperlink, basename),
            [...metadata.tags, ...metadata.authors].join(' '),
            metadata.search_text,
            dirnameId,
            recordId,
        )

        this.libEnv.db.transactionExec(() => {
            this.recordDao.updateRecord(record)

            const recordExtra = this.recordExtraDao.recordExtraFactory(
                recordId,
                metadata.plot,
                metadata.reviews,
                metadata.info
            )

            this.recordExtraDao.updateRecordExtra(recordExtra)

            const newTags = metadata.tags.map(title => this.tagDao.queryTagIdByTitle(title) ?? this.tagDao.insertTag(title))
            const newSeries = metadata.series.map(name => this.seriesDao.querySeriesIdByName(name) ?? this.seriesDao.insertSeries(name))
            const newAuthors: DTO.AuthorIdAndRole[] = metadata.authors.map(author => {
                const id = this.authorDao.queryAuthorByName(author.name)?.id
                    || this.authorDao.insertAuthor(this.authorDao.authorEntityFactory(author.name))
                const role = author.role.trim() || null
                return { id, role }
            })

            const oldTags = this.tagDao.queryTagsByRecordId(record.id)
            const oldAuthors = this.authorDao.queryAuthorsAndRoleByRecordId(record.id)
            const oldSeries = this.seriesDao.querySeriesByRecordId(record.id)

            const tagsDiff = diffArray(oldTags, newTags,
                'id', void 0,
                void 0,
                (item) => item.id,
            )
            const authorsDiff = diffArray(oldAuthors, newAuthors,
                'id', 'id',
                (item) => item,
                (item) => item.id,
                (oldAuthor, newAuthor) => oldAuthor.role === newAuthor.role,
            )
            const seriesDiff = diffArray(oldSeries, newSeries,
                'id', void 0,
                void 0, (item) => item.id,
            )

            this.editRecordAttribute(
                record.id,
                authorsDiff.added,
                authorsDiff.updated,
                authorsDiff.removed,
                tagsDiff.added,
                tagsDiff.removed,
                seriesDiff.added,
                seriesDiff.removed
            )
        })

        if (images.length) {
            const recordImagesDirPathConstructor = this.libEnv.genRecordImagesDirPathConstructor(record.id)
            await fm.deleteAllFilesInDir(recordImagesDirPathConstructor.getImagesDirPath())
            const handleImagePromises: Promise<OutputInfo>[] = []
            handleImagePromises.push(ImageService.handleNormalImage(images[0], recordImagesDirPathConstructor.getNewMainImageFilePath()))
            for (let i = 1; i < images.length; i++) {
                handleImagePromises.push(ImageService.handleNormalImage(images[i], recordImagesDirPathConstructor.getNewSampleImageFilePath(i)))
            }

            await Promise.all(handleImagePromises);
        }
    }

    /**
     * @param type 0: 添加未添加的, 1: 更新已经添加的, 2: 添加和跟新
     * @returns 
     */
    // NOTE 涉及路径的保存
    public async importRecordFromMultipleMetadata(dirPath: string, op: RP.AddRecordFromMetadataParam['operate']) {
        if (!n_fs.existsSync(dirPath)) throw Error('文件夹不存在')
        // 检查文件是否存在
        dirPath = n_path.resolve(dirPath)
        let dirnameId: PrimaryKey | undefined = this.dirnameDao.queryDirnameIdByPath(dirPath)

        // 更新操作，但是绑定的是传入dirname的record一个都没有，就可以直接退出了
        if (op === 1) {
            if (!dirnameId) return
            if (!this.recordDao.queryCountOfRecordsByDirnameId(dirnameId)) return
        }

        const srcBasenames = (await n_fsp.readdir(dirPath, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)

        if (!dirnameId) dirnameId = this.dirnameDao.insertDirname(dirPath)

        const errorSrcs: string[] = []
        for (const basename of srcBasenames) {
            try {
                const srcPath = n_path.join(dirPath, basename)
                const recordId = this.recordDao.queryRecordIdByDirnameIdAndBasename(dirnameId, basename)
                switch (op) {
                    case 0:
                        if (recordId) continue
                        await this.addRecordFromMetadata(srcPath, dirnameId)
                        break
                    case 1:
                        if (!recordId) continue
                        await this.updateRecordFromMetadata(srcPath, dirnameId, recordId)
                        break
                    case 2:
                        recordId ?
                            await this.updateRecordFromMetadata(srcPath, dirnameId, recordId) :
                            await this.addRecordFromMetadata(srcPath, dirnameId)
                        break
                    default:
                        throw new Error('unknown operate')
                }
            } catch {
                errorSrcs.push(basename)
            }
        }
        if (errorSrcs.length) {
            const errorLog = `导入目录: ${dirPath}\n\n` + errorSrcs.join('\n')
            await n_fsp.writeFile(appPaths.getMultipleMetadataImportErrorLogPath(), errorLog)
        }
    }
}


export default RecordService