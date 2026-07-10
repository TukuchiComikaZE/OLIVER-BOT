const { execFile } = require('child_process');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const os = require('os');

const KHMER_VOICES = {
  sreymom: 'km-KH-SreymomNeural',
  piseth: 'km-KH-PisethNeural',
};

async function getKhmerTTS(text, voiceKey = 'sreymom') {
  const voice = KHMER_VOICES[voiceKey] || KHMER_VOICES.sreymom;
  const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);

  return new Promise((resolve, reject) => {
    execFile('edge-tts', [
      '--voice', voice,
      '--rate=-20%',
      '--text', text,
      '--write-media', tmpFile,
    ], { timeout: 15000 }, (err) => {
      if (err) {
        reject(new Error(`edge-tts failed: ${err.message}`));
        return;
      }

      const buffer = fs.readFileSync(tmpFile);
      fs.unlinkSync(tmpFile);

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      resolve(readable);
    });
  });
}

module.exports = { getKhmerTTS, KHMER_VOICES };
