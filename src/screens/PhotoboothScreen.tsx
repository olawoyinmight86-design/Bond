import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Download, FlipHorizontal, X, RotateCcw, Users, Send, Sparkles as SparklesIcon, Layers, Heart } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { composeMessage } from '../lib/syncEngine';
import { supabase } from '../lib/supabase';

type Photo = { id: string; dataUrl: string; timestamp: string; pose: string };

type PoseGuide = { id: string; label: string; icon: string; svg: JSX.Element };

type FilterDef = { id: string; label: string; css: string };

type PlacedSticker = { id: string; emoji: string; x: number; y: number };

type DuoLayout = 'side_by_side' | 'top_bottom' | 'film_strip' | 'heart_split';

const DUO_LAYOUTS: { id: DuoLayout; label: string }[] = [
  { id: 'side_by_side', label: 'Side by Side' },
  { id: 'top_bottom', label: 'Top / Bottom' },
  { id: 'film_strip', label: 'Film Strip' },
  { id: 'heart_split', label: 'Heart Split' },
];

const GALLERY_KEY = 'bond_photobooth_gallery';

const FILTERS: FilterDef[] = [
  { id: 'none', label: 'Clean', css: 'none' },
  { id: 'soft_love', label: 'Soft Love', css: 'saturate(1.15) brightness(1.08) contrast(0.95) sepia(0.08)' },
  { id: 'golden_hour', label: 'Golden Hour', css: 'saturate(1.3) sepia(0.25) brightness(1.05) hue-rotate(-6deg)' },
  { id: 'vintage', label: 'Vintage Date', css: 'sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.85)' },
  { id: 'bw', label: 'Black & White', css: 'grayscale(1) contrast(1.1)' },
  { id: 'dreamy', label: 'Dreamy', css: 'brightness(1.12) contrast(0.9) saturate(1.1) blur(0.3px)' },
  { id: 'moody', label: 'Moody', css: 'contrast(1.2) brightness(0.85) saturate(0.8)' },
  { id: 'cozy_winter', label: 'Cozy Winter', css: 'saturate(0.9) brightness(1.02) hue-rotate(6deg) contrast(1.05)' },
];

const STICKER_OPTIONS = ['❤️', '💕', '😘', '✨', '🥰', '💍', '🌸', '😂'];

function loadGallery(): Photo[] {
  try {
    return JSON.parse(localStorage.getItem(GALLERY_KEY) ?? '[]') as Photo[];
  } catch { return []; }
}

function saveGallery(photos: Photo[]) {
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify(photos.slice(0, 40))); } catch { /* noop */ }
}

