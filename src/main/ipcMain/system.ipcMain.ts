import { clipboard, ipcMain, IpcMainInvokeEvent, shell } from "electron"
import { exec } from "child_process"
import nodePath from "path"
import fs from "fs"
import fm from "../utils/FileManager"
import ResponseResult from "../pojo/ResponseResult"
import i18n from "../locale"

export default function ipcMainSystem() {
    // 用系统默认方式打开url
    ipcMain.handle('system:openInBrowser', (e: IpcMainInvokeEvent, hyperlink: string) => {
        if (!hyperlink) return
        const protocolRegex = /^(http|https):\/\//
        if (!protocolRegex.test(hyperlink)) {
            hyperlink = `https://${hyperlink}`
        }
        shell.openExternal(hyperlink)
    })

    // 打开资源管理器中的路径如果是文件夹，直接打开文件夹。如果是文件，打开文件所在的文件夹，滚动到文件的位置并高亮标记
    ipcMain.handle('system:openInExplorer', async (
        e: IpcMainInvokeEvent,
        path: string,
        method?: 'showItemInFolder' | 'openPath'
    ): Promise<ResponseResult<void>> => {
        const r = await new Promise<boolean>((resolve) => {
            path = nodePath.normalize(path)

            fs.stat(path, (err, stats) => {
                if (err) {
                    resolve(false)
                    return
                }

                if (stats.isDirectory()) {
                    if (method === 'showItemInFolder') {
                        shell.showItemInFolder(path)
                    } else if (method === 'openPath' || method === void 0) {
                        shell.openPath(path)
                    }
                } else {
                    // 文件只能用showItemInFolder打开
                    shell.showItemInFolder(path)
                }

                resolve(true)
            })
        })
        return r ? ResponseResult.success() : ResponseResult.error()
    })

    // 打开路径中的文件(一定是个文件)，如果该文件用户指定了打开软件，用指定的软件打开，否则用系统默认方式打开
    ipcMain.handle('system:openFile', async (e: IpcMainInvokeEvent, path: string): Promise<ResponseResult<void>> => {
        path = nodePath.normalize(path)

        const r = await new Promise<boolean>((resolve) => {
            fs.stat(path, (err, stats) => {
                if (err) {
                    resolve(false)
                    return
                }
                if (stats.isFile()) {
                    shell.openPath(path)
                    resolve(true)
                    return
                }
                resolve(false)
            })
        })
        return r ? ResponseResult.success() : ResponseResult.error()
    })

    ipcMain.handle('system:writeClipboard', (e: IpcMainInvokeEvent, text: string) => {
        clipboard.writeText(text)
    })

    ipcMain.handle('system:readdir', (e: IpcMainInvokeEvent, dirPath: string): ResponseResult<any> => {
        try {
            if (!fs.existsSync(dirPath)) return ResponseResult.error(i18n.global.t('folderNotExists'))

            if (fs.statSync(dirPath).isDirectory()) {
                // 是文件夹就返回文件夹下所有的文件和文件夹的信息数组 
                return ResponseResult.success(
                    fm.dirContentsWithType(dirPath).map(item => {
                        return {
                            ...item,
                            fullPath: nodePath.join(dirPath, item.name)
                        }
                    })
                )
            } else {
                // 不是文件夹就返回只包含该文件的信息的数组
                return ResponseResult.success([{
                    name: nodePath.basename(dirPath),
                    type: 'file',
                    fullPath: dirPath
                }])
            }
        } catch (e: any) {
            return ResponseResult.error(e.message)
        }
    })

    ipcMain.handle('system:pathSep', (e: IpcMainInvokeEvent) => nodePath.sep)
}