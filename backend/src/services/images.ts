import sharp from 'sharp';

import {config} from '@/configs/config';
import {AppError} from '@/configs/status';

import type {Box, Img} from '@/services/types';

const {MIN_SIDE, MAX_SIDE, QUALITY, REFERENCE_PAD} = config.IMAGE;

// Jev rejects out-of-range images instead of resizing them, so every image is fitted to its limits here.
export async function normalize(input: Buffer): Promise<Img> {
  try {
    let {data, info} = await sharp(input).rotate().resize({width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true}).jpeg({quality: QUALITY}).toBuffer({resolveWithObject: true});

    if (Math.min(info.width, info.height) >= MIN_SIDE) {
      return {buffer: data, width: info.width, height: info.height};
    }

    let scale = MIN_SIDE / Math.min(info.width, info.height);
    let width = Math.ceil(info.width * scale);
    let height = Math.ceil(info.height * scale);

    if (Math.max(width, height) > MAX_SIDE) {
      throw new AppError('image_invalid', 'aspect ratio too extreme');
    }

    let upscaled = await sharp(data).resize(width, height).jpeg({quality: QUALITY}).toBuffer({resolveWithObject: true});
    return {buffer: upscaled.data, width: upscaled.info.width, height: upscaled.info.height};
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError('image_invalid');
  }
}

export async function crop(img: Img, box: Box, pad = REFERENCE_PAD): Promise<Img> {
  let left = Math.max(0, Math.floor((box.left - pad) * img.width));
  let top = Math.max(0, Math.floor((box.top - pad) * img.height));
  let right = Math.min(img.width, Math.ceil((box.right + pad) * img.width));
  let bottom = Math.min(img.height, Math.ceil((box.bottom + pad) * img.height));

  if (right - left < 8 || bottom - top < 8) {
    throw new AppError('input_invalid', 'reference box is too small');
  }

  let cropped = await sharp(img.buffer)
    .extract({left, top, width: right - left, height: bottom - top})
    .toBuffer();

  return normalize(cropped);
}
