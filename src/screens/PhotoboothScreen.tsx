import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Download, FlipHorizontal, X, RotateCcw, Users } from 'lucide-react';

type Photo = { id: string; dataUrl: string; timestamp: string; pose: string };

type PoseGuide = { id: string; label: string; icon: string; svg: JSX.Element };

const GALLERY_KEY = 'bond_photobooth_gallery';

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

    if (mirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (mirrored) ctx.setTransform(1, 0, 0, 1, 0, 0);

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
  }, [mirrored, poseIndex]);

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
      <div className="relative overflow-hidden rounded-3xl bg-ink-900 shadow-float" style={{ aspectRatio: '4/3' }}>
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
          style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
        />

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
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

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
