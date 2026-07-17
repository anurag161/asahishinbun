import type { PayrollResult, RateConfig } from '@asahi/shared';
import type { Db } from '../db/Db';
import { AppError } from '../middleware/errorHandler';
import { computeForStaffMonth } from '../services/payrollService';
import { userRepo } from '../repositories/userRepo';
import { periodLabel } from './format';

/** 所属 as printed on the sample forms (fixed for the demo). */
export const DEFAULT_DEPARTMENT = 'ネットワーク報道本部（大阪）（関西）';

export type DocumentType = 'timesheet' | 'invoice' | 'payslip';

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'timesheet',
  'invoice',
  'payslip',
];

export const DOCUMENT_TITLE: Record<DocumentType, string> = {
  timesheet: '勤務表',
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
}

export async function buildDocumentContext(
  db: Db,
  staffId: number,
  month: string,
): Promise<DocumentContext> {
  const user = await userRepo.findById(db, staffId);
  if (!user) throw new AppError(404, 'Staff not found');

  const { workDays, result } = await computeForStaffMonth(db, staffId, month);

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
  };
}
