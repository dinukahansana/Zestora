import cloudinary from 'cloudinary';
import sharp from 'sharp';
import type { AppConfig } from '../config.ts';
import { HttpError } from '../http.ts';

export type UploadImage = (image: Buffer) => Promise<string>;

export function createImageUploader(config: AppConfig): UploadImage | undefined {
  if (!config.cloudinaryUrl) return undefined;
  const url = new URL(config.cloudinaryUrl);
  return image => new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream({
      cloud_name: url.hostname,
      api_key: decodeURIComponent(url.username),
      api_secret: decodeURIComponent(url.password),
      folder: 'zestora',
      resource_type: 'image',
      timeout: 12000,
      disable_promises: true,
    }, (error, result) => {
      if (error || !result?.secure_url) reject(new HttpError(502, 'IMAGE_UPLOAD_FAILED', 'Image storage did not accept the upload.'));
      else resolve(result.secure_url);
    });
    stream.on('error', () => reject(new HttpError(502, 'IMAGE_UPLOAD_FAILED', 'Image storage did not accept the upload.')));
    stream.end(image);
  });
}

export async function validatedImage(input: unknown) {
  if (!Buffer.isBuffer(input) || !input.length) throw new HttpError(400, 'INVALID_IMAGE', 'Upload a JPEG, PNG, or WebP image.');
  try {
    const decoder = sharp(input, { limitInputPixels: 16000000, failOn: 'error' });
    const metadata = await decoder.metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
      throw new Error('Unsupported image format.');
    }
    return await decoder.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  } catch {
    throw new HttpError(400, 'INVALID_IMAGE', 'Upload a valid still JPEG, PNG, or WebP image within the size limit.');
  }
}
