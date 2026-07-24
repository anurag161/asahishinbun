import type { ExpenseLine, PayrollResult, RateConfig } from '@asahi/shared';
import type { Db } from '../db/Db';
import { AppError } from '../middleware/errorHandler';
import { computeForStaffMonth } from '../services/payrollService';
import { userRepo } from '../repositories/userRepo';
import { periodLabel } from './format';

/** 所属 as printed on the sample forms (fixed for the demo). */
export const DEFAULT_DEPARTMENT = 'ネットワーク報道本部（大阪）（関西）';

export type DocumentType =
  | 'timesheet'
  | 'transport'
  | 'allowances'
  | 'invoice'
  | 'payslip';

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'timesheet',
  'transport',
  'allowances',
  'invoice',
  'payslip',
];

export const DOCUMENT_TITLE: Record<DocumentType, string> = {
  timesheet: '勤務表',
  // 交通費 and 出張日当/私有携帯/その他 are the 別紙 sheets the 請求明細書 refers to.
  transport: '交通費',
  allowances: '出張日当・私有携帯電話使用料・その他',
  invoice: 'アルバイト料請求明細書',
  payslip: '給料計算書',
};

export interface DocumentContext {
  staffId: number;
  staffName: string;
  staffEmail: string;
  department: string;
  month: string;
  periodLabel: string;
  dayCount: number;
  rates: RateConfig;
  payroll: PayrollResult;
  /**
   * The month's raw expense lines. The engine aggregates these into totals, but the
   * 別紙 sheets print them one row per line (one row per one-way leg for transport),
   * so the documents need the unaggregated lines too.
   */
  expenses: ExpenseLine[];
}

export async function buildDocumentContext(
  db: Db,
  staffId: number,
  month: string,
): Promise<DocumentContext> {
  const user = await userRepo.findById(db, staffId);
  if (!user) throw new AppError(404, 'Staff not found');

  const { workDays, result, expenses } = await computeForStaffMonth(db, staffId, month);

  // Reconstruct the rates actually used (mirrors payrollService).
  const { masterRepo } = await import('../repositories/masterRepo');
  const { rateRowToConfig } = await import('../domain/mappers');
  const { DEFAULT_RATES } = await import('@asahi/shared');
  const rateRow = await masterRepo.getLatestRates(db);
  const rates = rateRow ? rateRowToConfig(rateRow) : DEFAULT_RATES;

  return {
    staffId,
    staffName: user.name,
    staffEmail: user.email,
    department: DEFAULT_DEPARTMENT,
    month,
    periodLabel: periodLabel(month),
    dayCount: workDays,
    rates,
    payroll: result,
    expenses,
  };
}
