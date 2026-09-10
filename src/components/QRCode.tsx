import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  value: string;
  size?: number;
  className?: string;
}

/** A genuinely-scannable QR code rendered from the given value. */
export function QRCodeImage({ value, size = 176, className }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f2619', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        role="img"
        aria-label="QR code unavailable"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={`Boarding QR code for ${value}`}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
