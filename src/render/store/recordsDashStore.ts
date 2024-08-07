import { defineStore } from 'pinia'
import StoreId from './storeId'
import LocalStorage from '@/util/LocalStorage'
import { isSameType } from '@/util/common'
import { RecordCardTitleDisplayType } from '@/constant/enum'

type RecordsDashState = {
    filter: RP.QueryRecordRecommendationsOptions['filters'],
    sortField: RP.QueryRecordRecommendationsOptions['sortField'],
    order: RP.QueryRecordRecommendationsOptions['order'],
    recordCardTitleDisplayType: RecordCardTitleDisplayType
    view: 'thumbnail' | 'extended',
}

const useRecordsDashStore = defineStore(StoreId.RECORDS_DASH, {
    state: (): RecordsDashState => {
        // 默认值
        const defaultState: RecordsDashState = {
            filter: [false, false, false],
            sortField: 'time',
            order: 'ASC',
            recordCardTitleDisplayType: RecordCardTitleDisplayType.TITLE,
            view: "thumbnail",
        }
        // 读取本地存储
        const saved = LocalStorage.get<RecordsDashState>(StoreId.RECORDS_DASH)
        if (saved && isSameType(saved, defaultState)) {
            return saved
        } else {
            LocalStorage.set(StoreId.RECORDS_DASH, defaultState)
            return defaultState
        }
    },
    actions: {
        handleView(view: RecordsDashState['view']) {
            this.view = view
            LocalStorage.set(StoreId.RECORDS_DASH, this.$state)
        },
        setRecordCardTitleDisplayType(type: RecordCardTitleDisplayType) {
            this.recordCardTitleDisplayType = type
            LocalStorage.set(StoreId.RECORDS_DASH, this.$state)
        },
        handleFilter(key: number) {
            this.filter[key] = !this.filter[key]
            LocalStorage.set(StoreId.RECORDS_DASH, this.$state)
        },
        handleSortField(field: RecordsDashState['sortField']) {
            this.sortField = field
            LocalStorage.set(StoreId.RECORDS_DASH, this.$state)
        },
        handleOrder(order: RecordsDashState['order']) {
            this.order = order
            LocalStorage.set(StoreId.RECORDS_DASH, this.$state)
        },
    }
})

export default useRecordsDashStore 