import Message from "@/util/Message"
import { getConfig } from "@/util/ConfigUtil"
import { $t } from "@/locale"

/**
 * 用于打开外部 URL 或文件资源。例如，你可以使用这个方法在用户默认的浏览器中打开一个网页。
 * @param hyperlink
 */
export function openInBrowser(hyperlink: string | null) {
    if (!hyperlink) return
    window.electronAPI.openInBrowser(hyperlink)
}

/**
 * 在资源管理器中打开，如果是文件夹，直接打开文件夹。如果是文件，打开文件所在的文件夹，滚动到文件的位置并高亮标记
 * @param path 
 */
export async function openInExplorer(
    path: string | null | undefined,
    method?: 'showItemInFolder' | 'openPath'
) {
    if (!path) return
    if ((await window.electronAPI.openInExplorer(path, method)).code === 0) {
        Message.error($t('msg.notExistsInFileExplorer'))
    }
}

/**
 * 打开文件,如果该文件用户指定了打开软件，用指定的软件打开，否则用系统默认方式打开
 * @param path 
 */
export async function openFile(path: string | null) {
    if (!path) return
    if ((await window.electronAPI.openFile(path)).code === 0) {
        Message.error($t('msg.notExistsInFileExplorer'))
    }
}

/**
 * 把文本复制到剪切板
 * @param text 复制的文本
 */
export function writeClibboard(text: string) {
    window.electronAPI.writeClipboard(text)
    Message.success($t('msg.copiedToClipboard'))
}

export async function internetSearch(word: string) {
    const engines = {
        google: 'https://www.google.com/search?q=',
        bing: 'https://www.bing.com/search?q=',
        baidu: 'https://www.baidu.com/s?wd=',
        yahoo: 'https://search.yahoo.com/search?p=',
        duckduckgo: 'https://duckduckgo.com/?q=',
        yandex: 'https://yandex.com/search/?text=',
    }
    const key = await getConfig('searchEngine') as keyof typeof engines
    window.electronAPI.openInBrowser(engines[key] + word)
}

export default {
    openInBrowser,
    openInExplorer,
    openFile,
    writeClibboard,
    internetSearch
}