import { injectable, inject } from "inversify"
import InjectType from "../provider/injectType"
import DIContainer, { type LibraryEnv } from "../provider/container"
import TagDao, { QueryTagsSortRule } from "../dao/TagDao"
import type RecordTagDao from "../dao/RecordTagDao"
import type RecordService from "./RecordService"
import { DBPageQueryOptions, PagedResult } from "../pojo/page"

@injectable()
class TagService {
    public constructor(
        @inject(InjectType.LibraryEnv) private libEnv: LibraryEnv,
        @inject(InjectType.TagDao) private tagDao: TagDao,
        @inject(InjectType.RecordTagDao) private recordTagDao: RecordTagDao,
    ) {
    }

    public queryTagDetails(options: RP.QueryTagDetailsOptions): PagedResult<VO.TagDetail> {
        const defaultSortRule: QueryTagsSortRule[] = [
            { field: 'title', order: 'ASC' },
            { field: 'id', order: 'DESC' },
        ]

        const sortRule: QueryTagsSortRule[] = []
        switch (options.sortField) {
            case 'title':
                sortRule.push({ field: 'title', order: options.order })
                break
            case 'time':
                sortRule.push({ field: 'id', order: options.order })
                break
            default:
                throw Error('invalid sort field')
        }
        defaultSortRule.forEach(rule => {
            if (rule.field !== sortRule[0].field) {
                sortRule.push(rule)
            }
        })

        const pagedResult = this.tagDao.queryTagsByKeyword(
            options.keyword.trim(),
            sortRule,
            new DBPageQueryOptions(options.pn, options.ps, true)
        ) as PagedResult<VO.TagDetail>

        pagedResult.results.forEach(row => {
            row.record_count = this.recordTagDao.queryRecordsCountByTagId(row.id)
        })

        return pagedResult
    }

    public editTag(id: number, title: string): void {
        title = title.trim()
        if (title === '') throw Error('tag can not be empty')

        // 查询是否已经存在
        const existId = this.tagDao.queryTagIdByTitle(title)

        this.libEnv.db.transactionExec(() => {
            // id !== existId 的判断是为了防止修改的值和原值一样，导致被删除
            if (existId && id !== existId) {
                // 如果已经存在，就把record_tag中的tag_id重定向到existId
                // 如果 existId 和 编辑的 id。 绑定了相同的 record 需要删除掉记录即可，实现在内部。
                this.recordTagDao.updateTagIdByTagId(id, existId)
                this.tagDao.deleteTagById(id)
                // title 相同, 不需要跟新 TagAuthorSum 
            } else {
                this.tagDao.update(id, title) // 如果不存在，就直接更新
                this.updateRecordTagAuthorSumOfTag(id) // 更新冗余字段
            }
        })
    }

    public deleteTag(id: number): void {
        this.libEnv.db.transactionExec(() => {
            // 删除 tag 通过inner join 更新 tag_author_sum, 最后删除连接。
            this.tagDao.deleteTagById(id)
            this.updateRecordTagAuthorSumOfTag(id)
            this.recordTagDao.deleteRecordTagByTagId(id)
        })
    }

    private updateRecordTagAuthorSumOfTag(tagId: Entity.PK): void {
        let pn = 0
        const rowCount = 200
        let recordIds: number[]
        do {
            recordIds = this.recordTagDao.queryRecordIdsByTagId(tagId, pn++ * rowCount, rowCount)
            recordIds.forEach(id => DIContainer.get<RecordService>(InjectType.RecordService).updateRecordTagAuthorSum(id))
        } while (recordIds.length === rowCount)
    }
}


export default TagService