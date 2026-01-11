import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import '../styles/components.css'

interface ScannerProps {
    onScan: (decodedText: string) => void
    onError?: (error: any) => void
}

export default function Scanner({ onScan, onError }: ScannerProps) {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
    const [scanError, setScanError] = useState<string | null>(null)
    const [isStarting, setIsStarting] = useState(false)
    const [hasStarted, setHasStarted] = useState(false)

    const startScanner = async () => {
        if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode("reader", {
                verbose: false,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                ]
            })
        }

        // ... rest of the code is fine ...
        if (html5QrCodeRef.current.isScanning) {
            setHasStarted(true)
            setScanError(null)
            return
        }

        setIsStarting(true)
        setScanError(null)

        try {
            // First attempt: environment camera
            try {
                await html5QrCodeRef.current.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                    },
                    (decodedText) => {
                        onScan(decodedText)
                    },
                    () => { } // Ignore per-frame errors
                )
            } catch (envErr) {
                console.warn("Environment camera failed, falling back to default camera", envErr)
                // Fallback attempt: any available camera
                await html5QrCodeRef.current.start(
                    {}, // Default camera
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                    },
                    (decodedText) => {
                        onScan(decodedText)
                    },
                    () => { } // Ignore per-frame errors
                )
            }
            setHasStarted(true)
            setScanError(null)
        } catch (err: any) {
            const errMsg = err?.toString() || ""
            // Ignore "already scanning" errors - happens in React StrictMode
            if (errMsg.includes("already scanning") || errMsg.includes("is scanning")) {
                setHasStarted(true)
                setScanError(null)
            } else {
                console.error("Scanner error:", err)
                setScanError(err.message || "Failed to access camera")
                if (onError) onError(err)
            }
        } finally {
            setIsStarting(false)
        }
    }

    const stopScanner = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try {
                await html5QrCodeRef.current.stop()
                setHasStarted(false)
            } catch (err) {
                console.error("Error stopping scanner", err)
            }
        }
    }

    useEffect(() => {
        // Attempt auto-start on mount
        startScanner()
        return () => {
            stopScanner()
        }
    }, [])

    return (
        <div className="scanner-container" style={{
            position: 'relative',
            minHeight: '300px',
            background: '#111',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div id="reader" style={{ width: '100%', height: '100%' }}></div>

            {!hasStarted && !isStarting && !scanError && (
                <button className="btn" onClick={startScanner}>
                    Enable Camera
                </button>
            )}

            {isStarting && <div style={{ color: 'white' }}>Initializing...</div>}

            {scanError && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
                    <p style={{ color: 'var(--color-error)', marginBottom: '10px' }}>{scanError}</p>
                    <button className="btn btn-secondary" onClick={startScanner}>
                        Try Again
                    </button>
                    <p style={{ fontSize: '10px', marginTop: '10px', color: '#666' }}>
                        Ensure you are using HTTPS and have granted camera permissions in browser settings.
                    </p>
                </div>
            )}
        </div>
    )
}
