import { defineStore } from 'pinia'
import StoreId from './storeId'
import { getLocalStorage, setLocalStorage } from '@/util/LocalStorage'
import { isSameType } from '@/util/common'

type AuthorsDashState = {
    sortField: DTO.QueryAuthorRecommendationsOptions['sortField'],
    order: 'ASC' | 'DESC'
}

const useAuthorsDashStore = defineStore(StoreId.AUTHORS_DASH, {
    state: (): AuthorsDashState => {
        const defaultState: AuthorsDashState = {
            sortField: 'name',
            order: 'ASC'
        }

        const saved = getLocalStorage(StoreId.AUTHORS_DASH)
        if (saved && isSameType(saved, defaultState)) {
            return saved
        } else {
            setLocalStorage(StoreId.AUTHORS_DASH, defaultState)
            return defaultState
        }
    },
    actions: {
        handleSortField(field: AuthorsDashState['sortField']) {
            this.sortField = field
            setLocalStorage(StoreId.AUTHORS_DASH, this.$state)
        },
        handleOrder(order: 'ASC' | 'DESC') {
            this.order = order
            setLocalStorage(StoreId.AUTHORS_DASH, this.$state)
        },
    }
})

export default useAuthorsDashStore