const POSES: PoseGuide[] = [
  {
    id: 'cheek',
    label: 'Cheek to Cheek',
    icon: '🥰',
    svg: (
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="70" cy="80" r="28" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <circle cx="130" cy="80" r="28" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <ellipse cx="70" cy="145" rx="38" ry="30" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <ellipse cx="130" cy="145" rx="38" ry="30" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <path d="M 82 78 Q 100 65 118 78" stroke="white" strokeWidth="1.5" opacity="0.5" fill="none" />
      </svg>
    ),
  },
  {
    id: 'hug',
    label: 'Bear Hug',
    icon: '🤗',
    svg: (
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="80" cy="70" r="28" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <circle cx="120" cy="70" r="28" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <rect x="40" y="110" width="120" height="70" rx="40" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <path d="M 40 135 Q 100 100 160 135" stroke="white" strokeWidth="1.5" opacity="0.5" fill="none" />
      </svg>
    ),
  },
  {
    id: 'forehead',
    label: 'Forehead Kiss',
    icon: '😘',
    svg: (
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="100" cy="110" r="30" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <circle cx="100" cy="62" r="18" stroke="white" strokeWidth="2" strokeDasharray="4 3" opacity="0.6" />
        <path d="M 80 95 Q 100 115 120 95" stroke="white" strokeWidth="1.5" opacity="0.4" fill="none" />
        <circle cx="100" cy="52" r="4" fill="white" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: 'back',
    label: 'Back-to-Back',
    icon: '💪',
    svg: (
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="65" cy="72" r="26" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <circle cx="135" cy="72" r="26" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <rect x="38" y="108" width="52" height="72" rx="20" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <rect x="110" y="108" width="52" height="72" rx="20" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <line x1="100" y1="60" x2="100" y2="180" stroke="white" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.35" />
      </svg>
    ),
  },
  {
    id: 'laugh',
    label: 'Big Laugh',
    icon: '😂',
    svg: (
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="65" cy="85" r="28" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <circle cx="135" cy="85" r="28" stroke="white" strokeWidth="2" strokeDasharray="6 4" opacity="0.7" />
        <path d="M 50 108 Q 65 125 80 108" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M 120 108 Q 135 125 150 108" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M 80 168 Q 100 148 120 168" stroke="white" strokeWidth="2" strokeDasharray="5 3" opacity="0.5" fill="none" />
      </svg>
    ),
  },
];

export default function PhotoboothScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);
  const [poseIndex, setPoseIndex] = useState(0);
  const [showPoseOverlay, setShowPoseOverlay] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [gallery, setGallery] = useState<Photo[]>(loadGallery);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterDef>(FILTERS[0]);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [showStickerTray, setShowStickerTray] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const [duoOpen, setDuoOpen] = useState(false);
  const [duoLayout, setDuoLayout] = useState<DuoLayout>('side_by_side');
  const [duoRow, setDuoRow] = useState<{ photo_a_path: string | null; photo_b_path: string | null; layout: DuoLayout; user_a: string } | null>(null);
  const [duoCombined, setDuoCombined] = useState<string | null>(null);
  const [duoBusy, setDuoBusy] = useState(false);
  const duoCanvasRef = useRef<HTMLCanvasElement>(null);

  const partnerId = profile?.paired_with ?? '';

  const loadDuoRow = useCallback(async () => {
    if (!profile?.id || !partnerId) return;
    const sorted = [profile.id, partnerId].sort();
    const { data } = await supabase.from('duo_photos').select('photo_a_path, photo_b_path, layout, user_a').eq('user_a', sorted[0]).eq('user_b', sorted[1]).maybeSingle();
    setDuoRow(data as typeof duoRow);
  }, [profile?.id, partnerId]);

  useEffect(() => { loadDuoRow(); }, [loadDuoRow]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel('duo-photos').on('postgres_changes', { event: '*', schema: 'public', table: 'duo_photos' }, loadDuoRow).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, loadDuoRow]);

  const captureFrameBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = duoCanvasRef.current;
      if (!video || !canvas) { resolve(null); return; }
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.filter = activeFilter.css;
      if (mirrored) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (mirrored) ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  };

  const startDuo = async (layout: DuoLayout) => {
    if (!profile?.id) return;
    setDuoBusy(true);
    try {
      await supabase.rpc('start_duo_photo', { p_layout: layout });
      await submitMyDuoShot();
    } finally {
      setDuoBusy(false);
    }
  };

  const submitMyDuoShot = async () => {
    if (!profile?.id || !cameraReady) return;
    setDuoBusy(true);
    try {
      const blob = await captureFrameBlob();
      if (!blob) return;
      const path = `${profile.id}/duo-${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('chat-media').upload(path, blob, { contentType: 'image/jpeg' });
      if (uploadErr) return;
      await supabase.rpc('submit_duo_photo', { p_path: path });
      await loadDuoRow();
    } finally {
      setDuoBusy(false);
    }
  };

  const mySide = duoRow && profile?.id === duoRow.user_a ? 'a' : 'b';
  const myPathSubmitted = duoRow ? (mySide === 'a' ? !!duoRow.photo_a_path : !!duoRow.photo_b_path) : false;
  const bothReady = !!duoRow?.photo_a_path && !!duoRow?.photo_b_path;

  useEffect(() => {
    if (!bothReady || !duoRow) return;
    (async () => {
      setDuoBusy(true);
      try {
        const [urlA, urlB] = await Promise.all([
          supabase.storage.from('chat-media').createSignedUrl(duoRow.photo_a_path!, 300),
          supabase.storage.from('chat-media').createSignedUrl(duoRow.photo_b_path!, 300),
        ]);
        if (!urlA.data?.signedUrl || !urlB.data?.signedUrl) return;

        const [imgA, imgB] = await Promise.all([loadImage(urlA.data.signedUrl), loadImage(urlB.data.signedUrl)]);
        const combined = mergeImages(imgA, imgB, duoRow.layout);
        setDuoCombined(combined);
      } finally {
        setDuoBusy(false);
      }
    })();
  }, [bothReady, duoRow]);

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const mergeImages = (imgA: HTMLImageElement, imgB: HTMLImageElement, layout: DuoLayout): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const SIZE = 1200;

    if (layout === 'side_by_side') {
      canvas.width = SIZE; canvas.height = SIZE * 0.75;
      const w = canvas.width / 2, h = canvas.height;
      drawCover(ctx, imgA, 0, 0, w, h);
      drawCover(ctx, imgB, w, 0, w, h);
      ctx.fillStyle = 'white'; ctx.fillRect(w - 2, 0, 4, h);
    } else if (layout === 'top_bottom') {
      canvas.width = SIZE * 0.75; canvas.height = SIZE;
      const w = canvas.width, h = canvas.height / 2;
      drawCover(ctx, imgA, 0, 0, w, h);
      drawCover(ctx, imgB, 0, h, w, h);
      ctx.fillStyle = 'white'; ctx.fillRect(0, h - 2, w, 4);
    } else if (layout === 'film_strip') {
      canvas.width = SIZE * 0.55; canvas.height = SIZE * 1.15;
      ctx.fillStyle = '#faf8f5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const pad = canvas.width * 0.06, frameW = canvas.width - pad * 2, frameH = frameW * 0.85;
      drawCover(ctx, imgA, pad, pad, frameW, frameH);
      drawCover(ctx, imgB, pad, pad * 2 + frameH, frameW, frameH);
      ctx.fillStyle = '#8b8680'; ctx.font = `italic ${Math.round(canvas.width * 0.045)}px Georgia, serif`;
      ctx.textAlign = 'center'; ctx.fillText('Bond ♡', canvas.width / 2, pad * 2.5 + frameH * 2 + pad * 0.4);
    } else {
      canvas.width = SIZE; canvas.height = SIZE * 0.75;
      ctx.fillStyle = '#fff1f2'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const r = canvas.height * 0.42;
      drawHeartClip(ctx, imgA, canvas.width * 0.36, canvas.height * 0.5, r);
      drawHeartClip(ctx, imgB, canvas.width * 0.64, canvas.height * 0.5, r);
    }

    return canvas.toDataURL('image/jpeg', 0.92);
  };

  const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale, sh = h / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  };

  const drawHeartClip = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx - r * 0.5, cy - r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.5, cy - r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.moveTo(cx - r, cy - r * 0.1);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx + r, cy - r * 0.1);
    ctx.closePath();
    ctx.clip('evenodd');
    drawCover(ctx, img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  };

  const finishDuo = async (action: 'save' | 'send') => {
    if (!duoCombined || !profile?.id) return;
    if (action === 'save') {
      const photo: Photo = { id: crypto.randomUUID(), dataUrl: duoCombined, timestamp: new Date().toISOString(), pose: 'Duo Photo' };
      setGallery((prev) => { const updated = [photo, ...prev]; saveGallery(updated); return updated; });
    } else if (partnerId) {
      const res = await fetch(duoCombined);
      const blob = await res.blob();
      await composeMessage({ senderId: profile.id, recipientId: partnerId, type: 'photo', mediaBlob: blob, mediaMime: 'image/jpeg' });
    }
    await supabase.rpc('reset_duo_photo');
    setDuoCombined(null);
    setDuoOpen(false);
  };

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera unavailable';
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Unable to start camera. ' + msg);
      }
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [startCamera]);

  const takePhoto = useCallback(() => {
    if (!cameraReady || countdown !== null) return;
    let count = 3;
    setCountdown(count);
    const tick = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(tick);
        setCountdown(0);
        setTimeout(() => {
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
          capture();
          setCountdown(null);
        }, 400);
      }
    }, 1000);
  }, [cameraReady, countdown]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = activeFilter.css;
    if (mirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (mirrored) ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';

    // Bake in stickers at their placed positions
    for (const s of stickers) {
      const size = Math.round(canvas.width * 0.09);
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.emoji, s.x * canvas.width, s.y * canvas.height);
    }

    // Watermark
    ctx.font = `bold ${Math.round(canvas.width * 0.025)}px Georgia, serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText('Bond ♡', canvas.width - 20, canvas.height - 18);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const photo: Photo = {
      id: crypto.randomUUID(),
      dataUrl,
      timestamp: new Date().toISOString(),
      pose: POSES[poseIndex].label,
    };
    setGallery(prev => {
      const updated = [photo, ...prev];
      saveGallery(updated);
      return updated;
    });
    setPreviewPhoto(photo);
    setStickers([]);
    setSent(false);
  }, [mirrored, poseIndex, activeFilter, stickers]);

  const addSticker = (emoji: string) => {
    setStickers((prev) => [...prev, { id: crypto.randomUUID(), emoji, x: 0.5, y: 0.4 + prev.length * 0.08 }]);
    setShowStickerTray(false);
  };

  const moveSticker = (id: string, clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(0.95, Math.max(0.05, (clientX - rect.left) / rect.width));
    const y = Math.min(0.95, Math.max(0.05, (clientY - rect.top) / rect.height));
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)));
  };

  const sendToPartner = async (photo: Photo) => {
    if (!profile?.id || !profile.paired_with) return;
    setSending(true);
    try {
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      await composeMessage({ senderId: profile.id, recipientId: profile.paired_with, type: 'photo', mediaBlob: blob, mediaMime: 'image/jpeg' });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const downloadPhoto = (photo: Photo) => {
    const a = document.createElement('a');
    a.href = photo.dataUrl;
    a.download = `bond-${photo.id.slice(0, 8)}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deletePhoto = (id: string) => {
    setGallery(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveGallery(updated);
      return updated;
    });
    if (previewPhoto?.id === id) setPreviewPhoto(null);
  };

  const pose = POSES[poseIndex];

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-display-sm text-ink-900">Photobooth</h1>
        <span className="text-xl">{pose.icon}</span>
      </div>

      {/* Camera viewport */}
      <div ref={stageRef} className="relative overflow-hidden rounded-3xl bg-ink-900 shadow-float" style={{ aspectRatio: '4/3' }}>
        {/* Flash overlay */}
        {flash && <div className="absolute inset-0 z-20 bg-white animate-pulse-soft pointer-events-none" style={{ opacity: 0.95 }} />}

        {/* Countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span
              key={countdown}
              className="font-display text-white drop-shadow-lg animate-scale-in"
              style={{ fontSize: '6rem', lineHeight: 1 }}
            >
              {countdown}
            </span>
          </div>
        )}
        {countdown === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="font-display text-white drop-shadow-lg animate-scale-in" style={{ fontSize: '3.5rem' }}>📸</span>
          </div>
        )}

        {/* Video */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: mirrored ? 'scaleX(-1)' : 'none', filter: activeFilter.css }}
        />

        {/* Placed stickers — draggable */}
        {stickers.map((s) => (
          <div
            key={s.id}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const move = (ev: PointerEvent) => moveSticker(s.id, ev.clientX, ev.clientY);
              const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
            className="absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none items-center justify-center text-3xl active:cursor-grabbing"
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
          >
            {s.emoji}
          </div>
        ))}

        {/* Pose overlay */}
        {showPoseOverlay && cameraReady && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            {pose.svg}
          </div>
        )}

        {/* Camera error state */}
        {cameraError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-ink-900/95 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error-50 text-3xl">📷</div>
            <p className="text-sm text-ink-300">{cameraError}</p>
            <button onClick={startCamera} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
              <RotateCcw size={15} /> Try Again
            </button>
          </div>
        )}

        {/* Loading state */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <p className="text-sm text-white/60">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Top controls */}
        {cameraReady && (
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {partnerId && (
              <button
                onClick={() => setDuoOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900/50 text-white backdrop-blur-sm transition-all hover:bg-ink-900/70 active:scale-95"
              >
                <Layers size={16} />
              </button>
            )}
            <button
              onClick={() => setShowStickerTray((s) => !s)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur-sm transition-all hover:bg-ink-900/70 active:scale-95 ${showStickerTray ? 'bg-brand-500/80 text-white' : 'bg-ink-900/50 text-white/60'}`}
            >
              <SparklesIcon size={16} />
            </button>
            <button
              onClick={() => setMirrored(m => !m)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900/50 text-white backdrop-blur-sm transition-all hover:bg-ink-900/70 active:scale-95"
            >
              <FlipHorizontal size={17} />
            </button>
            <button
              onClick={() => setShowPoseOverlay(s => !s)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur-sm transition-all hover:bg-ink-900/70 active:scale-95 ${showPoseOverlay ? 'bg-brand-500/80 text-white' : 'bg-ink-900/50 text-white/60'}`}
            >
              <Users size={17} />
            </button>
          </div>
        )}

        {/* Sticker tray */}
        {showStickerTray && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-2xl bg-ink-900/70 px-3 py-2 backdrop-blur-sm animate-scale-in">
            {STICKER_OPTIONS.map((emoji) => (
              <button key={emoji} onClick={() => addSticker(emoji)} className="text-xl transition-transform active:scale-125">{emoji}</button>
            ))}
          </div>
        )}
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={duoCanvasRef} className="hidden" />

      {/* Filter selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-200 ${activeFilter.id === f.id ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 shadow-soft'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pose selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {POSES.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setPoseIndex(i)}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl px-4 py-2.5 text-center transition-all duration-200 ${poseIndex === i ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-white shadow-soft hover:shadow-lift'}`}
          >
            <span className="text-xl">{p.icon}</span>
            <span className="text-[10px] font-medium text-ink-500 whitespace-nowrap">{p.label}</span>
          </button>
        ))}
      </div>

      {/* Shutter */}
      <div className="flex items-center justify-center">
        <button
          onClick={takePhoto}
          disabled={!cameraReady || countdown !== null}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-float transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          <div className="h-14 w-14 rounded-full bg-brand-500 shadow-glow-brand flex items-center justify-center">
            <Camera size={24} className="text-white" />
          </div>
        </button>
      </div>

      {/* Gallery */}
      {gallery.length > 0 && (
        <section>
          <p className="mb-3 text-[13px] font-medium text-ink-400 uppercase tracking-wider">Gallery · {gallery.length}</p>
          <div className="grid grid-cols-3 gap-2">
            {gallery.map(photo => (
              <button
                key={photo.id}
                onClick={() => setPreviewPhoto(photo)}
                className="relative aspect-square overflow-hidden rounded-2xl shadow-soft transition-all hover:scale-105 hover:shadow-lift"
              >
                <img src={photo.dataUrl} alt={photo.pose} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Duo Photo modal */}
      {duoOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-md animate-fade-in" onClick={() => !duoBusy && setDuoOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 animate-scale-in">
            <div className="max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-5 shadow-float">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg text-ink-900">Duo Photo</h2>
                <button onClick={() => setDuoOpen(false)} className="text-ink-300"><X size={20} /></button>
              </div>

              {duoCombined ? (
                <div className="space-y-4">
                  <img src={duoCombined} alt="Duo photo" className="w-full rounded-2xl shadow-soft" />
                  <div className="flex gap-2">
                    <button onClick={() => finishDuo('save')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink-100 py-3 text-sm font-medium text-ink-700">
                      <Download size={16} /> Save
                    </button>
                    <button onClick={() => finishDuo('send')} className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-3">
                      <Send size={16} /> Send to chat
                    </button>
                  </div>
                </div>
              ) : bothReady || duoBusy ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <div className="h-10 w-10 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
                  <p className="text-sm text-ink-400">Merging your photos...</p>
                </div>
              ) : duoRow && !myPathSubmitted ? (
                <div className="space-y-4 text-center">
                  <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-brand-50 text-2xl">📸</div>
                  <p className="text-sm text-ink-600">Your partner started a duo photo! Strike your pose and capture yours.</p>
                  <button onClick={submitMyDuoShot} disabled={duoBusy} className="btn-primary w-full py-3">
                    {duoBusy ? 'Capturing...' : 'Take my photo'}
                  </button>
                </div>
              ) : duoRow && myPathSubmitted ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="h-10 w-10 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" />
                  <p className="text-sm text-ink-500">Waiting for your partner to capture theirs...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-ink-500">Pick a layout — you capture your side now, your partner captures theirs whenever they open Photobooth next.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DUO_LAYOUTS.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setDuoLayout(l.id)}
                        className={`rounded-xl px-3 py-3 text-xs font-medium transition-all ${duoLayout === l.id ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-600'}`}
                      >
                        {l.id === 'heart_split' && <Heart size={14} className="mx-auto mb-1" />}
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => startDuo(duoLayout)} disabled={duoBusy} className="btn-primary w-full py-3">
                    {duoBusy ? 'Capturing...' : 'Take my photo & invite partner'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Photo preview modal */}
      {previewPhoto && (
        <>
          <div className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-md animate-fade-in" onClick={() => setPreviewPhoto(null)} />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 animate-scale-in">
            <div className="overflow-hidden rounded-3xl bg-ink-900 shadow-float">
              <img src={previewPhoto.dataUrl} alt={previewPhoto.pose} className="w-full object-cover" />
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-white">{previewPhoto.pose}</p>
                  <p className="text-xs text-ink-400">
                    {new Date(previewPhoto.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deletePhoto(previewPhoto.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-error-500/20 text-error-400 transition-all hover:bg-error-500/30"
                  >
                    <X size={18} />
                  </button>
                  {profile?.paired_with && (
                    <button
                      onClick={() => sendToPartner(previewPhoto)}
                      disabled={sending || sent}
                      className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-60"
                    >
                      <Send size={16} /> {sent ? 'Sent!' : sending ? 'Sending...' : 'Send to partner'}
                    </button>
                  )}
                  <button
                    onClick={() => downloadPhoto(previewPhoto)}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-brand-600 active:scale-95"
                  >
                    <Download size={16} /> Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
