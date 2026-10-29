import { supabase } from './supabase';

/**
 * Compresses an image file to a clean JPEG/PNG Blob and DataURL
 */
const compressImageFile = (file: File, maxDimension = 500, quality = 0.85): Promise<{ blob: Blob; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Erro ao processar imagem.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(outputType, quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl: compressedDataUrl });
            } else {
              reject(new Error('Falha ao comprimir imagem.'));
            }
          },
          outputType,
          quality
        );
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a photo/file (JPEG, PNG, or PDF) to Supabase Storage ('avatars' bucket)
 * with automatic fallback to Data URL so it never fails.
 */
export const uploadPlayerFile = async (file: File): Promise<string> => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(fileExt);

  if (!allowedTypes.includes(file.type) && !isAllowedExt) {
    throw new Error('Formato não suportado. Envie um arquivo JPEG, PNG ou PDF.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('O arquivo deve ter no máximo 10 MB.');
  }

  const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${isPdf ? 'pdf' : fileExt === 'png' ? 'png' : 'jpg'}`;
  const filePath = `uploads/${uniqueName}`;

  if (isPdf) {
    // Upload PDF to Supabase Storage
    const { error } = await supabase.storage.from('avatars').upload(filePath, file, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (data?.publicUrl) return data.publicUrl;
    }

    // Fallback to DataURL for PDF if storage fails
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Erro ao processar PDF.'));
      };
      reader.onerror = () => reject(new Error('Erro ao ler PDF.'));
      reader.readAsDataURL(file);
    });
  }

  // Image (JPEG / PNG)
  const { blob, dataUrl } = await compressImageFile(file);
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

  try {
    const { error } = await supabase.storage.from('avatars').upload(filePath, blob, {
      contentType,
      upsert: true,
    });

    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (data?.publicUrl) return data.publicUrl;
    }
  } catch (err) {
    console.warn('Storage upload fallback to DataURL:', err);
  }

  return dataUrl;
};
