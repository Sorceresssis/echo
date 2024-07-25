namespace DTO {
    type LibraryExtraForm = {
        id: number
        auxiliarySt: string,
        useAuxiliarySt: 0 | 1,
        intro: string,
    }

    /**
     * 分页数据
     */
    type Page<T> = {
        total: number,
        rows: T[]
    }

    /**
     * autocomplete的选项,用于搜索
     */
    type AcOptions = {
        type: AcType,
        queryWord: string,
        ps: number
    }

    type QueryAttributesOptions = {
        queryWork: string
        sortField: AttributeSortField
        asc: boolean
        pn: number
        ps: number
    }

    type EditSampleImage = {
        type: 'add' | 'move',
        idx: number, // 从1开始
        path: string
    }

    /**
     * 编辑作者的表单
     */
    type EditAuthorForm = {
        id: number | bigint,
        name: string,
        newAvatar: string | undefined,
        intro: string,
        editSampleImages: EditSampleImage[],
        removeSampleImages: string[]
    }

    /**
     * 批量删除record的表单
     */
    type DeleteRecordByAttributeForm = {
        dirnamePath: string
        tagTitle: string
        seriesName: string
    }

    type AuthorIdAndRole = {
        id: PrimaryKey,
        role: string | null,
    }

    /**
     * 添加和编辑record的表单数据
     */
    type EditRecordForm = {
        id: number,
        dirname: string
        basename: string
        title: string,
        hyperlink: string,
        releaseDate: string
        cover: string | undefined
        originCover: string | undefined
        rate: number,
        addTags: string[]
        removeTags: number[]
        addAuthors: AuthorIdAndRole[]
        editAuthorsRole: AuthorIdAndRole[]
        removeAuthors: number[]
        addSeries: string[]
        removeSeries: number[]
        plot: string
        searchText: string
        reviews: string
        info: string
        editSampleImages: EditSampleImage[]
        removeSampleImages: string[]
    }

    type QueryRecordRecommendationsOptions = {
        type: 'common' | 'recycled' | 'author' | 'series'
        authorId?: number,
        seriesId?: number,
        filters: [boolean, boolean, boolean],
        keyword: string,
        sortField: 'time' | 'title' | 'rate' | 'release_date',
        order: 'ASC' | 'DESC',
        pn: number,
        ps: number,
    }

    type RecordBatchProcessingType = 'recycle' | 'recover' | 'delete_recycled' | 'delete_recycled_all'

    type QueryAuthorRecommendationsOptions = {
        keyword: string,
        sortField: 'time' | 'name'
        order: 'ASC' | 'DESC'
        role: 1 | 0 | string
        pn: number,
        ps: number,
    }

    type QueryTagDetailsOptions = {
        keyword: string,
        sortField: 'time' | 'title'
        order: 'ASC' | 'DESC'
        pn: number,
        ps: number,
    }

    type QueryDirnameDetailsOptions = {
        keyword: string,
        sortField: 'time' | 'path'
        order: 'ASC' | 'DESC'
        pn: number,
        ps: number,
    }
}