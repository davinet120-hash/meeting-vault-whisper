/** Split long audio into smaller WAV segments for Gemini API limits. */

const SEGMENT_SECONDS = 120;
const MAX_SINGLE_BLOB_BYTES = 4 * 1024 * 1024;

export async function getAudioDuration(blob: Blob): Promise<number> {
  const ctx = new AudioContext();
  try {
    const buf = await blob.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    return audio.duration;
  } finally {
    await ctx.close();
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function sliceBuffer(src: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const startSample = Math.floor(startSec * src.sampleRate);
  const endSample = Math.min(Math.floor(endSec * src.sampleRate), src.length);
  const length = endSample - startSample;
  const ctx = new OfflineAudioContext(src.numberOfChannels, length, src.sampleRate);
  const dst = ctx.createBuffer(src.numberOfChannels, length, src.sampleRate);
  for (let c = 0; c < src.numberOfChannels; c++) {
    dst.getChannelData(c).set(src.getChannelData(c).subarray(startSample, endSample));
  }
  return dst;
}

export async function splitAudioBlob(
  blob: Blob,
  onProgress?: (msg: string) => void,
): Promise<Blob[]> {
  const log = (m: string) => onProgress?.(m);

  if (blob.size <= MAX_SINGLE_BLOB_BYTES) {
    try {
      const dur = await getAudioDuration(blob);
      if (dur <= SEGMENT_SECONDS) {
        log(`Audio ${dur.toFixed(0)}s — single segment`);
        return [blob];
      }
    } catch {
      log("Could not read duration — sending as single blob");
      return [blob];
    }
  }

  log("Decoding audio for segmentation…");
  const ctx = new AudioContext();
  try {
    const buf = await blob.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const total = audio.duration;
    const segments: Blob[] = [];
    const count = Math.ceil(total / SEGMENT_SECONDS);
    log(`Splitting ${total.toFixed(0)}s into ${count} segment(s)`);

    for (let i = 0; i < count; i++) {
      const start = i * SEGMENT_SECONDS;
      const end = Math.min((i + 1) * SEGMENT_SECONDS, total);
      const slice = sliceBuffer(audio, start, end);
      segments.push(audioBufferToWav(slice));
      log(`Segment ${i + 1}/${count}: ${start.toFixed(0)}s–${end.toFixed(0)}s`);
    }
    return segments;
  } finally {
    await ctx.close();
  }
}
