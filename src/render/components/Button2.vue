<template>
    <button class="button-2"
            type="button">
        <span>
            <slot></slot>
        </span>
    </button>
</template>

<script setup lang='ts'></script>

<style>
.button-2 {
    --button-2-height: 32px;
    display: inline-block;
    justify-content: center;
    align-content: center;
    height: var(--button-2-height);
    white-space: nowrap;
    cursor: pointer;
    text-align: center;
    box-sizing: border-box;
    vertical-align: middle;
    transition: .1s;
    padding: 0 15px;
    background-color: #f5f7fa;
    border: 1px solid #dcdfe6;
    font-size: 14px;
    user-select: none;
}

.button-2:hover {
    background-color: #e7e7e7;
}

.button-2 span {
    display: inline-block;
    min-width: 65px;
    line-height: var(--button-2-height);
}

.button-2:active span {
    transform: translate(0px, 0.5px);
}
</style>