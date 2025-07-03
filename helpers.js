const winston = require('winston');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pipeline } = require('stream');
const wav = require('wav');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const config = require('./config');
const { delay } = require('./utils');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Generate API key
function generateApiKey() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let apiKey = '';
  for (let i = 0; i < 32; i++) {
    apiKey += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return apiKey;
}

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Admin authentication middleware
function isAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.redirect('/admin');
  }
}

// Generate custom call ID
function generateCustomCallId() {
  return uuidv4();
}

// Send callback update
async function sendCallbackUpdate(callId, state, data = {}, callStates) {
  if (!callStates[callId]) {
    logger.warn(`No call state found for call ${callId} in sendCallbackUpdate`);
    return;
  }

  const callbackUrl = callStates[callId].callbackUrl;
  if (!callbackUrl) {
    logger.warn(`No callback URL found for call ${callId}`);
    return;
  }

  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  });

  const payload = {
    state,
    call_id: callId,
    ...data,
    timestamp,
  };

  try {
    await axios.post(callbackUrl, payload);
    logger.info(`Callback sent for call ${callId}: ${state}`);

    if (callStates[callId] && callStates[callId].apiKey && state === 'completed') {
      const { apiKey, status } = callStates[callId];
      const User = require('./models').User; // This will need to be passed or imported properly
      const user = await User.findOne({ where: { apikey: apiKey } });
      if (user) {
        if (status !== 'answered') {
          user.failedCalls += 1;
          await user.save();
        }
      }
    }
  } catch (err) {
    logger.error(`Error sending callback for call ${callId}: ${err.message}`, err);
  }
}

// Increment failed calls
async function incrementFailedCalls(apiKey, User) {
  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      user.failedCalls = (user.failedCalls || 0) + 1;
      await user.save();
      logger.info(`Incremented failed calls count for API key ${apiKey}`);
    }
  } catch (err) {
    logger.error(`Error updating failed calls count: ${err.message}`);
  }
}

