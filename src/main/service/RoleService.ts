import { injectable, inject } from "inversify"
import InjectType from "../provider/injectType"
import { type LibraryEnv } from "../provider/container"
import type RoleDao from "../dao/RoleDao"
import type RecordAuthorDao from "../dao/RecordAuthorDao"

@injectable()
class RoleService {
    public constructor(
        @inject(InjectType.LibraryEnv) private libEnv: LibraryEnv,
        @inject(InjectType.RoleDao) private roleDao: RoleDao,
        @inject(InjectType.RecordAuthorDao) private recordAuthorDao: RecordAuthorDao,
    ) { }

    public editRole(id: number, name: string): void {
        name = name.trim()
        if (name === '') throw new Error('role name cannot be empty')

        const existingRole = this.roleDao.queryByName(name)

        this.libEnv.db.transactionExec(() => {
            if (existingRole && existingRole.id !== id) {
                // 有相同的 name 的 role

            } else {
                this.roleDao.update(id, name)
            }
        })
    }

    public deleteRole(id: number): void {
        this.libEnv.db.transactionExec(() => {
            this.roleDao.delete(id)
            this.recordAuthorDao.updateRoleIdbyRoleId(0, id)
        })
    }
}


export default RoleService