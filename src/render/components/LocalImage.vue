<template>
    <img :src="src ? `file:///${src}` : noImg"
        loading="lazy"
        @error="($event.target as HTMLImageElement).src = noImg" />
</template>

<script setup
    lang='ts'>
    import noImg from '@/assets/images/no-img.png'

    defineProps<{
        src: string | undefined | null
    }>()
</script>