// Generate TTS audio
async function generateTtsAudio(text, voice, retries = 2) {
  const soundsDir = '/var/lib/asterisk/sounds';
  const apiUrl = `https://${config.azureTts.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const headers = {
    'Ocp-Apim-Subscription-Key': config.azureTts.apiKey,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
    'Connection': 'keep-alive',
  };

  const ssmlPayload = `<speak version='1.0' xml:lang='en-US'><voice name='${voice}'>${text}</voice></speak>`;
  const datetime = new Date().toISOString().replace(/[-:.]/g, '').split('.')[0];
  const uniqueId = `${datetime}-${crypto.randomBytes(4).toString('hex')}`;
  const finalAudioFileName = `${uniqueId}.wav`;
  const finalAudioFilePath = path.join(soundsDir, finalAudioFileName);
  const tempFilePath = `${finalAudioFilePath}.tmp`;

  const generateAudio = async (attempt = 0) => {
    let soxProcess;

    try {
      const response = await axios.post(apiUrl, ssmlPayload, {
        headers,
        responseType: 'stream',
        timeout: 10000,
        maxRedirects: 5,
      });

      soxProcess = spawn('sox', [
        '-t', 'wav', '-',
        '-r', '8000',
        '-c', '1',
        '-b', '16',
        '-t', 'wav', tempFilePath,
        '--buffer', '8192',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        killSignal: 'SIGKILL',
      });

      await new Promise((resolve, reject) => {
        pipeline(
          response.data,
          soxProcess.stdin,
          (err) => {
            if (err) {
              logger.error(`Pipeline error on attempt ${attempt + 1}: ${err.message}`);
              reject(err);
            }
          }
        );

        let errorOutput = '';
        soxProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        soxProcess.on('error', (err) => {
          logger.error(`Sox process error on attempt ${attempt + 1}: ${err.message}`);
          reject(err);
        });

        soxProcess.on('close', (code) => {
          if (code === 0) {
            const stats = fs.statSync(tempFilePath);
            if (stats.size < 44) {
              reject(new Error(`Generated TTS file is too small: ${stats.size} bytes`));
              return;
            }
            fs.renameSync(tempFilePath, finalAudioFilePath);
            logger.info(`TTS audio file generated: ${finalAudioFilePath}`);
            resolve();
          } else {
            logger.error(`Sox exited with code ${code}: ${errorOutput}`);
            reject(new Error(`Sox process failed with code ${code}`));
          }
        });
      });

      const wavReader = new wav.Reader();
      const readable = fs.createReadStream(finalAudioFilePath);
      await new Promise((resolve, reject) => {
        readable.pipe(wavReader);
        wavReader.on('format', () => resolve());
        wavReader.on('error', (err) => reject(new Error(`Invalid WAV file: ${err.message}`)));
      });

      return finalAudioFilePath;

    } catch (err) {
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          logger.error(`Failed to cleanup temp file: ${cleanupErr.message}`);
        }
      }

      if (soxProcess && !soxProcess.killed) {
        soxProcess.kill('SIGKILL');
      }

      if (attempt < retries && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.response?.status >= 500)) {
        logger.warn(`Retrying TTS (attempt ${attempt + 2}/${retries + 1}): ${err.message}`);
        await delay(1000 * Math.pow(2, attempt));
        return generateAudio(attempt + 1);
      }

      logger.error(`TTS failed after ${attempt + 1} attempts: ${err.message}`);
      throw err;
    }
  };

  try {
    return await generateAudio(0);
  } catch (err) {
    throw new Error(`TTS generation failed: ${err.message}`);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        logger.error(`Final cleanup failed: ${cleanupErr.message}`);
      }
    }
  }
}

// Generate multilingual TTS audio
async function generateMultilingualTtsAudio(text, voice, callId, retries = 2) {
  const soundsDir = '/var/lib/asterisk/sounds';
  const apiUrl = `https://${config.azureTts.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const headers = {
    'Ocp-Apim-Subscription-Key': config.azureTts.apiKey,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
    'Connection': 'keep-alive',
  };

  // Enhanced SSML for multilingual voices with prosody adjustments
  const ssmlPayload = `<speak version='1.0' xml:lang='en-US'>
    <voice name='${voice}'>
      <prosody rate="1.05" pitch="+3%">
        ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')}
      </prosody>
    </voice>
  </speak>`;

  const datetime = new Date().toISOString().replace(/[-:.]/g, '').split('.')[0];
  const uniqueId = `${datetime}-${crypto.randomBytes(4).toString('hex')}`;
  const finalAudioFileName = `ai_${callId}_${uniqueId}.wav`;
  const finalAudioFilePath = path.join(soundsDir, finalAudioFileName);
  const tempFilePath = `${finalAudioFilePath}.tmp`;

  const generateAudio = async (attempt = 0) => {
    let soxProcess;

    try {
      const response = await axios.post(apiUrl, ssmlPayload, {
        headers,
        responseType: 'stream',
        timeout: 8000,
        maxRedirects: 5,
      });

      // Convert to 8kHz for telephony
      soxProcess = spawn('sox', [
        '-t', 'wav', '-',
        '-r', '8000',
        '-c', '1',
        '-b', '16',
        '-t', 'wav', tempFilePath,
        '--buffer', '8192',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        killSignal: 'SIGKILL',
      });

      await new Promise((resolve, reject) => {
        pipeline(
          response.data,
          soxProcess.stdin,
          (err) => {
            if (err) {
              logger.error(`AI TTS pipeline error on attempt ${attempt + 1}: ${err.message}`);
              reject(err);
            }
          }
        );

        let errorOutput = '';
        soxProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        soxProcess.on('error', (err) => {
          logger.error(`AI TTS Sox process error on attempt ${attempt + 1}: ${err.message}`);
          reject(err);
        });

        soxProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const stats = fs.statSync(tempFilePath);
              if (stats.size < 44) {
                reject(new Error(`Generated AI TTS file is too small: ${stats.size} bytes`));
                return;
              }
              fs.renameSync(tempFilePath, finalAudioFilePath);
              logger.info(`AI TTS audio file generated: ${finalAudioFilePath} for call ${callId}`);
              resolve();
            } catch (err) {
              reject(err);
            }
          } else {
            logger.error(`AI TTS Sox exited with code ${code}: ${errorOutput}`);
            reject(new Error(`Sox process failed with code ${code}`));
          }
        });
      });

      // Validate WAV file
      const wavReader = new wav.Reader();
      const readable = fs.createReadStream(finalAudioFilePath);
      await new Promise((resolve, reject) => {
        readable.pipe(wavReader);
        wavReader.on('format', () => resolve());
        wavReader.on('error', (err) => reject(new Error(`Invalid WAV file: ${err.message}`)));
      });

      return finalAudioFilePath;

    } catch (err) {
      // Cleanup
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          logger.error(`Failed to cleanup temp file: ${cleanupErr.message}`);
        }
      }

      if (soxProcess && !soxProcess.killed) {
        soxProcess.kill('SIGKILL');
      }

      if (attempt < retries && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.response?.status >= 500)) {
        logger.warn(`Retrying AI TTS (attempt ${attempt + 2}/${retries + 1}): ${err.message}`);
        await delay(1000 * Math.pow(2, attempt));
        return generateAudio(attempt + 1);
      }

      logger.error(`AI TTS failed after ${attempt + 1} attempts: ${err.message}`);
      throw err;
    }
  };

  try {
    return await generateAudio(0);
  } catch (err) {
    throw new Error(`AI TTS generation failed: ${err.message}`);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        logger.error(`Final cleanup failed: ${cleanupErr.message}`);
      }
    }
  }
}

// Real-time speech recognition for AI
async function recognizeSpeechForAI(audioBuffer, callId) {
  const subscriptionKey = config.azureSpeech.apiKey;
  const serviceRegion = config.azureSpeech.region;
  
  try {
    const form = new FormData();
    form.append('audio', audioBuffer, {
      filename: `audio_${callId}.wav`,
      contentType: 'audio/wav'
    });
    form.append('definition', JSON.stringify({
      locales: ["en-US", "en-IN", "en-GB", "en-AU", "en-CA"]
    }));

    const response = await axios.post(
      `https://${serviceRegion}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`,
      form,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          ...form.getHeaders()
        },
        timeout: 10000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    if (response.data?.combinedPhrases?.[0]?.text) {
      return response.data.combinedPhrases[0].text;
    }
    
    return null;
  } catch (error) {
    if (error.response?.status === 429) {
      logger.warn(`AI speech recognition rate limited for call ${callId}`);
      await delay(2000);
      throw new Error('Rate limited - please retry');
    }
    logger.error(`AI speech recognition error for call ${callId}: ${error.message}`);
    throw error;
  }
}

// Check ARI connection
async function checkAriConnection(ariClient) {
  try {
    if (!ariClient) return false;
    // Try to get asterisk info
    await ariClient.asterisk.getInfo();
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  logger,
  generateApiKey,
  isAuthenticated,
  isAdmin,
  generateCustomCallId,
  sendCallbackUpdate,
  incrementFailedCalls,
  generateTtsAudio,
  generateMultilingualTtsAudio,
  recognizeSpeechForAI,
  checkAriConnection
};