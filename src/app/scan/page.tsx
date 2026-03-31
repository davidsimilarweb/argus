'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '../../hooks/useToast';

export default function Scan() {
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [manualEntry, setManualEntry] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('Camera API not available - likely requires HTTPS');
        setHasPermission(false);
        setShowManualEntry(true);
        showToast('Camera requires HTTPS. Use manual entry below.', 'info');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        stream.getTracks().forEach(track => track.stop());

        await new Promise(resolve => setTimeout(resolve, 200));

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const devices = await Html5Qrcode.getCameras();

        if (devices && devices.length > 0) {
          const backCamera = devices.length > 1 ? devices[devices.length - 1] : devices[0];

          await scanner.start(
            backCamera.id,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              console.log('Scanned:', decodedText);

              if (scanner.isScanning) {
                scanner.stop().then(() => {
                  setIsScanning(false);
                  router.push(`/devices?device=${decodedText}`);
                }).catch((err) => {
                  console.error('Error stopping scanner:', err);
                  router.push(`/devices?device=${decodedText}`);
                });
              } else {
                setIsScanning(false);
                router.push(`/devices?device=${decodedText}`);
              }
            },
            (_errorMessage) => {
              // Scan error (no QR code in view) - normal, ignore
            }
          );

          setIsScanning(true);
          setHasPermission(true);
        } else {
          throw new Error('No cameras found');
        }
      } catch (err: any) {
        console.error('Error starting scanner:', err);
        setHasPermission(false);
        setShowManualEntry(true);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          showToast('Camera permission denied. Use manual entry below.', 'error');
        } else if (err.name === 'NotFoundError') {
          showToast('No camera found. Use manual entry below.', 'error');
        } else {
          showToast('Camera unavailable. Use manual entry below.', 'error');
        }
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((err) => {
          console.error('Error stopping scanner on unmount:', err);
        });
      }
    };
  }, []);

  const handleCancel = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        setIsScanning(false);
        router.push('/devices');
      }).catch((err) => {
        console.error('Error stopping scanner:', err);
        router.push('/devices');
      });
    } else {
      router.push('/devices');
    }
  };

  return (
    <>
      <ToastContainer />
      <div className="scan-page" style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--background)',
      }}>
        <div style={{
          padding: '1rem',
          borderBottom: 'var(--border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.0))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0 }}>Scan QR Code</h2>
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          gap: '2rem',
        }}>
          {hasPermission === false && (
            <div style={{
              padding: '2rem',
              background: 'rgba(255,85,99,0.15)',
              border: '1px solid rgba(255,85,99,0.4)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '400px',
              textAlign: 'center',
            }}>
              <h3 style={{ color: '#ff5563', marginBottom: '1rem' }}>Camera Access Denied</h3>
              <p style={{ color: '#888', marginBottom: '1rem' }}>
                Please allow camera access in your browser settings to scan QR codes.
              </p>
              <button className="btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          )}

          {hasPermission === null && (
            <div style={{
              padding: '2rem',
              background: 'rgba(0,229,255,0.15)',
              border: '1px solid rgba(0,229,255,0.4)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '400px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#00e5ff' }}>Requesting camera permission...</p>
            </div>
          )}

          <div style={{
            width: '100%',
            maxWidth: '500px',
            aspectRatio: '1',
            position: 'relative',
          }}>
            <div
              id="qr-reader"
              style={{
                width: '100%',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: isScanning ? '2px solid var(--accent)' : 'var(--border)',
                boxShadow: isScanning ? 'var(--glow-strong)' : 'var(--shadow-md)',
              }}
            />
          </div>

          {isScanning && (
            <div style={{
              padding: '1rem 2rem',
              background: 'rgba(0,255,159,0.1)',
              border: '1px solid rgba(0,255,159,0.3)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              maxWidth: '400px',
            }}>
              <p style={{ color: 'var(--accent)', margin: 0 }}>
                📷 Point your camera at a device QR code
              </p>
            </div>
          )}

          {showManualEntry && (
            <div style={{
              width: '100%',
              maxWidth: '400px',
              padding: '2rem',
              background: 'rgba(0,0,0,0.2)',
              border: 'var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <h3 style={{ color: 'var(--accent)', marginBottom: '1rem', textAlign: 'center' }}>
                Manual Entry
              </h3>
              <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
                Enter or paste the device ID from the QR code
              </p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (manualEntry.trim()) {
                  router.push(`/devices?device=${manualEntry.trim()}`);
                }
              }}>
                <input
                  type="text"
                  value={manualEntry}
                  onChange={(e) => setManualEntry(e.target.value)}
                  placeholder="Device ID (e.g., abc-123-def)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: 'var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text)',
                    fontSize: '1rem',
                    marginBottom: '1rem',
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!manualEntry.trim()}
                  style={{ width: '100%' }}
                >
                  Open Device
                </button>
              </form>
            </div>
          )}

          {!showManualEntry && hasPermission === false && (
            <button
              className="btn-action"
              onClick={() => setShowManualEntry(true)}
              style={{ marginTop: '1rem' }}
            >
              Use Manual Entry Instead
            </button>
          )}
        </div>
      </div>
    </>
  );
}
