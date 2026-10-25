const { execFile } = require('child_process');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const os = require('os');

const KHMER_VOICES = {
  sreymom: 'km-KH-SreymomNeural',
  piseth: 'km-KH-PisethNeural',
};

const THAI_VOICES = {
  premwadee: 'th-TH-PremwadeeNeural',
  niwat: 'th-TH-NiwatNeural',
};

const VOICE_POOLS = { km: KHMER_VOICES, th: THAI_VOICES };

// Serialize all TTS jobs through a queue (gentle on Microsoft's service,
// and prevents overlapping greetings/mandates from spawning parallel
// edge-tts processes), with retries for transient server hiccups.
const MIN_GAP = 2000;
let queue = Promise.resolve();
let lastStart = 0;

function scheduleTTS(fn) {
  const run = queue
    .then(() => new Promise(r => setTimeout(r, Math.max(0, MIN_GAP - (Date.now() - lastStart)))))
    .then(() => {
      lastStart = Date.now();
      return fn();
    });
  queue = run.catch(() => { });
  return run;
}

function getKhmerTTS(text, voiceKey = 'sreymom', lang = 'km') {
  return scheduleTTS(async () => {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await synthesizeOnce(text, voiceKey, lang);
      } catch (err) {
        lastError = err;
        console.error(`TTS attempt ${attempt}/3 failed: ${err.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 3000));
      }
    }
    throw lastError;
  });
}

function synthesizeOnce(text, voiceKey, lang) {
  const pool = VOICE_POOLS[lang] || KHMER_VOICES;
  const voice = pool[voiceKey] || KHMER_VOICES[voiceKey] || KHMER_VOICES.sreymom;
  const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);

  return new Promise((resolve, reject) => {
    execFile('edge-tts', [
      '--voice', voice,
      '--rate=-20%',
      '--text', text,
      '--write-media', tmpFile,
    ], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('edge-tts stderr:\n', stderr || '(no stderr)');
        const lastLines = stderr ? stderr.split('\n').filter(Boolean).slice(-4).join(' | ') : err.message;
        reject(new Error(`edge-tts failed: ${lastLines}`));
        return;
      }

      if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size === 0) {
        reject(new Error('edge-tts produced no audio (empty output file)'));
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

module.exports = { getKhmerTTS, KHMER_VOICES, THAI_VOICES };
