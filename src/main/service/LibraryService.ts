import { Notification, shell } from "electron"
import { Worker } from "worker_threads"
import fs from "fs"
import path from "path"
// import appConfig from "../app/config"
import appPaths from "../app/appPaths"
import { formatCurrentTime } from "../util/common"
import { injectable, inject } from "inversify"
import InjectType from "../provider/injectType"
import DIContainer from "../provider/container"
import Result from "../util/Result"
import i18n from "../locale"
import type { zipperOperation } from "./worker/zipper.worker"
import type { unzipperOperation } from "./worker/unzipper.worker"
import type GroupDB from "../db/GroupDB"
import type GroupDao from "../dao/GroupDao"
import type LibraryDao from "../dao/LibraryDao"
import type LibraryExtraDao from "../dao/LibraryExtraDao"

@injectable()
class LibraryService {
    public constructor(
        @inject(InjectType.GroupDao) private groupDao: GroupDao,
        @inject(InjectType.LibraryDao) private libraryDao: LibraryDao,
        @inject(InjectType.LibraryExtraDao) private libraryExtraDao: LibraryExtraDao,
    ) { }

    public queryLibraryDetail(id: number): VO.LibraryDetail | undefined {
        const lib = this.libraryDao.queryLibraryById(id) as VO.LibraryDetail | undefined
        if (lib) {
            const extra = this.libraryExtraDao.queryLibraryExtraById(id) as Entity.LibraryExtra
            lib.useAuxiliarySt = extra.useAuxiliarySt ? true : false // 把1,0转换为true, false
            lib.auxiliarySt = extra.auxiliarySt
            lib.intro = extra.intro
        }
        return lib
    }

    public querySortedLibrarysByGroupId(groupId: number): VO.LibraryProfile[] {
        const librarys = this.libraryDao.querySortedLibrarysByGroupId(groupId) as VO.LibraryProfile[]
        librarys.forEach(l => l.dataPath = appPaths.getLibraryDirPath(l.id))
        return librarys
    }

    public rename(id: number, name: string): boolean {
        return this.libraryDao.updateLibraryName(id, name) > 0
    }

    public editLibraryExtra(data: DTO.LibraryExtraForm): boolean {
        return this.libraryExtraDao.updateLibraryExtra(data) > 0
    }

    public create(name: string, groupId: number): PrimaryKey {
        let newId: PrimaryKey = 0
        DIContainer.get<GroupDB>(InjectType.GroupDB).transaction(() => {
            const headId = this.libraryDao.queryLibraryIdByGroupIdPrevId(groupId, 0)
            const id = newId = this.libraryDao.insertLibrary(name, groupId)
            if (headId !== void 0) { this.insertNode(id, 0, headId) }
            // 创建library_extra记录
            this.libraryExtraDao.insertLibraryExtra({
                id: id,
                auxiliarySt: '',
                useAuxiliarySt: 1,
                intro: '',
            })
        })
        return newId
    }

    public delete(id: number): void {
        DIContainer.get<GroupDB>(InjectType.GroupDB).transaction(() => {
            this.removeNode(id) // 断开链接
            this.libraryDao.deleteLibraryById(id) // 删除library记录
            this.libraryExtraDao.deleteLibraryExtraById(id) // 删除library_extra记录
            this.deleteFileData(id) // 删除文件数据
        })
    }

    public deleteByGroupId(groupId: number): void {
        DIContainer.get<GroupDB>(InjectType.GroupDB).transaction(() => {
            this.libraryDao.queryLibraryIdsByGroupId(groupId).forEach(LibId => {
                // 由于是全部删除，所以不需要断开链接
                this.libraryDao.deleteLibraryById(LibId) // 删除library记录
                this.libraryExtraDao.deleteLibraryExtraById(LibId) // 删除library_extra记录
                this.deleteFileData(LibId) // 删除文件数据
            })
        })
    }

    /* 注意tarNextId可能为0, 所以groupId是为了再tarNextId为0的情况下找到要插入位置 */
    public sort(curId: number, tarNextId: number, moveToGroupId: number): void {
        DIContainer.get<GroupDB>(InjectType.GroupDB).transaction(() => {
            const curGroupId = this.libraryDao.queryLibraryGroupIdById(curId)
            const tarGroupId = tarNextId === 0 ? moveToGroupId : this.libraryDao.queryLibraryGroupIdById(tarNextId)
            if (curGroupId === void 0 || tarGroupId === void 0) return // 如果curId或tarNextId不存在, 直接返回

            const curNextId = this.libraryDao.queryLibraryNextIdById(curId)!
            // 自己移动到自己的位置, 直接返回, tarNextId可能为0, 每一个group都有一个0的library，所以还有验证groupId
            if (curNextId === tarNextId && curGroupId === tarGroupId) return

            this.removeNode(curId) // 把curId从原来的位置删除
            // 插入位置前驱的id，注意tarNextId可能为0
            const tarPrevId = this.libraryDao.queryLibraryIdByGroupIdNextId(tarGroupId, tarNextId) || 0
            this.insertNode(curId, tarPrevId, tarNextId) // 把curId插入到新的位置

            if (curGroupId !== tarGroupId) {
                this.libraryDao.updateLibraryGroupId(curId, tarGroupId) // 修改curId的group_id为tarGroupId
            }
        })
    }

