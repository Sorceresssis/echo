import { injectable, inject } from "inversify"
import InjectType from "../provider/injectType"
import { type LibraryEnv } from "../provider/container"
import DynamicSqlBuilder, { SortRule } from "../utils/DynamicSqlBuilder"
import { type DBPageQueryOptions, PagedResult } from "../pojo/page"

export type QueryDirnamesSortRule = {
    field: 'path' | 'id',
    order: 'ASC' | 'DESC'
}

@injectable()
class DirnameDao {
    public constructor(
        @inject(InjectType.LibraryEnv) private libEnv: LibraryEnv
    ) { }

    public queryDirnameIdByPath(path: string): number | undefined {
        return this.libEnv.db.prepare('SELECT id FROM dirname WHERE path = ?;').pluck().get(path) as number | undefined
    }

    public queryDirnamesByKeyword(
        keyword: string,
        sort: QueryDirnamesSortRule[],
        pageOptions: DBPageQueryOptions
    ): PagedResult<Entity.Dirname> {
        const sql = new DynamicSqlBuilder()
        const sortRule: SortRule[] = []

        sql.append('SELECT COUNT(id) OVER () AS total_count, id, path FROM dirname')
        if (keyword !== '') {
            this.libEnv.db.registerSQLFnRegexp(keyword)
            sql.append('WHERE REGEXP(path) > 0')
            sortRule.push({ field: 'REGEXP(path)', order: 'DESC' })
        }
        sortRule.push(...sort)
        sql.appendOrderSQL(sortRule).appendLimitSQL(pageOptions.pn, pageOptions.ps)

        const rows = this.libEnv.db.all<any[], Entity.Dirname & { total_count?: number }>(sql.getSql(), ...sql.getParams())
        const totalCount = rows[0]?.total_count || 0
        rows.forEach(row => { delete row.total_count })

        return new PagedResult(rows, pageOptions.pn, pageOptions.ps, totalCount)
    }

    public updateDirnamePathById(id: Entity.PK, path: string): number {
        return this.libEnv.db.run("UPDATE dirname SET path = ? WHERE id = ?;", path, id).changes
    }

    public insertDirname(path: string): Entity.PK {
        return this.libEnv.db.run("INSERT INTO dirname(path) VALUES(?);", path).lastInsertRowid as Entity.PK
    }

    public deleteDirnameById(id: Entity.PK): number {
        return this.libEnv.db.run('DELETE FROM dirname WHERE id = ?;', id).changes
    }
}


export default DirnameDao