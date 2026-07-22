import { useRef, useState } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';

type Props = {
  onSend: (blob: Blob, mime: string, durationMs: number) => void;
  onCancel: () => void;
};

export default function VoiceRecorder({ onSend, onCancel }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef('audio/webm');

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mimeRef.current });
        setBlob(finalBlob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startRef.current = Date.now();
      setRecording(true);
      timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startRef.current), 100);
    } catch {
      setError('Microphone unavailable — check permissions.');
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancel = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  };

  const seconds = (elapsedMs / 1000).toFixed(1);

  if (error) {
    return (
      <div className="rounded-2xl bg-surface p-4 text-center shadow-lift">
        <p className="text-sm text-error-600">{error}</p>
        <button onClick={onCancel} className="mt-2 text-xs text-ink-400">Close</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-lift">
      {!recording && !blob && (
        <>
          <button onClick={start} className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white active:scale-90 transition-transform">
            <Mic size={20} />
          </button>
          <span className="text-sm text-ink-400">Hold to record a voice note — works offline</span>
          <button onClick={cancel} className="ml-auto text-ink-300"><X size={18} /></button>
        </>
      )}
      {recording && (
        <>
          <div className="h-3 w-3 animate-pulse rounded-full bg-error-500" />
          <span className="font-mono text-sm text-ink-700">{seconds}s</span>
          <button onClick={stop} className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-500 text-white active:scale-90 transition-transform">
            <Square size={18} />
          </button>
        </>
      )}
      {blob && !recording && (
        <>
          <audio controls src={URL.createObjectURL(blob)} className="h-10 flex-1" />
          <button
            onClick={() => onSend(blob, mimeRef.current, elapsedMs)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white active:scale-90 transition-transform"
          >
            <Send size={16} />
          </button>
          <button onClick={cancel} className="text-ink-300"><X size={18} /></button>
        </>
      )}
    </div>
  );
}
