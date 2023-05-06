import { ElMessage } from 'element-plus'

/**
 * 用系统默认的方式打开 url email path
 * @param url 链接
 */
export function openUrlExternal(url: string) {
    window.electronAPI.openUrl(url)
}

/**
 * 把文本复制到剪切板
 * @param text 复制的文本
 */
export function clibboardWriteText(text: string) {
    ElMessage.success('已经复制到剪贴板')
    window.electronAPI.clibboardWriteText(text)
}
// 在openFileInExplorer
export function openFileInExplorer(path: string) {
    // window.electronAPI.openFileInExplorer(path)
}

/**
 * 用系统默认方式打开文件
 * @param path 打开文件的路径
 */
export function openFile(path: string) {
}

/******************************  对话框选择文件 ******************************/
enum OpenDialogType { DIR = 0, FILE, IMAGE, VIDEO }
export const selectFile = async (multiSelections: boolean, callback: (path: string | string[]) => void) => {
    callback((await window.electronAPI.openDialog(OpenDialogType.FILE, multiSelections)))
}

export const selectDir = async (multiSelections: boolean, callback: (path: string | string[]) => void) => {
    callback((await window.electronAPI.openDialog(OpenDialogType.DIR, multiSelections)))
}
export const selectImage = async (multiSelections: boolean, callback: (path: string | string[]) => void) => {
    callback((await window.electronAPI.openDialog(OpenDialogType.IMAGE, multiSelections)))
}