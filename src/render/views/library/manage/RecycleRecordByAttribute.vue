<template>
    <div class="flex-col">
        <el-form class="dashboard__content scrollbar-y-w8"
                 ref="formRef"
                 label-position="left"
                 :model="formData"
                 :rules="rules"
                 label-width="120px"
                 require-asterisk-position="right"
                 status-icon>
            <el-form-item :label="$t('layout.dirname')"
                          prop="dirnamePath">
                <echo-autocomplete v-model="formData.dirnamePath"
                                   type="dirname"
                                   show-word-limit
                                   :placeholder="$t('layout.dirnamePath')"
                                   maxlength="4000" />
            </el-form-item>
            <el-form-item :label="$t('layout.tag')"
                          prop="tagTitle">
                <echo-autocomplete v-model="formData.tagTitle"
                                   type="tag"
                                   show-word-limit
                                   :placeholder="$t('layout.tagName')"
                                   maxlength="255" />
            </el-form-item>
            <el-form-item :label="$t('layout.series')"
                          prop="seriesName">
                <echo-autocomplete v-model="formData.seriesName"
                                   type="series"
                                   show-word-limit
                                   :placeholder="$t('layout.seriesName')"
                                   maxlength="255" />
            </el-form-item>
            <el-form-item>
                <el-button type="primary"
                           :loading="btnLoading"
                           @click="submitForm(formRef)">
                    {{ $t('layout.delete') }}
                </el-button>
                <el-button @click="init">
                    {{ $t('layout.reset') }}
                </el-button>
            </el-form-item>
        </el-form>
    </div>
</template>
  
<script lang="ts" setup>
import { ref, Ref, reactive, inject, toRaw, watch } from 'vue'
import { useRoute } from 'vue-router'
import { $t } from '@/locale'
import type { FormInstance, FormRules, } from 'element-plus'
import EchoAutocomplete from '@/components/EchoAutocomplete.vue'
import MessageBox from '@/util/MessageBox'
import Message from '@/util/Message'

const route = useRoute()

const activeLibrary = inject<Ref<number>>('activeLibrary') as Ref<number> // 正在打开的Library

const btnLoading = ref(false)
const formRef = ref<FormInstance>()
const formData = reactive<DTO.DeleteRecordByAttributeForm>({
    dirnamePath: '',
    tagTitle: '',
    seriesName: '',
})

const emptyFormValidator = (rule: any, value: string, callback: (error?: string | Error | undefined) => void) => {
    return formData.dirnamePath || formData.tagTitle || formData.seriesName ? callback() : callback(new Error($t('tips.pleaseFillAtLeastOneForm')))
}
const rules: FormRules = {
    dirnamePath: [{ validator: emptyFormValidator, trigger: 'blur' }],
    tagTitle: [{ validator: emptyFormValidator, trigger: 'blur' }],
    seriesName: [{ validator: emptyFormValidator, trigger: 'blur' }],
}
const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (!valid) return
        MessageBox.confirm($t('tips.dangerousOperation'), $t('tips.sureRecycle'), 'warning').then(async () => {
            btnLoading.value = true
            await window.electronAPI.deleteRecordByAttribute(activeLibrary.value, toRaw(formData))
            Message.success($t('msg.recycleSuccess'))
            btnLoading.value = false
        })
    })
}

const init = () => {
    formData.dirnamePath = ''
    formData.tagTitle = ''
    formData.seriesName = ''
}
watch(route, init)
</script>