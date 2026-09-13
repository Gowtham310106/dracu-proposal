'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { computeInvoiceTotals, INVOICE_ITEM_TYPES, PAYMENT_MODES } from '@acuheal/types';
import { Button, Card, ErrorNote, Field, Input, PageHeader, SearchPicker, Select, Textarea } from '@/components/ui';
import { billingService, branchService, packageService, patientService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { inr, today } from '@/lib/format';

interface Item {
  description: string;
  type: string;
  qty: number;
  unitPrice: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { branchId, user } = useAuth();

  const [patientId, setPatientId] = useState(params.get('patientId') ?? '');
  const [patientLabel, setPatientLabel] = useState('');
  const [packageId, setPackageId] = useState(params.get('packageId') ?? '');
  const [branch, setBranch] = useState(branchId ?? user?.defaultBranchId ?? '');
  const [date, setDate] = useState(today());
  const [items, setItems] = useState<Item[]>([{ description: '', type: 'Session', qty: 1, unitPrice: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState('Cash');
  const [payReference, setPayReference] = useState('');
  const [error, setError] = useState('');

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list });
  const { data: packages } = useQuery({ queryKey: ['patient-packages', patientId], queryFn: () => packageService.list({ patientId, limit: 20 }), enabled: !!patientId });

  useEffect(() => {
    if (!params.get('patientId')) return;
    void patientService.get(params.get('patientId')!).then((p) => setPatientLabel(`${p.fullName} (${p.pid})`));
  }, [params]);

  // Selecting a package pre-fills the line item with its outstanding balance.
  useEffect(() => {
    if (!packageId) return;
    const pkg = packages?.items.find((p) => p._id === packageId);
    if (!pkg) return;
    setItems([{ description: `${pkg.customPlanName || pkg.treatmentPlanName} — ${pkg.totalSessions} sessions (${pkg.packageNo})`, type: 'Package', qty: 1, unitPrice: pkg.balance || pkg.totalPayable }]);
  }, [packageId, packages]);

  const totals = computeInvoiceTotals({ items, discount, taxPercent });
  useEffect(() => setPayAmount(totals.grandTotal), [totals.grandTotal]);

  const create = useMutation({
    mutationFn: () =>
      billingService.createInvoice({
        branchId: branch,
        patientId,
        packageId: packageId || undefined,
        date,
        items,
        discount,
        taxPercent,
        notes: notes || undefined,
        payment: payNow && payAmount > 0 ? { amount: payAmount, mode: payMode, reference: payReference || undefined } : undefined,
      }),
    onSuccess: (invoice) => {
      void qc.invalidateQueries({ queryKey: ['invoices'] });
      router.replace(`/billing/${invoice._id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create the invoice'),
  });

  const setItem = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const valid = patientId && branch && items.length > 0 && items.every((i) => i.description.trim() && i.unitPrice >= 0);

  return (
    <>
      <PageHeader title="New invoice" subtitle="Invoice numbers are generated per branch and financial year." />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}

          <Card title="Invoice">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Patient" required className="sm:col-span-2">
                <SearchPicker
                  value={patientId}
                  valueLabel={patientLabel}
                  onChange={(id, opt) => {
                    setPatientId(id ?? '');
                    setPatientLabel(opt?.label ?? '');
                    setPackageId('');
                  }}
                  search={async (q) => (await patientService.search(q)).map((p) => ({ _id: p._id, label: p.fullName, sub: `${p.pid} · +91 ${p.mobile}` }))}
                  placeholder="Search name, PID or mobile…"
                />
              </Field>
              <Field label="Date" required>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              {branches.length > 1 && (
                <Field label="Branch" required>
                  <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
                    <option value="">Select branch…</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {patientId && (packages?.items.length ?? 0) > 0 && (
                <Field label="Against treatment package" help="Links the payment to the package balance" className="sm:col-span-2">
                  <Select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                    <option value="">Not linked</option>
                    {packages?.items.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.packageNo} — {p.customPlanName || p.treatmentPlanName} · balance {inr(p.balance)}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          </Card>

          <Card title="Items" action={<Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setItems((p) => [...p, { description: '', type: 'Session', qty: 1, unitPrice: 0 }])}>Add item</Button>} bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
                    <th className="px-3 py-2">Description</th>
                    <th className="w-32 px-3 py-2">Type</th>
                    <th className="w-20 px-3 py-2">Qty</th>
                    <th className="w-28 px-3 py-2">Rate</th>
                    <th className="w-28 px-3 py-2 text-right">Amount</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2">
                        <Input value={item.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Consultation / session package…" />
                      </td>
                      <td className="px-3 py-2">
                        <Select value={item.type} onChange={(e) => setItem(i, { type: e.target.value })}>
                          {INVOICE_ITEM_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={1} value={item.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0} value={item.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(Math.round(item.qty * item.unitPrice))}</td>
                      <td className="px-3 py-2">
                        {items.length > 1 && (
                          <button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="rounded p-1 text-muted hover:bg-red-50 hover:text-point-red" aria-label="Remove item">
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Payment on this invoice">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="size-4 rounded border-line text-brand-600 focus:ring-brand-400" />
              Collect payment now
            </label>
            {payNow && (
              <div className="mt-3 grid gap-3.5 sm:grid-cols-3">
                <Field label="Amount (₹)">
                  <Input type="number" min={0} max={totals.grandTotal} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value) || 0)} />
                </Field>
                <Field label="Mode">
                  <Select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
                {['UPI', 'Card', 'Bank transfer'].includes(payMode) && (
                  <Field label="Reference">
                    <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} />
                  </Field>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-semibold tabular-nums">{inr(totals.subtotal)}</dd>
              </div>
              <Field label="Discount (₹)">
                <Input type="number" min={0} max={totals.subtotal} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
              </Field>
              <Field label="Tax %">
                <Input type="number" min={0} max={28} step={0.5} value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value) || 0)} />
              </Field>
              <div className="flex justify-between">
                <dt className="text-muted">Tax</dt>
                <dd className="tabular-nums">{inr(totals.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt className="font-semibold">Grand total</dt>
                <dd className="font-bold tabular-nums">{inr(totals.grandTotal)}</dd>
              </div>
            </dl>
            <Field label="Notes on invoice" className="mt-3">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button className="mt-3 w-full" size="lg" disabled={!valid} loading={create.isPending} onClick={() => { setError(''); create.mutate(); }}>
              Create invoice
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
