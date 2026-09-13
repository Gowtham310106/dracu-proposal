'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Trash2 } from 'lucide-react';
import { LANGUAGES, MESSAGE_PLACEHOLDERS, MESSAGE_TYPES, type MessageLog, type MessageTemplate } from '@acuheal/types';
import { Badge, Button, Card, DataTable, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, SearchPicker, Select, Tabs, Textarea, statusTone, type Column } from '@/components/ui';
import { messagingService, patientService } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

export default function MessagingPage() {
  const { branchId, can } = useAuth();
  const [tab, setTab] = useState('templates');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();

  const templates = useQuery({ queryKey: ['templates'], queryFn: messagingService.templates });
  const logs = useQuery({ queryKey: ['message-logs', type, status, page, branchId], queryFn: () => messagingService.logs({ type, status, page, limit: 25 }), enabled: tab === 'logs' });

  const remove = useMutation({
    mutationFn: (id: string) => messagingService.deleteTemplate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const logCols: Column<MessageLog>[] = [
    { key: 'at', header: 'Sent', render: (l) => <span className="whitespace-nowrap text-xs text-muted">{fmtDateTime(l.sentAt ?? l.createdAt)}</span> },
    { key: 'type', header: 'Type', render: (l) => <Badge tone="stone">{l.type.replace(/_/g, ' ').toLowerCase()}</Badge> },
    { key: 'to', header: 'To', render: (l) => <span className="tabular-nums">+91 {l.to}</span> },
    { key: 'patient', header: 'Patient', hideOnMobile: true, render: (l) => <span className="text-gray-700">{l.patientName ?? '—'}</span> },
    { key: 'body', header: 'Message', hideOnMobile: true, render: (l) => <span className="line-clamp-2 max-w-md text-xs text-muted">{l.body}</span> },
    { key: 'status', header: 'Status', render: (l) => <Badge tone={statusTone(l.status)}>{l.status}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="WhatsApp"
        subtitle="Session reminders, birthday wishes and follow-up templates"
        actions={
          can('messaging:manage') && (
            <>
              <Button variant="secondary" icon={<Send className="size-4" />} onClick={() => setSending(true)}>
                Send message
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                New template
              </Button>
            </>
          )
        }
      />

      <Card bodyClass="p-0">
        <div className="px-3 pt-2">
          <Tabs tabs={[{ id: 'templates', label: 'Templates', count: templates.data?.length }, { id: 'logs', label: 'Sent log' }]} active={tab} onChange={(t) => { setTab(t); setPage(1); }} />
        </div>

        {tab === 'templates' ? (
          <div className="p-3">
            {(templates.data?.length ?? 0) === 0 ? (
              <EmptyState title="No templates yet" hint="Templates drive automatic session reminders and birthday wishes." />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {templates.data?.map((t) => (
                  <li key={t._id} className="card p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{t.name}</span>
                      <Badge tone="brand">{t.type.replace(/_/g, ' ').toLowerCase()}</Badge>
                      <Badge tone="stone">{t.language}</Badge>
                      <Badge tone={t.active ? 'green' : 'neutral'}>{t.active ? 'Active' : 'Off'}</Badge>
                    </div>
                    <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap text-gray-700">{t.body}</p>
                    {t.type === 'SESSION_REMINDER' && <p className="mt-1.5 text-xs text-muted">Sent {t.sendOffsetHours} hours before the appointment.</p>}
                    {can('messaging:manage') && (
                      <div className="mt-2 flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-point-red" icon={<Trash2 className="size-4" />} onClick={() => confirm(`Delete "${t.name}"?`) && remove.mutate(t._id)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-line p-3">
              <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-48">
                <option value="">All types</option>
                {MESSAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </Select>
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-36">
                <option value="">All statuses</option>
                {['Queued', 'Sent', 'Failed', 'Skipped'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <DataTable columns={logCols} rows={logs.data?.items ?? []} loading={logs.isLoading} empty="No messages sent yet." page={logs.data?.meta?.page} pages={logs.data?.meta?.pages} total={logs.data?.meta?.total} onPage={setPage} />
          </>
        )}
      </Card>

      {editing && <TemplateModal template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {sending && <SendModal onClose={() => setSending(false)} templates={templates.data ?? []} />}
    </>
  );
}

function TemplateModal({ template, onClose }: { template: MessageTemplate | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState(template?.type ?? 'SESSION_REMINDER');
  const [language, setLanguage] = useState(template?.language ?? 'English');
  const [body, setBody] = useState(template?.body ?? '');
  const [sendOffsetHours, setSendOffsetHours] = useState(template?.sendOffsetHours ?? 24);
  const [active, setActive] = useState(template?.active ?? true);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name, type, language, body, sendOffsetHours, active };
      return template ? messagingService.updateTemplate(template._id, payload) : messagingService.createTemplate(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['templates'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save the template'),
  });

  return (
    <Modal open onClose={onClose} wide title={template ? `Edit ${template.name}` : 'New template'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} onClick={() => { setError(''); mutation.mutate(); }}>Save template</Button></>}>
      <div className="space-y-3.5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Session reminder (English)" />
          </Field>
          <Field label="Language">
            <Select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {MESSAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Send offset (hours)" help="Hours before the appointment">
            <Input type="number" min={0} max={72} value={sendOffsetHours} onChange={(e) => setSendOffsetHours(Number(e.target.value) || 0)} />
          </Field>
          <Field label="Active">
            <label className="flex items-center gap-2 py-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 rounded border-line text-brand-600 focus:ring-brand-400" />
              Use this template automatically
            </label>
          </Field>
        </div>

        <Field label="Message" required help="Click a placeholder to insert it">
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {MESSAGE_PLACEHOLDERS.map((p) => (
            <button key={p} type="button" onClick={() => setBody((b) => `${b}{{${p}}}`)} className="rounded-md border border-line bg-white px-2 py-1 font-mono text-xs text-gray-600 hover:border-brand-300 hover:bg-brand-50">
              {`{{${p}}}`}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function SendModal({ onClose, templates }: { onClose: () => void; templates: MessageTemplate[] }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [patientLabel, setPatientLabel] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => messagingService.send({ patientId: patientId || undefined, templateId: templateId || undefined, body: body || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['message-logs'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not send'),
  });

  return (
    <Modal open onClose={onClose} title="Send WhatsApp message" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!patientId || (!templateId && !body)} loading={mutation.isPending} onClick={() => { setError(''); mutation.mutate(); }}>Send</Button></>}>
      <div className="space-y-3.5">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="Patient" required>
          <SearchPicker
            value={patientId}
            valueLabel={patientLabel}
            onChange={(id, opt) => {
              setPatientId(id ?? '');
              setPatientLabel(opt?.label ?? '');
            }}
            search={async (q) => (await patientService.search(q)).map((p) => ({ _id: p._id, label: p.fullName, sub: `${p.pid} · +91 ${p.mobile}` }))}
          />
        </Field>
        <Field label="Template" help="Or leave blank and write a message below">
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">No template</option>
            {templates.filter((t) => t.active).map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        {!templateId && (
          <Field label="Message" required>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
