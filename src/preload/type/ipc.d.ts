import type { ipcRenderer } from "electron"
import { StepInstance } from "element-plus"
import { type } from "os"
import path from "path"

export interface IElectronAPI {
    /******************** 开始准备 ********************/
    config: (index: string, newValue: any = null) => Promise<any>

    /******************** GroupDB ********************/
    /** 获取所有的group和library */
    getGroups: () => Promise<Group[]>
    /** 重命名group */
    renameGroup: (id: number, newName: string) => Promise<boolean>
    /** 添加group */
    addGroup: (name: string) => Promise<boolean>
    /** 删除group */
    deleteGroup: (id: number) => Promise<boolean>
    /** 排序group */
    sortGroup: (currId: number, tarNextId: number) => Promise<void>
    /** 获取优先打开的library */
    getPrimaryOpenLibrary: (callback: (e: IpcRendererEvent, libraryId: number) => void) => void,
    /** 通过libraryId获取libraryName */
    getLibraryNameByID: (id: number) => Promise<string>
    /** 重命名library */
    renameLibrary: (id: number, newName: string) => Promise<boolean>
    /** 添加library */
    addLibrary: (groupId: number, name: string) => Promise<boolean>
    /** 删除library */
    deleteLibrary: (id: number) => Promise<boolean>
    /** 排序library */
    sortLibrary: (currId: number, tarNextId: number, groupId: number) => Promise<void>

    /******************** RecordDB ********************/
    /** 自动补齐 */
    autoCompleteRecord: (libraryId: number, option: AcOption) => Promise<ACSuggestion>
    /** 查询记录的简介 */
    queryRecordProfiles: (libraryId: number, option: any) => Promise<any>
    /** 根据authorId查询作者的详情信息 */
    queryAuthorDetail: (libraryId: number, authorId: number) => Promise<AuthorDetail | undefined>
    /** 编辑作者 */
    editAuthor: (libraryId: number, authorForm: AuthorForm) => Promise<boolean>


    getItems: (libraryID: number) => Promise<itemProfile[]>
    getItemsByAuthor: (libraryID: number, getItemsOption: getItemsOption, authorID: number) => Promise<itemProfile[]>
    getItemsOfFav: (libraryID: number, getItemsOption: getItemsOption) => Promise<itemProfile[]>
    getAuthorList: (libraryID: number, type: number, queryWords: string | [string, string, string]) => Promise<authorProfile[]>
    getAttributes: (libraryID: number, type: number, pageno: number) => Promise<LibraryAttribute[]>




    /******************** dialog ********************/
    openDialog: (type: OpenDialogType, multiSelect: boolean) => Promise<string[]>

    /******************** external ********************/
    openExternal: (url: string) => Promise<void>
    openInExplorer: (fullPath: string) => Promise<void>
    openFile: (fullPath: string) => Promise<void>
    writeClipboard: (text: string) => Promise<void>

    /******************** window ********************/
    createMainWindow: (libraryId: number) => Promise<boolean>
    createItemWinodw: (libraryId: number, itemId: number) => Promise<void>
    windowRelaunch: () => Promise<void>
    windowMinmize: () => Promise<void>
    windowMaxmize: () => Promise<void>
    windowIsMaxmize: (callback: (e: IpcRendererEvent, value: any) => void) => Promise<any>
    windowClose: () => Promise<void>
}

export interface IVersionAPI {
    appVersion: () => Promise<string>
    electronVersion: string
    chromeVersion: string
    nodeVersion: string
}

declare global {
    interface Window {
        electronAPI: IElectronAPI
        versionAPI: IVersionAPI
    }













    interface group {
        id: number
        name: string
        librarys: library[]
    }

    declare interface itemProfile {
        id: number
        title: string
        createTime: string
        hits: number
        hasImage: number
        isFav: number
        hyperlink: string
        folder_id: number
        authorIDs: string
        authorNames: string
        tags: string
    }
    type AutoComplete = {
        type: string
        id: number
        value: string
    }
    type getItemsOption = {
        // queryType: noQuery, commonQuery, advancedQuery
        queryType: number,
        queryWords: string | [string, string, string],
        // filterOptionIndex: [noHyperlink, noFile, noImage]
        filterOption: [boolean, boolean, boolean],
        // orderField: time, hits, title
        orderBy: number,
        isAscending: boolean,
        pageno: number
    }

    declare type authorProfile = {
        id: number
        name: string
        intro: string
        itemCount: number
        itemIDs: string
    }

    type LibraryAttribute = {
        id: number
        value: string
        itemCount: number
    }
}