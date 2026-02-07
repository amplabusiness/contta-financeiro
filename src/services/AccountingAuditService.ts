import { supabase } from '@/integrations/supabase/client'

interface AuditLogEntry {
  user_id: string
  action: string
  table_name: string
  record_id: string
  old_values: Record<string, any>
  new_values: Record<string, any>
  description: string
}

interface LineChangeRecord {
  line_id: string
  old_account_code?: string
  new_account_code?: string
  old_debit?: number
  new_debit?: number
  old_credit?: number
  new_credit?: number
  old_description?: string
  new_description?: string
}

export class AccountingAuditService {
  static async logAccountingEntryChange(
    entryId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    userId: string,
    description: string
  ): Promise<void> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'update',
        table_name: 'accounting_entries',
        record_id: entryId,
        old_values: oldValues,
        new_values: newValues,
        created_at: new Date().toISOString(),
        metadata: {
          description,
          change_type: 'accounting_entry_modification',
          timestamp: new Date().toISOString()
        }
      })

      if (error) {
        console.error('Erro Supabase ao registrar auditoria:', error)
        throw new Error(`Erro ao registrar auditoria: ${error.message}`)
      }
    } catch (error: any) {
      console.error('Erro ao registrar auditoria de lançamento:', error?.message || error)
      throw error
    }
  }

  static async logLineChange(
    entryId: string,
    lineId: string,
    changes: LineChangeRecord,
    userId: string
  ): Promise<void> {
    try {
      const changeDescription = this.buildChangeDescription(changes)

      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'update',
        table_name: 'accounting_entry_items',
        record_id: lineId,
        old_values: {
          account_code: changes.old_account_code,
          debit: changes.old_debit,
          credit: changes.old_credit,
          description: changes.old_description
        },
        new_values: {
          account_code: changes.new_account_code,
          debit: changes.new_debit,
          credit: changes.new_credit,
          description: changes.new_description
        },
        created_at: new Date().toISOString(),
        metadata: {
          entry_id: entryId,
          change_description: changeDescription,
          change_type: 'line_reclassification'
        }
      })

      if (error) {
        console.error('Erro Supabase ao registrar auditoria de linha:', error)
        throw new Error(`Erro ao registrar auditoria: ${error.message}`)
      }
    } catch (error: any) {
      console.error('Erro ao registrar auditoria de linha:', error?.message || error)
      throw error
    }
  }

  private static buildChangeDescription(changes: LineChangeRecord): string {
    const parts: string[] = []

    if (changes.old_account_code !== changes.new_account_code) {
      parts.push(`Conta alterada de ${changes.old_account_code} para ${changes.new_account_code}`)
    }

    if (changes.old_debit !== changes.new_debit) {
      parts.push(`Débito alterado de ${changes.old_debit} para ${changes.new_debit}`)
    }

    if (changes.old_credit !== changes.new_credit) {
      parts.push(`Crédito alterado de ${changes.old_credit} para ${changes.new_credit}`)
    }

    if (changes.old_description !== changes.new_description) {
      parts.push(`Descrição alterada`)
    }

    return parts.join('; ') || 'Alteração não identificada'
  }

  static async getEntryAuditHistory(entryId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('record_id', entryId)
        .eq('table_name', 'accounting_entries')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro Supabase ao buscar histórico:', error)
        throw new Error(`Erro ao buscar histórico: ${error.message}`)
      }
      return data || []
    } catch (error: any) {
      console.error('Erro ao buscar histórico de auditoria:', error?.message || error)
      return []
    }
  }

  static async getLineAuditHistory(lineId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('record_id', lineId)
        .eq('table_name', 'accounting_entry_items')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro Supabase ao buscar histórico de linha:', error)
        throw new Error(`Erro ao buscar histórico: ${error.message}`)
      }
      return data || []
    } catch (error: any) {
      console.error('Erro ao buscar histórico de linha:', error?.message || error)
      return []
    }
  }

  static async updateAccountingLineWithAudit(
    lineId: string,
    updates: Record<string, any>,
    oldValues: Record<string, any>,
    userId: string,
    entryId: string
  ): Promise<void> {
    try {
      const { error: updateError } = await supabase
        .from('accounting_entry_items')
        .update(updates)
        .eq('id', lineId)

      if (updateError) {
        throw new Error(`Erro ao atualizar linha: ${updateError.message}`)
      }

      await this.logLineChange(
        entryId,
        lineId,
        {
          line_id: lineId,
          old_account_code: oldValues.account_code,
          new_account_code: updates.chart_of_accounts_id || oldValues.account_code,
          old_debit: oldValues.debit,
          new_debit: updates.debit !== undefined ? updates.debit : oldValues.debit,
          old_credit: oldValues.credit,
          new_credit: updates.credit !== undefined ? updates.credit : oldValues.credit,
          old_description: oldValues.description,
          new_description: updates.description || oldValues.description
        },
        userId
      )
    } catch (error: any) {
      console.error('Erro ao atualizar linha com auditoria:', error?.message || error)
      throw error
    }
  }

  static async deleteEntryWithAudit(
    entryId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      const { data: entry, error: fetchError } = await supabase
        .from('accounting_entries')
        .select('*')
        .eq('id', entryId)
        .single()

      if (fetchError) {
        throw new Error(`Erro ao buscar lançamento: ${fetchError.message}`)
      }

      const { error: deleteError } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('id', entryId)

      if (deleteError) {
        throw new Error(`Erro ao deletar lançamento: ${deleteError.message}`)
      }

      const { error: auditError } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'delete',
        table_name: 'accounting_entries',
        record_id: entryId,
        old_values: entry,
        new_values: null,
        created_at: new Date().toISOString(),
        metadata: {
          deletion_reason: reason,
          change_type: 'entry_deletion'
        }
      })

      if (auditError) {
        console.warn('Aviso ao registrar auditoria de deleção:', auditError)
      }
    } catch (error: any) {
      console.error('Erro ao deletar lançamento com auditoria:', error?.message || error)
      throw error
    }
  }
}
