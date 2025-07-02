import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/firebase.config';

const CameraScanner = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [error, setError] = useState('');

  // Open camera and attach stream
  useEffect(() => {
    let isMounted = true;

    (async () => {
      setError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (!isMounted) return;

        setMediaStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities?.() || {};
        const settings = track.getSettings?.() || {};
        if (capabilities.zoom) {
          setMaxZoom(capabilities.zoom.max || 1);
          setZoom(settings.zoom || 1);
        }
      } catch (err) {
        setError('Unable to access camera');
      }
    })();

    return () => {
      isMounted = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
      }
    };
  }, []);

  // Barcode/QR scanning logic
  useEffect(() => {
    if (!mediaStream || !videoRef.current) return;

    let active = true;
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    codeReader.decodeFromVideoDevice(null, videoRef.current, async (result, err) => {
      if (!active) return;

      if (result) {
        const rawText = result.getText().trim();
        console.log('Scanned QR text:', rawText);

        // Fix regex to properly capture Firestore doc ID (anything after /qr/ up to next slash or end)
        const match = rawText.match(/\/qr\/([^/]+)/);
        console.log('Matched doc ID:', match?.[1]);

        if (match && match[1]) {
          const docId = match[1];
          const docRef = doc(firestore, 'products', docId);

          try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              const barcode = data.barcode || data.old_barcode;

              if (barcode) {
                if (onDetected) onDetected(barcode);
              } else {
                setError(`No barcode found in product data: ${docId}`);
              }
            } else {
              setError(`Product not found in Firestore: ${docId}`);
            }
          } catch (error) {
            console.error('Error fetching product from Firestore:', error);
            setError('Failed to fetch product data from Firestore');
          }
        } else {
          // If scanned text is not a QR link with /qr/{id}, assume raw barcode and send it
          if (onDetected) onDetected(rawText);
        }

        if (codeReader.reset) codeReader.reset();
        if (onClose) onClose();
      } else if (err && !(err instanceof NotFoundException)) {
        setError(err.message || 'Camera error');
      }
    });

    return () => {
      active = false;
      if (codeReader.reset) codeReader.reset();
    };
  }, [mediaStream, onDetected, onClose]);

  // Zoom slider handler
  const handleZoomChange = (e) => {
    const newZoom = Number(e.target.value);
    setZoom(newZoom);
    if (mediaStream) {
      const [track] = mediaStream.getVideoTracks();
      if (track?.applyConstraints) {
        track.applyConstraints({ advanced: [{ zoom: newZoom }] });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-lg shadow-lg p-4 relative w-full max-w-md flex flex-col items-center">
        <button
          className="absolute top-2 right-2 text-2xl text-gray-600 hover:text-red-600"
          onClick={onClose}
          aria-label="Close scanner"
        >
          ×
        </button>
        <div className="w-full flex flex-col items-center">
          <video
            ref={videoRef}
            className="w-full max-h-80 rounded bg-black"
            autoPlay
            muted
            playsInline
          />
          {maxZoom > 1 && (
            <div className="w-full flex items-center gap-2 mt-2">
              <span className="text-xs">Zoom</span>
              <input
                type="range"
                min={1}
                max={maxZoom}
                step={0.1}
                value={zoom}
                onChange={handleZoomChange}
                className="w-full"
                aria-label="Camera zoom slider"
              />
              <span className="text-xs">{zoom.toFixed(1)}x</span>
            </div>
          )}
        </div>
        {error && <div className="text-red-600 mt-2">{error}</div>}
        <div className="mt-2 text-sm text-gray-500">
          Point your camera at a barcode or QR code
        </div>
      </div>
    </div>
  );
};

export default CameraScanner;