'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Upload, VideoOff } from 'lucide-react';
import { Button, ErrorNote, Field, Modal, Select } from '@/components/ui';

/** Remembers the chosen camera per browser, so the desk picks the external webcam once. */
const CAMERA_KEY = 'acuheal.camera';
/** Profile photos are stored on the patient record, so keep them small but recognisable. */
const MAX_EDGE = 640;
const JPEG_QUALITY = 0.85;

function readStoredCamera(): string {
  try {
    return window.localStorage.getItem(CAMERA_KEY) ?? '';
  } catch {
    return '';
  }
}
function storeCamera(id: string): void {
  try {
    if (id) window.localStorage.setItem(CAMERA_KEY, id);
    else window.localStorage.removeItem(CAMERA_KEY);
  } catch {
    /* private browsing */
  }
}

/** Downscales any data URL or image file to a sensible profile-photo size. */
async function downscale(src: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not read that image'));
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function describeError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow the camera for this site in your browser settings, then choose Retry.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found. Plug in the webcam, then choose Refresh.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is being used by another program. Close Zoom, Teams or any other app using it, then choose Retry.';
    case 'OverconstrainedError':
      return 'That camera is no longer available. It may have been unplugged. Choose another camera below.';
    default:
      return 'The camera could not be started. Check it is connected, then choose Retry.';
  }
}

export interface PhotoCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  title?: string;
}

export function PhotoCapture({ open, onClose, onCapture, title = 'Capture photo' }: PhotoCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');

  /**
   * Browsers hide camera names until permission has been granted at least once,
   * so ask for the stream first, then list the devices with real labels.
   */
  const loadCameras = useCallback(async (requestPermission: boolean) => {
    setError('');
    try {
      if (requestPermission) {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true });
        probe.getTracks().forEach((t) => t.stop());
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      const videos = all.filter((d) => d.kind === 'videoinput');
      setCameras(videos);

      if (!videos.length) {
        setError('No camera was found. Plug in the webcam, then choose Refresh.');
        return;
      }
      // Keep the current pick if it is still plugged in, else fall back to the remembered
      // one, else the first camera the machine reports.
      setDeviceId((current) => {
        if (current && videos.some((v) => v.deviceId === current)) return current;
        const remembered = readStoredCamera();
        if (remembered && videos.some((v) => v.deviceId === remembered)) return remembered;
        return videos[0]?.deviceId ?? '';
      });
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setReady(false);
      setPreview('');
      return;
    }
    void loadCameras(true);
  }, [open, loadCameras]);

  // Pick up webcams plugged in or removed while the dialog is open.
  useEffect(() => {
    if (!open || !navigator.mediaDevices?.addEventListener) return;
    const onChange = () => void loadCameras(false);
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, [open, loadCameras]);

  const chooseCamera = (id: string) => {
    setDeviceId(id);
    storeCamera(id);
    setReady(false);
    setError('');
  };

  const takeShot = async () => {
    const shot = webcamRef.current?.getScreenshot();
    if (!shot) {
      setError('Nothing was captured. Give the camera a moment to start, then try again.');
      return;
    }
    setBusy(true);
    try {
      setPreview(await downscale(shot));
    } catch {
      setPreview(shot);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image. Choose a JPG or PNG.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file'));
        reader.readAsDataURL(file);
      });
      setPreview(await downscale(raw));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setBusy(false);
    }
  };

  const use = () => {
    if (!preview) return;
    onCapture(preview);
    onClose();
  };

  const label = (cam: MediaDeviceInfo, i: number) => cam.label || `Camera ${i + 1}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {preview ? (
            <>
              <Button variant="ghost" onClick={() => setPreview('')}>
                Retake
              </Button>
              <Button onClick={use}>Use this photo</Button>
            </>
          ) : (
            <Button icon={<Camera className="size-4" />} disabled={!ready || busy} loading={busy} onClick={() => void takeShot()}>
              Capture
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captured photo" className="w-full rounded-lg border border-line" />
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-line bg-black">
            {deviceId ? (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.92}
                // `exact` makes the browser fail loudly if the chosen webcam was unplugged,
                // instead of silently falling back to the built-in one.
                videoConstraints={{ deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }}
                onUserMedia={() => {
                  setReady(true);
                  setError('');
                }}
                onUserMediaError={(err) => {
                  setReady(false);
                  setError(describeError(err));
                }}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-white/70">
                <VideoOff className="size-7" />
                <span className="text-sm">No camera selected</span>
              </div>
            )}
          </div>
        )}

        {!preview && (
          <>
            <Field label="Camera" help={cameras.length > 1 ? 'Your choice is remembered on this computer.' : undefined}>
              <div className="flex gap-2">
                <Select value={deviceId} onChange={(e) => chooseCamera(e.target.value)} disabled={!cameras.length}>
                  {!cameras.length && <option value="">No camera found</option>}
                  {cameras.map((cam, i) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {label(cam, i)}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => void loadCameras(true)} title="Look for cameras again">
                  Refresh
                </Button>
              </div>
            </Field>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-muted">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button type="button" variant="secondary" className="w-full" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
              Upload a photo instead
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />

            <p className="text-xs text-muted">
              Plugged the webcam in just now? Choose Refresh. If the browser asks for camera permission, allow it.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
