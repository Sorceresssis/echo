import { $t } from '@/locale';
import { ElMessageBox, type MessageBoxInputValidator, type MessageBoxData } from 'element-plus'

type MessageBoxType = 'error' | 'info' | 'success' | 'warning'

class MessageBox {
    /**  
     * @param options ElMessageBoxOptions,但是不包含type,confirmButtonText,cancelButtonText 参考element-plus官方文档
     */
    public static confirm(
        title: string,
        message: string,
        type: MessageBoxType = 'info',
        confirmButtonText: string = $t('layout.confirm'),
        cancelButtonText: string = $t('layout.cancel'),
        options?: { [key: string]: any; type?: never; confirmButtonText?: never; cancelButtonText?: never }
    ): Promise<MessageBoxData> {
        return ElMessageBox.confirm(
            message,
            title,
            {
                type: type,
                confirmButtonText: confirmButtonText,
                cancelButtonText: cancelButtonText,
                ...options
            }
        )
    }

    public static deleteConfirm(): Promise<MessageBoxData> {
        return this.confirm($t('tips.dangerousOperation'), $t('tips.sureDelete'), 'warning', $t('layout.delete'))
    }

    public static addConfirm(): Promise<MessageBoxData> {
        return this.confirm($t('tips.confirmOperation'), $t('tips.sureAdd'), 'warning', $t('layout.create'))
    }

    public static editConfirm(): Promise<MessageBoxData> {
        return this.confirm($t('tips.dangerousOperation'), $t('tips.sureEdit'), 'warning', $t('layout.modify'))
    }

    // public static 
    // 非空的inputValidator
    public static notEmptyInputValidator(value: string): string | boolean {
        const reg = /\S/
        if (!reg.test(value)) {
            return $t('tips.inputValueNotEmpty')
        }
        return true
    }

    public static editPrompt(inputValidator: MessageBoxInputValidator, inputValue?: string): Promise<MessageBoxData> {
        return ElMessageBox.prompt(
            $t('tips.pleaseInputNewValue'), $t('layout.edit'), {
            confirmButtonText: $t('layout.finish'),
            cancelButtonText: $t('layout.cancel'),
            inputValue: inputValue || '',
            inputValidator: inputValidator
        })
    }
}


export default MessageBox