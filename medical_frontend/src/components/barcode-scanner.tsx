'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Modal } from '@/components/ui';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];

/**
 * Camera-based barcode/QR scan (TASKS.md #29) using the browser's native
 * BarcodeDetector — no extra dependency. Not every browser supports it
 * (notably Firefox/Safari as of writing), so the button simply doesn't
 * render there; manual search remains the primary path everywhere.
 */
export function BarcodeScanButton({ onDetect }: { onDetect: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let frame: number | null = null;
    let stream: MediaStream | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new window.BarcodeDetector!({ formats: FORMATS });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetect(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            // A frame that fails to decode is normal mid-scan — keep going.
          }
          frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch {
        toast.error('Could not access the camera — check permissions, or search manually.');
        setOpen(false);
      }
    }
    void start();

    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onDetect]);

  if (!supported) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        icon={<ScanLine className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Scan
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Scan barcode or QR code" size="sm">
        <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />
        <p className="mt-3 text-xs text-ink-500">Point the camera at the product&apos;s barcode or QR code.</p>
      </Modal>
    </>
  );
}
