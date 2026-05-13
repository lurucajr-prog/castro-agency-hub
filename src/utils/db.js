// ============================================================
// Castro Agency Hub — Database Utility
// Place this file at: src/utils/db.js
// ============================================================
import { supabase } from '../lib/supabase'

/**
 * Safe Supabase query wrapper.
 * Catches both network errors and Supabase API errors.
 *
 * Usage:
 *   const { data, error } = await db(q => q.from('sales').select('*'))
 *   if (error) { showError(error); return }
 */
export async function db(queryFn, { silent = false } = {}) {
  try {
    const result = await queryFn(supabase)
    if (result.error) {
      if (!silent) console.error('[DB]', result.error.message, result.error)
      return { data: null, error: result.error }
    }
    return { data: result.data, error: null }
  } catch (err) {
    if (!silent) console.error('[DB exception]', err)
    return { data: null, error: err }
  }
}

/**
 * Write to the audit_log table.
 * Never throws — audit failures must never break the UI.
 *
 * @param {object} params
 * @param {object} params.user     - profile object ({ id, name })
 * @param {string} params.action   - 'INSERT' | 'UPDATE' | 'DELETE'
 * @param {string} params.table    - table name (e.g. 'sales')
 * @param {string|number} params.record_id
 * @param {object} [params.old_data] - snapshot before the change
 * @param {object} [params.new_data] - snapshot after the change
 */
export async function logAudit({ user, action, table, record_id, old_data, new_data }) {
  try {
    await supabase.from('audit_log').insert({
      user_id:    user?.id   ?? null,
      user_name:  user?.name ?? 'Unknown',
      action,
      table_name: table,
      record_id:  record_id != null ? String(record_id) : null,
      old_data:   old_data  ? JSON.stringify(old_data)  : null,
      new_data:   new_data  ? JSON.stringify(new_data)  : null,
    })
  } catch (e) {
    console.warn('[Audit log failed silently]', e)
  }
}
