// Menu photos stay in memory on the phone and go to the API once to be read.
// They're never saved, here or on the server.

const MAX_EDGE = 2048;
const QUALITY = 0.85;

export type MenuPhoto = { blob: Blob; url: string };

async function toJpeg(source: CanvasImageSource, width: number, height: number): Promise<MenuPhoto> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the photo"))), "image/jpeg", QUALITY),
  );
  return { blob, url: URL.createObjectURL(blob) };
}

/** Grabs the current camera frame, scaled down so it stays under the API's size limit. */
export function captureFrame(video: HTMLVideoElement) {
  return toJpeg(video, video.videoWidth, video.videoHeight);
}

/** Converts an uploaded image to a scaled-down JPEG. */
export async function fromFile(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    return await toJpeg(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export function release(photos: MenuPhoto[]) {
  for (const p of photos) URL.revokeObjectURL(p.url);
}
