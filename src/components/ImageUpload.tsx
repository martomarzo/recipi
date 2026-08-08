'use client';

import { useState, useRef } from 'react';

interface ImageUploadProps {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}

const MAX_DIMENSION = 512;

/** Redimensiona una imagen en el canvas del navegador antes de subirla. */
function resizeImage(file: File, maxDim = MAX_DIMENSION): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo procesar la imagen.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error('No se pudo procesar la imagen.'));
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = objectUrl;
  });
}

export default function ImageUpload({ currentUrl, onUploaded }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Elegí un archivo de imagen.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen debe ser menor a 10 MB.');
      return;
    }

    setError('');
    setUploading(true);

    try {
      let uploadBlob: Blob = file;
      let filename = file.name;
      try {
        uploadBlob = await resizeImage(file);
        filename = file.name.replace(/\.[^./\\]+$/, '') + '.jpg';
      } catch {
        // si el redimensionado falla, se sube el archivo original
      }

      setPreview(URL.createObjectURL(uploadBlob));

      const formData = new FormData();
      formData.append('file', uploadBlob, filename);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      onUploaded(data.url);
    } catch {
      setError('No se pudo subir la imagen. Probá de nuevo.');
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        className="relative cursor-pointer rounded-xl border-2 border-dashed border-linea transition-colors hover:border-salvia"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa" className="h-48 w-full rounded-xl object-cover" />
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-tinta-suave">
            <svg className="mb-2 h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Tocá para agregar una foto</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-tinta/40">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      {error && <p className="text-sm text-mal">{error}</p>}
    </div>
  );
}
