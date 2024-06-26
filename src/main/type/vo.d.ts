namespace VO {
    type GroupProfile = {
        id: number,
        name: string,
    }

    type Group = {
        id: number,
        name: string,
        librarys: LibraryProfile[]
    }

    type LibraryProfile = {
        id: number,
        name: string,
        dataPath: string,
    }

    type Library = {
        id: number,
        name: string,
        createTime?: string,
        modifiedTime?: string,
    }

    type LibraryDetail = {
        id: number,
        name: string,
        auxiliarySt: string,
        useAuxiliarySt: boolean,
        intro: string,
        createTime: string,
        modifiedTime: string,
    }

    type Record = {
        id: number,
        title: string,
        rate: number,
        cover: string | undefined,
        hyperlink: string,
        resourcePath: string,
        createTime?: string,
        modifiedTime?: string,
    }

    /**
     * 记录的详细信息，用于编辑和记录详情页展示
     */
    type RecordDetail = {
        id: number
        title: string
        rate: number
        hyperlink: string | null
        releaseDate: string | null
        cover: string | undefined
        sampleImages: string[]
        dirname: string | null
        basename: string | null
        resourcePath: string | null
        authors: VO.RecordAuthorProfile[]
        tags: VO.Tag[]
        series: VO.Series[]
        intro: string
        info: string
        createTime: string
        modifiedTime: string
    }

    type RecordRecommendation = {
        id: number
        title: string
        rate: number
        cover: string | undefined
        hyperlink: string | null
        resourcePath: string | null
        authors: VO.RecordAuthorProfile[]
        tags: VO.Tag[]
        createTime?: string,
        modifiedTime?: string,
    }

    /**
     * 作者的简单信息，用于列表展示
     */
    type RecordAuthorProfile = {
        id: number,
        name: string,
        avatar: string | undefined,
        role: string | null,
    }

    type AuthorDetail = {
        id: number
        name: string
        avatar: string | undefined
        sampleImages: string[],
        intro: string
        createTime: string,
        modifiedTime: string,
        recordCount: number,
    }

    /**
     * 作者的推荐信息，用于首页展示,多出了作品列表和作品数量
     */
    type AuthorRecommendation = {
        id: number,
        name: string,
        avatar: string | undefined,
        worksCount: number,
        intro: string,
        masterpieces: {
            id: number,
            cover: string | undefined,
            title: string,
        }[]
    }

    type Tag = {
        id: number,
        title: string,
    }

    type TagDetail = {
        id: number,
        title: string,
        recordCount: number,
    }

    type Dirname = {
        id: number,
        path: string
    }

    type DirnameDetail = {
        id: number,
        path: string,
        recordCount: number,
    }

    type Series = {
        id: number,
        name: string
    }

    type RecordExtra = {
        id: number,
        intro: string,
        info: string,
    }

    /**
     * 自动补齐的返回值
     */
    type AcSuggestion = {
        type: 'record' | 'author' | 'tag' | 'series' | 'dirname',
        id: number,
        value: string,
        image: string | undefined,
    }
}