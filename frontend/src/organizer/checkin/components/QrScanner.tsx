import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { CameraswitchOutlined, QrCodeScannerOutlined, StopCircleOutlined } from '@mui/icons-material';

interface QrScannerProps {
  onScan: (rawValue: string) => void;
  disabled?: boolean;
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue?: string }[]>;
}

function getDetector(): NativeBarcodeDetector | null {
  const Ctor = (window as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => NativeBarcodeDetector;
  }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

// Real in-browser QR scanner using the native BarcodeDetector API
// (Chrome/Edge/Android) + device camera. No extra libraries.
// Unsupported browsers get a clear fallback message instead of a fake UI.
export default function QrScanner({ onScan, disabled }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const [supported] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      getDetector() !== null,
  );

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  };

  useEffect(() => stop, []);

  const start = async () => {
    setError('');
    if (!supported) {
      setError('Camera scanning isn\u2019t supported on this device or browser. Use manual entry below instead.');
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      setActive(true);
      const detector = getDetector();
      if (!detector) {
        setError('Camera scanning isn\u2019t supported on this device or browser. Use manual entry below instead.');
        stop();
        setStarting(false);
        return;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const tick = async () => {
        try {
          if (video.readyState >= 2 && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const codes = await detector.detect(canvas);
            const raw = codes?.[0]?.rawValue;
            if (typeof raw === 'string' && raw.trim()) {
              const value = raw.trim();
              stop();
              onScanRef.current(value);
              return;
            }
          }
        } catch {
          // transient frame errors are ignored; loop continues
        }
        rafRef.current = requestAnimationFrame(() => { void tick(); });
      };
      rafRef.current = requestAnimationFrame(() => { void tick(); });
    } catch {
      setError('Could not access the camera. Check permissions, or use manual entry below.');
      stop();
    } finally {
      setStarting(false);
    }
  };

  return (
    <Box>
      {!active ? (
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 360,
              mx: 'auto',
              aspectRatio: '4 / 3',
              borderRadius: 3,
              border: '2px dashed',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              px: 3,
            }}
          >
            <QrCodeScannerOutlined sx={{ fontSize: 44, color: 'text.disabled' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Scan Participant QR</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
              Point the camera at the QR code on the participant&apos;s ticket.
            </Typography>
          </Box>
          {error && <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>{error}</Alert>}
          <Button
            variant="contained"
            startIcon={starting ? <CircularProgress size={16} color="inherit" /> : <CameraswitchOutlined />}
            onClick={start}
            disabled={disabled || starting}
            sx={{ mt: 2, borderRadius: 999, boxShadow: 'none' }}
          >
            {starting ? 'Starting camera…' : 'Start Camera'}
          </Button>
          {!supported && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontSize: 12.5 }}>
              This browser can&apos;t scan QR codes with the camera — manual entry below always works.
            </Typography>
          )}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 420,
              mx: 'auto',
              borderRadius: 3,
              overflow: 'hidden',
              border: '2px solid',
              borderColor: 'primary.main',
              bgcolor: '#000',
              position: 'relative',
            }}
          >
            <Box component="video" ref={videoRef} muted playsInline
              sx={{ width: '100%', display: 'block', aspectRatio: '4 / 3', objectFit: 'cover' }} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <Box sx={{ width: '62%', aspectRatio: '1', border: '2px solid rgba(255,255,255,0.85)', borderRadius: 2 }} />
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Hold the ticket QR inside the frame — it checks in automatically.
          </Typography>
          <Button variant="outlined" color="error" startIcon={<StopCircleOutlined />} onClick={stop} sx={{ mt: 1.5, borderRadius: 999 }}>
            Stop Camera
          </Button>
        </Box>
      )}
    </Box>
  );
}
