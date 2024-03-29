import { createI18n } from 'vue-i18n'
import { getConfig } from '@/util/ConfigUtil'
import zhCN from './lang/zhCN'
import en from './lang/en'
import ja from './lang/ja'
import zhTW from './lang/zhTW'

//  | 'ko' | 'de' | 'fr' | 'ru'
export type Lang = 'zhCN' | 'en' | 'ja' | 'zhTW'

const lang: Lang = await getConfig('locale') as Lang || 'zhCN'

export const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: lang,
    fallbackLocale: lang,
    messages: {
        zhCN,
        en,
        ja,
        zhTW
    },
    warnHtmlInMessage: false
})

export const $t = i18n.global.t

export default i18n