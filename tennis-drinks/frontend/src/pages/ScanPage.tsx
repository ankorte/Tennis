import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5QrcodeScanner } from 'html5-qrcode'

export default function ScanPage() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [scanned, setScanned] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (scanned) return
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    )
    scannerRef.current = scanner
    scanner.render(
      (text) => {
        setScanned(true)
        scanner.clear().catch(() => {})
        try {
          const url = new URL(text)
          const item = url.searchParams.get('item')
          if (item) {
            navigate(`/book?item=${item}`)
          } else {
            navigate(`/book`)
          }
        } catch {
          navigate(`/book`)
        }
      },
      () => {}
    )
    return () => { scanner.clear().catch(() => {}) }
  }, [])

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-tennis-dark mb-4">📷 QR-Code scannen</h1>
      <div className="card">
        <p className="text-gray-600 text-sm mb-4 text-center">Kamera auf den QR-Code des Getränks richten</p>
        <div id="qr-reader" className="overflow-hidden rounded-xl"></div>
      </div>
      <button onClick={() => navigate('/book')} className="btn-secondary mt-4">
        Ohne Scan fortfahren
      </button>
    </div>
  )
}
