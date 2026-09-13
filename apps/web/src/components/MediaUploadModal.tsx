'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Video } from 'lucide-react';
import { MEDIA_CATEGORIES, MEDIA_LIMITS } from '@acuheal/types';
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { mediaService } from '@/services';
import { bytes, today } from '@/lib/format';

export function MediaUploadModal({ open, onClose, patientId, patientLabel, sessionLogId, onUploaded }: { open: boolean; onClose: () => void; patientId: string; patientLabel: string; sessionLogId?: string; onUploaded?: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('Progress');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const kind: 'Video' | 'Photo' = file?.type.startsWith('video/') ? 'Video' : 'Photo';
  const limit = kind === 'Video' ? MEDIA_LIMITS.videoMaxBytes : MEDIA_LIMITS.photoMaxBytes;
  const tooBig = !!file && file.size > limit;

  const upload = useMutation({
    mutationFn: () => mediaService.upload(file!, { patientId, kind, category, title: title || undefined, notes: notes || undefined, sessionLogId, capturedAt: today() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['media-usage'] });
      onUploaded?.();
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Upload failed'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Upload media — ${patientLabel}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!file || tooBig} loading={upload.isPending} onClick={() => { setError(''); upload.mutate(); }}>
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        {error && <ErrorNote>{error}</ErrorNote>}

        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
          {file ? <Video className="size-6 text-brand-600" /> : <Upload className="size-6 text-muted" />}
          <span className="text-sm font-semibold">{file ? file.name : 'Choose a video or photo'}</span>
          <span className="text-xs text-muted">{file ? `${kind} · ${bytes(file.size)}` : `Video up to ${bytes(MEDIA_LIMITS.videoMaxBytes)}, photo up to ${bytes(MEDIA_LIMITS.photoMaxBytes)}`}</span>
        </button>
        <input ref={inputRef} type="file" accept={[...MEDIA_LIMITS.videoMimes, ...MEDIA_LIMITS.photoMimes, ...MEDIA_LIMITS.documentMimes].join(',')} className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }} />

        {tooBig && <ErrorNote>{`This ${kind.toLowerCase()} is ${bytes(file!.size)}, over the ${bytes(limit)} limit.`}</ErrorNote>}

        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" help="Shown in the patient's media archive">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session 5 – knee flexion" />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
