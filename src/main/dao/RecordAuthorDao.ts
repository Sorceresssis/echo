import { injectable, inject } from "inversify"
import InjectType from "../provider/injectType"
import { type LibraryEnv } from "../provider/container"

@injectable()
class RecordAuthorDao {
    public constructor(
        @inject(InjectType.LibraryEnv) private libEnv: LibraryEnv
    ) { }

    public queryCountOfRecordsByAuthorId(authorId: number): number {
        const sql = "SELECT COUNT(record_id) FROM record_author WHERE author_id = ?;"
        return this.libEnv.db.prepare(sql).pluck().get(authorId) as number
    }

    public queryRecordIdsByAuthorId(authorId: Entity.PK, offset: number, rowCount: number): number[] {
        const sql = "SELECT record_id FROM record_author WHERE author_id = ? LIMIT ?,?;"
        return this.libEnv.db.prepare(sql).pluck().all(authorId, offset, rowCount) as number[]
    }

    public queryRandomRecordIdsOfSameAuthorByRecordId(recordId: Entity.PK, rowCount: number = 10): number[] {
        const sql = `
        SELECT ra2.record_id
        FROM record_author ra1 JOIN record_author ra2 ON ra1.author_id = ra2.author_id
        WHERE ra1.record_id = ? AND ra2.record_id != ?
        GROUP BY ra2.record_id
        ORDER BY RANDOM() LIMIT 0, ?`
        return this.libEnv.db.prepare(sql).pluck().all(recordId, recordId, rowCount) as number[]
    }

    public insert(recordId: Entity.PK, authorId: Entity.PK): Entity.PK {
        const stmt = this.libEnv.db.prepare("INSERT INTO record_author(record_id, author_id) VALUES(?, ?);")
        return stmt.run(recordId, authorId).lastInsertRowid as Entity.PK
    }

    public insertByRecordIdAuthorIds(recordId: Entity.PK, authorIds: Entity.PK[]): void {
        const stmt = this.libEnv.db.prepare("INSERT INTO record_author(record_id, author_id) VALUES(?, ?);")
        authorIds.forEach(authorId => stmt.run(recordId, authorId))
    }

    public deleteByRecordIdAuthorIds(recordId: Entity.PK, authorIds: Entity.PK[]): void {
        const stmt = this.libEnv.db.prepare("DELETE FROM record_author WHERE record_id = ? AND author_id = ?;")
        authorIds.forEach(authorId => stmt.run(recordId, authorId))
    }

    public deleteByAuthorId(authorId: Entity.PK): number {
        return this.libEnv.db.run("DELETE FROM record_author WHERE author_id = ?;", authorId).changes
    }

    public deleteByRecordId(recordId: Entity.PK): number {
        return this.libEnv.db.run("DELETE FROM record_author WHERE record_id = ?;", recordId).changes
    }
}


export default RecordAuthorDao