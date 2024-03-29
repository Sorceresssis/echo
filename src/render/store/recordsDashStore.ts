import { defineStore } from 'pinia'
import StoreId from './storeId'
import { getLocalStorage, setLocalStorage } from '@/util/LocalStorage'
import { isSameType } from '@/util/common'

type RecordsDashState = {
    view: 'thumbnail' | 'extended',
    filter: DTO.QueryRecordRecommendationsOptions['filters'],
    sortField: DTO.QueryRecordRecommendationsOptions['sortField'],
    order: DTO.QueryRecordRecommendationsOptions['order'],
}


const useRecordsDashStore = defineStore(StoreId.RECORDS_DASH, {
    state: (): RecordsDashState => {
        // 默认值
        const defaultState: RecordsDashState = {
            view: "thumbnail",
            filter: [false, false, false],
            sortField: 'time',
            order: 'ASC',
        }
        // 读取本地存储
        const saved = getLocalStorage(StoreId.RECORDS_DASH)
        if (saved && isSameType(saved, defaultState)) {
            return saved
        } else {
            setLocalStorage(StoreId.RECORDS_DASH, defaultState)
            return defaultState
        }
    },
    actions: {
        handleView(view: RecordsDashState['view']) {
            this.view = view
            setLocalStorage(StoreId.RECORDS_DASH, this.$state)
        },
        handleFilter(key: number) {
            this.filter[key] = !this.filter[key]
            setLocalStorage(StoreId.RECORDS_DASH, this.$state)
        },
        handleSortField(field: RecordsDashState['sortField']) {
            this.sortField = field
            setLocalStorage(StoreId.RECORDS_DASH, this.$state)
        },
        handleOrder(order: RecordsDashState['order']) {
            this.order = order
            setLocalStorage(StoreId.RECORDS_DASH, this.$state)
        },
    }
})

export default useRecordsDashStore 