    private insertNode(id: PrimaryKey, prevId: PrimaryKey, nextId: PrimaryKey): void {
        this.libraryDao.updateLibraryPrevIdNextId(id, prevId, nextId)
        this.libraryDao.updateLibraryNextId(prevId, id)
        this.libraryDao.updateLibraryPrevId(nextId, id)
    }

    private removeNode(id: PrimaryKey): void {
        const [prevId, nextId] = this.libraryDao.queryLibraryPrevIdNextIdById(id) || [0, 0]
        if (prevId) { this.libraryDao.updateLibraryNextId(prevId, nextId) }
        if (nextId) { this.libraryDao.updateLibraryPrevId(nextId, prevId) }
    }

    private deleteFileData(id: number): void {
        const dataPath = appPaths.getLibraryDirPath(id)
        if (fs.existsSync(dataPath)) {
            fs.rmSync(dataPath, { recursive: true })
        }
    }

    public exportLibrary(libraryId: number, exportDir: string): void {
        const libInfo = this.libraryDao.queryLibraryById(libraryId)
        const groupId = this.libraryDao.queryLibraryGroupIdById(libraryId)
        if (!libInfo || !groupId) {
            throw new Error(`Library ${libraryId} not found`)
        }
        const libExtra = this.libraryExtraDao.queryLibraryExtraById(libraryId)
        const groupInfo = this.groupDao.queryGroupById(groupId)

        const exportPath = path.join(exportDir,
            `Echo_${groupInfo?.name}-${libInfo.name}_${formatCurrentTime()}.zip`)
        const ops: zipperOperation[] = [
            {
                type: "String",
                source: JSON.stringify({ name: libInfo.name, intro: libExtra?.intro, }),
                data: { name: "desc.json" }
            },
            {
                type: "Dir",
                dirpath: appPaths.getLibraryDirPath(libraryId),
                destpath: false,
            }
        ]

        const worker = new Worker(path.join(__dirname, "worker/zipper.worker"))
        worker.postMessage({ exportPath: exportPath, ops: ops })
        worker.on('message', (result: Result) => {
            const notification = result.code
                ? new Notification({
                    title: `${libInfo.name} ${i18n.global.t('exportSuccess')}`,
                    body: i18n.global.t('exportSuccessOpenDir'),
                }).addListener('click', () => shell.showItemInFolder(exportPath))
                : new Notification({
                    title: `${libInfo.name} ${i18n.global.t('exportFailed')}`,
                    body: result.msg,
                })

            notification.show()
            worker.terminate()
        })

    }

    public importLibrary(GroupId: number, importFiles: string[]): void {
        const worker = new Worker(path.join(__dirname, "worker/unzipper.worker"))

        // 用于保存解压后的文件
        const tmpPath = appPaths.getImportLibraryTmpDirPath()
        const ops: unzipperOperation[] = [
            { type: 'read', entryName: 'desc.json' },
            { type: 'extract', entryName: 'library.db', tragetPath: tmpPath },
            { type: 'extract', entryName: 'images/', tragetPath: tmpPath },
        ]

        let importFileIdx = -1

        worker.postMessage({
            zipFilePath: importFiles[++importFileIdx],
            ops: ops
        })
        worker.on('message', (result: Result) => {
            try {
                // 解压失败
                if (result.code === 0) throw Error('unzip error')

                const opResults: Result[] = result.data

                // 没有取到desc.json, library.db
                if (opResults[0].code === 0 || opResults[1].code === 0) throw Error('error import file')

                const { name, intro } = JSON.parse(Buffer.from(opResults[0].data).toString('utf-8'))

                // 解析的数据不正确,错误的导入文件
                if (name === void 0 || intro === void 0) throw Error('error import file')

                // 数据提取后，再向数据库中插入数据s
                const id = this.create(name, GroupId)
                this.libraryExtraDao.updateLibraryExtra({
                    id: id,
                    intro: intro,
                    useAuxiliarySt: 1,
                    auxiliarySt: '',
                })

                // 修改数据库文件名
                fs.renameSync(tmpPath, appPaths.getLibraryDirPath(id))

                new Notification({
                    title: `${i18n.global.t('importSuccess')}  (${importFileIdx + 1}/${importFiles.length})`,
                    body: path.basename(importFiles[importFileIdx])
                }).show()
            } catch (err: any) {
                // 删除用于保存解压后文件的文件夹
                if (fs.existsSync(tmpPath)) {
                    fs.rmdirSync(tmpPath, { recursive: true })
                }

                new Notification({
                    title: `${i18n.global.t('importFailed')}  (${importFileIdx + 1}/${importFiles.length})`,
                    body: `${path.basename(importFiles[importFileIdx])}\n ${i18n.global.t('importFailedReason')}`
                }).show()
            }

            if (importFileIdx === importFiles.length - 1) {
                worker.terminate()
            } else {
                // 开始导入下一个文件
                worker.postMessage({
                    zipFilePath: importFiles[++importFileIdx],
                    ops: ops
                })
            }
        })
    }
}

export default LibraryService