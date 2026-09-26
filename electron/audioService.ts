import fs from 'fs'
import { join } from 'path'

export function saveWavFile(audioChunks: Buffer[], tempDir: string): string | null {
  if (audioChunks.length === 0) return null;
  
  const totalBuffer = Buffer.concat(audioChunks);
  const wavPath = join(tempDir, `vocalfix_${Date.now()}.wav`);
  
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + totalBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // raw PCM
  header.writeUInt16LE(1, 22); // channels
  header.writeUInt32LE(16000, 24); // sample rate
  header.writeUInt32LE(16000 * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(totalBuffer.length, 40);
  
  const wavBuffer = Buffer.concat([header, totalBuffer]);
  fs.writeFileSync(wavPath, wavBuffer);
  
  return wavPath;
}
