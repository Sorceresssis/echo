<template>
    <div class="empty"
         :style="boxStyle">
        <div class="empty__text">
            <span> {{ title }} </span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { $t } from '@/locale';


const props = withDefaults(defineProps<{
    title?: string
    bgColor?: string
}>(), {
    title: $t('layout.thereIsNothingYet'),
    bgColor: 'transparent'
})

const boxStyle = `background-color: ${props.bgColor}`
</script>

<style>
.empty {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: v-bind(bgColor);
}

.empty__text {
    font-size: 14px;
    color: #6d757a;
}
</style>