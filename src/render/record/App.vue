<template>
    <div v-loading="winowLoading"
         class="flex-1 flex-col overflow-hidden">
        <titlebar />
        <router-view v-slot="{ Component }"
                     class="main-container flex-1 flex-col overflow-hidden">
            <keep-alive>
                <component :is="Component" />
            </keep-alive>
        </router-view>
    </div>
</template>

<script setup lang='ts'>
import { provide, reactive, ref } from 'vue'
import InitialValue from '@/constant/Initial_value';
import { VueInjectKey } from '@/constant/channel_key';
import Titlebar from './views/Titlebar.vue'

const winowLoading = ref<boolean>(false)
const activeLibrary = ref<number>(0)
const activeLibraryDetail = reactive<VO.LibraryDetail>(InitialValue.getLibraryDetail())
const record = reactive<VO.RecordDetail>(InitialValue.getRecordDetail())

provide(VueInjectKey.WINDOW_LOADING, winowLoading)
provide(VueInjectKey.ACTIVE_LIBRARY, activeLibrary)
provide(VueInjectKey.ACTIVE_LIBRARY_DETAIL, activeLibraryDetail)
provide(VueInjectKey.RECORD, record)

</script>

<style scoped>
.slide-track {
    align-items: center;
}

.slide-thumb {
    height: 25px;
    line-height: 25px;
    color: #505050;
    transform: translateY(-25px);
}

.slide-thumb:hover {
    color: var(--echo-theme-color);
}

.slide-enter-from,
.slide-leave-to {
    width: 0;
}

.slide-enter-active,
.slide-leave-active {
    transition: 0.5s;
}

.slide-enter-to,
.slide-leave-from {
    width: 230px;
}

.main-container {
    font-size: 14px;
}
</style>