import { Counter } from '../models/Counter.js';
import { financialYear } from './dates.js';

/** Atomically increments and returns the next number for a key. */
export async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  return doc!.seq;
}

const pad = (n: number, w: number) => String(n).padStart(w, '0');

export const seq = {
  patientId: async (branchId: string, code: string) => `${code}-P-${pad(await nextSeq(`pid:${branchId}`), 6)}`,
  packageNo: async (branchId: string, code: string) => `${code}-PK-${pad(await nextSeq(`pkg:${branchId}`), 5)}`,
  invoiceNo: async (branchId: string, code: string, date: Date) => {
    const fy = financialYear(date);
    return `${code}/INV/${fy}/${pad(await nextSeq(`inv:${branchId}:${fy}`), 4)}`;
  },
  receiptNo: async (branchId: string, code: string, date: Date) => {
    const fy = financialYear(date);
    return `${code}/RCT/${fy}/${pad(await nextSeq(`rct:${branchId}:${fy}`), 4)}`;
  },
  leadNo: async () => `L-${pad(await nextSeq('lead'), 6)}`,
  employeeCode: async () => `EMP-${pad(await nextSeq('emp'), 4)}`,
  purchaseNo: async () => `PUR-${pad(await nextSeq('purchase'), 5)}`,
};
