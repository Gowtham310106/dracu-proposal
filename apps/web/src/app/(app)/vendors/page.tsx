'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resolver } from '@/lib/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { defaultValuesFor, PAYMENT_STATUS, PURCHASE_FORM, purchaseInput, VENDOR_FORM, vendorInput, type Purchase, type Vendor } from '@acuheal/types';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { Badge, Button, Card, DataTable, ErrorNote, Field, Input, Modal, PageHeader, Select, Tabs, statusTone, type Column } from '@/components/ui';
import { accountsService, branchService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDate, inr, mobileDisplay, today } from '@/lib/format';

export default function VendorsPage() {
  const { branchId, can } = useAuth();
  const [tab, setTab] = useState('vendors');
  const [page, setPage] = useState(1);
  const [addingVendor, setAddingVendor] = useState(false);
  const [addingPurchase, setAddingPurchase] = useState(false);

  const vendors = useQuery({ queryKey: ['vendors', page], queryFn: () => accountsService.vendors({ page, limit: 25 }), enabled: tab === 'vendors' });
  const purchases = useQuery({ queryKey: ['purchases', page, branchId], queryFn: () => accountsService.purchases({ page, limit: 25 }), enabled: tab === 'purchases' });

  const vendorCols: Column<Vendor>[] = [
    {
      key: 'name',
      header: 'Vendor',
      render: (v) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{v.name}</p>
          <p className="text-xs text-muted">{v.contactPerson ? `${v.contactPerson} · ` : ''}{mobileDisplay(v.mobile)}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Categories', hideOnMobile: true, render: (v) => <span className="flex flex-wrap gap-1">{v.category?.map((c) => <Badge key={c} tone="stone">{c}</Badge>)}</span> },
    { key: 'purchased', header: 'Purchased', render: (v) => <span className="tabular-nums">{inr(v.totalPurchased)}</span> },
    { key: 'outstanding', header: 'Outstanding', render: (v) => <span className={v.totalOutstanding ? 'font-semibold tabular-nums text-point-red' : 'tabular-nums text-muted'}>{inr(v.totalOutstanding)}</span> },
    { key: 'active', header: 'Status', render: (v) => <Badge tone={v.active ? 'green' : 'neutral'}>{v.active ? 'Active' : 'Inactive'}</Badge> },
  ];

  const purchaseCols: Column<Purchase>[] = [
    { key: 'no', header: 'Purchase', render: (p) => <span className="font-semibold whitespace-nowrap">{p.purchaseNo}</span> },
    { key: 'vendor', header: 'Vendor', render: (p) => <span className="font-medium">{(p as Purchase & { vendor?: { name: string } }).vendor?.name ?? '—'}</span> },
    { key: 'date', header: 'Date', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{fmtDate(p.date)}</span> },
    { key: 'items', header: 'Items', hideOnMobile: true, render: (p) => <span className="text-xs text-muted">{p.items.map((i) => i.name).join(', ')}</span> },
    { key: 'total', header: 'Total', render: (p) => <span className="font-semibold tabular-nums">{inr(p.total)}</span> },
    { key: 'paid', header: 'Paid', hideOnMobile: true, render: (p) => <span className="tabular-nums">{inr(p.paidAmount)}</span> },
    { key: 'status', header: 'Status', render: (p) => <Badge tone={statusTone(p.paymentStatus)}>{p.paymentStatus}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Vendors & purchases"
        subtitle="Needle suppliers, equipment and services"
        actions={
          can('vendors:manage') && (
            <>
              <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setAddingVendor(true)}>
                Add vendor
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setAddingPurchase(true)}>
                Record purchase
              </Button>
            </>
          )
        }
      />

      <Card bodyClass="p-0">
        <div className="px-3 pt-2">
          <Tabs tabs={[{ id: 'vendors', label: 'Vendors' }, { id: 'purchases', label: 'Purchases' }]} active={tab} onChange={(t) => { setTab(t); setPage(1); }} />
        </div>
        {tab === 'vendors' ? (
          <DataTable columns={vendorCols} rows={vendors.data?.items ?? []} loading={vendors.isLoading} empty="No vendors yet." page={vendors.data?.meta?.page} pages={vendors.data?.meta?.pages} total={vendors.data?.meta?.total} onPage={setPage} />
        ) : (
          <DataTable columns={purchaseCols} rows={purchases.data?.items ?? []} loading={purchases.isLoading} empty="No purchases recorded." page={purchases.data?.meta?.page} pages={purchases.data?.meta?.pages} total={purchases.data?.meta?.total} onPage={setPage} />
        )}
      </Card>

      {addingVendor && <VendorModal onClose={() => setAddingVendor(false)} />}
      {addingPurchase && <PurchaseModal onClose={() => setAddingPurchase(false)} />}
    </>
  );
}

function VendorModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const form = useForm<Record<string, unknown>>({ resolver: resolver(vendorInput), defaultValues: { ...defaultValuesFor(VENDOR_FORM), active: true } });

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => accountsService.createVendor(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not save the vendor'),
  });

  return (
    <Modal open onClose={onClose} wide title="Add vendor" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => void form.handleSubmit((v) => { setServerError(''); mutation.mutate(v); })()}>Save vendor</Button></>}>
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer definition={VENDOR_FORM} control={form.control} errors={form.formState.errors} watch={form.watch} />
      </div>
    </Modal>
  );
}

interface PItem {
  name: string;
  qty: number;
  unitPrice: number;
}

function PurchaseModal({ onClose }: { onClose: () => void }) {
  const { branchId, user } = useAuth();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');
  const [items, setItems] = useState<PItem[]>([{ name: '', qty: 1, unitPrice: 0 }]);
  const { data: vendors } = useQuery({ queryKey: ['vendors-pick'], queryFn: () => accountsService.vendors({ limit: 200, status: 'active' }) });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: branchService.list });

  const form = useForm<Record<string, unknown>>({
    resolver: resolver(purchaseInput.omit({ items: true })),
    defaultValues: { ...defaultValuesFor(PURCHASE_FORM), branchId: branchId ?? user?.defaultBranchId ?? '', date: today(), paidAmount: 0, paymentStatus: 'Unpaid' },
  });

  const total = items.reduce((s, i) => s + Math.round(i.qty * i.unitPrice), 0);

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => accountsService.createPurchase({ ...values, items }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] });
      void qc.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : 'Could not save the purchase'),
  });

  const setItem = (i: number, patch: Partial<PItem>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Record purchase"
      footer={
        <>
          <span className="mr-auto text-sm font-semibold">Total: {inr(total)}</span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!items.some((i) => i.name.trim())} loading={mutation.isPending} onClick={() => void form.handleSubmit((v) => { setServerError(''); mutation.mutate(v); })()}>
            Save purchase
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <FormRenderer
          definition={PURCHASE_FORM}
          control={form.control}
          errors={form.formState.errors}
          watch={form.watch}
          hidden={['attachmentUrl', ...(branches.length <= 1 ? ['branchId'] : [])]}
          slots={{
            vendorId: () => (
              <Select {...form.register('vendorId')}>
                <option value="">Select vendor…</option>
                {vendors?.items.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            ),
            branchId: () => (
              <Select {...form.register('branchId')}>
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            ),
            paymentStatus: () => (
              <Select {...form.register('paymentStatus')}>
                {PAYMENT_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ),
          }}
        />

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-line bg-gray-50/60 px-4 py-2.5">
            <h3 className="text-sm font-semibold">Items</h3>
            <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setItems((p) => [...p, { name: '', qty: 1, unitPrice: 0 }])}>
              Add
            </Button>
          </header>
          <div className="space-y-2 p-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2">
                <Field label={i === 0 ? 'Item' : undefined} className="col-span-6">
                  <Input value={item.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Sterile needles 0.25×25mm" />
                </Field>
                <Field label={i === 0 ? 'Qty' : undefined} className="col-span-2">
                  <Input type="number" min={1} value={item.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={i === 0 ? 'Rate' : undefined} className="col-span-3">
                  <Input type="number" min={0} value={item.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) || 0 })} />
                </Field>
                <div className="col-span-1 pb-1.5">
                  {items.length > 1 && (
                    <button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="rounded p-1 text-muted hover:bg-red-50 hover:text-point-red" aria-label="Remove item">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
