const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AriClient = require('ari-client');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const stream = require('stream');
const wav = require('wav');
const { Sequelize } = require('sequelize');
const rateLimit = require('express-rate-limit');
const { pipeline } = require('stream');
const OpenAI = require('openai');
const { PassThrough, Readable } = require('stream');
const FormData = require('form-data');

const config = require('./config');
const { 
  sequelize, 
  User, 
  AdminLog, 
  UserLog, 
  CountryPrice, 
  PaymentTransaction, 
  CallState, 
  Announcement, 
  ChatMessage, 
  UpdateNotice 
} = require('./models');
const {
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
} = require('./helpers');
const {
  delay,
  hangupCauseDescriptions,
  calculateBillableDuration,
  getBillingIncrementName,
  verifyNowPaymentsSignature,
  generateSecureOrderId,
  getFormattedTimestamp,
  deleteOldFiles,
  deleteOldRecordingsAndAudioFiles,
  deleteOldCallLogs,
  calculateBalanceCut,
  getPricePerSecond,
  cleanupExpiredPayments,
  createWavBuffer
} = require('./utils');
const webApiRouter = require('./webapi');

// Constants
const RECORDING_PATH = '/var/spool/asterisk/recording/';
const SOUNDS_DIR = '/var/lib/asterisk/sounds';
const DELETE_AFTER_HOURS = 12;
const soundsDir = '/var/lib/asterisk/sounds';
const monitorDir = '/var/spool/asterisk/recording';

// Ensure directories exist
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}
if (!fs.existsSync(monitorDir)) {
  fs.mkdirSync(monitorDir, { recursive: true });
}

// Global state variables
const callStates = {};
let ariClient;
const aiAssistantStates = {};

// Express app setup
const app = express();
const PORT = config.port || 3000;

app.set('trust proxy', 1);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Block direct IP access
app.use((req, res, next) => {
  const host = req.get('host');
  if (host === '94.131.112.88:3000') {
    return res.status(404).send('Not Found');
  }
  next();
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, 'public')));

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Helper function wrapping sendCallbackUpdate
const sendCallback = async (callId, state, data = {}) => {
  return sendCallbackUpdate(callId, state, data, callStates);
};

// ARI Connection
async function connectToAri() {
  if (ariClient) return ariClient;
  try {
    ariClient = await AriClient.connect(config.ari.url, config.ari.username, config.ari.password);
    logger.info('Connected to Asterisk ARI');
    ariClient.start('myapp');
    
    // ARI Event Handlers
    ariClient.on('AnyEvent', (event) => {
      console.log('Event received:', event);
    });
    
    ariClient.on('ChannelStateChange', async (event) => {
      const callId = Object.keys(callStates).find(id => callStates[id]?.channelId === event.channel.id);
      if (!callId || !callStates[callId]) {
        logger.warn(`Call state not found for channel ${event.channel.id}, skipping ChannelStateChange`);
        return;
      }
    
      try {
        const callState = await CallState.findOne({ where: { callId } });
        if (!callState) {
          logger.warn(`CallState record not found for call ${callId}`);
          return;
        }
    
        if (event.channel.state === 'Up' && !callStates[callId].callAnswered) {
          callStates[callId].callAnswered = true;
    
          try {
            await ariClient.channels.answer({ channelId: event.channel.id });
          } catch (err) {
            if (!err.message.includes('Channel not in Stasis application')) {
              throw err;
            }
            logger.warn(`Channel ${event.channel.id} already left Stasis, skipping answer`);
            return;
          }
    
          callState.status = 'answered';
          callState.startTime = new Date();
          await callState.save();
          
          callStates[callId].status = 'answered';
          callStates[callId].actualAnswerTime = new Date();
          
          logger.info(`Call ${callId} answered at ${callStates[callId].actualAnswerTime}`);
          await sendCallback(callId, 'answered');

          if (callStates[callId].hasOwnProperty('amd') && callStates[callId].amd && !callStates[callId].amdCompleted) {
            try {
              await ariClient.channels.get({ channelId: event.channel.id });
              callStates[callId].preAmdChannelId = event.channel.id;
              
              await ariClient.channels.continueInDialplan({
                channelId: event.channel.id,
                context: 'amd-detection',
                extension: 's',
                priority: 1,
                variables: { CALLID: callId },
              });
              logger.info(`Call ${callId} sent to amd-detection context`);
            } catch (err) {
              logger.error(`Error sending call ${callId} to AMD: ${err.message}`);
              await sendCallback(callId, 'amd.error', { error: err.message });
              callStates[callId].amdCompleted = true;
            }
          }
        }
      } catch (err) {
        logger.error(`Error in ChannelStateChange for call ${callId}: ${err.message}`);
      }
    });
    
    ariClient.on('StasisStart', async (event) => {
      const channelId = event.channel.id;
      logger.info(`StasisStart triggered for channel ${channelId} with args: ${JSON.stringify(event.args)}`);
    
      let callId = Object.keys(callStates).find(id => callStates[id]?.channelId === channelId);
      
      if (event.args.length >= 2) {
        callId = event.args[0];
        const amdStatus = event.args[1];
        const amdCause = event.args[2] || 'UNKNOWN';
    
        if (!callStates[callId]) {
          logger.warn(`Call state not found for call ${callId} on AMD re-entry, attempting recovery`);
          callStates[callId] = {
            channelId: channelId,
            status: 'answered',
            callAnswered: true,
            amd: true,
            amdCompleted: false,
            callbackUrl: (await CallState.findOne({ where: { callId } }))?.callbackUrl || '',
            actionQueue: [],
          };
        }
    
        const oldChannelId = callStates[callId].channelId;
        callStates[callId].channelId = channelId;
        callStates[callId].currentChannel = event.channel;
        
        logger.info(`AMD re-entry: Updated channel ID from ${oldChannelId} to ${channelId} for call ${callId}`);
    
        if (callStates[callId].amd && !callStates[callId].amdCompleted) {
          let callbackState;
          switch (amdStatus) {
            case 'MACHINE':
              callbackState = 'amd.machine';
              callStates[callId].status = 'machine';
              break;
            case 'HUMAN':
              callbackState = 'amd.human';
              callStates[callId].status = 'answered';
              break;
            case 'NOTSURE':
              callbackState = 'amd.unknown';
              callStates[callId].status = 'notsure';
              break;
            default:
              callbackState = 'amd.error';
              logger.warn(`Unexpected AMDSTATUS for call ${callId}: ${amdStatus}`);
          }
    
          logger.info(`AMD Result for call ${callId}: ${amdStatus}, Cause: ${amdCause}`);
          await sendCallback(callId, callbackState, {
            status: amdStatus,
            cause: amdCause,
          });
          callStates[callId].amdCompleted = true;
          
          try {
            await ariClient.channels.get({ channelId });
            logger.info(`Channel ${channelId} remains in Stasis after AMD for call ${callId}`);
            
            await delay(100);
            
            await processActionQueue(callId);
          } catch (err) {
            logger.error(`Channel ${channelId} not in Stasis after AMD for call ${callId}: ${err.message}`);
            await onCallEnd(callId);
            delete callStates[callId];
            return;
          }
        }
      } else if (callId) {
        if (!callStates[callId].snoopChannelId) {
          try {
            logger.info(`Attempting to create snoop channel for call ${callId}`);
            const snoopChannel = await ariClient.channels.snoopChannel({
              channelId: event.channel.id,
              app: 'myapp',
              snoopId: `${callId}`,
              spy: 'both',
            });
            callStates[callId].snoopChannelId = snoopChannel.id;
            logger.info(`Snoop channel created for call ${callId}: ${snoopChannel.id}`);
    
            const recordingFileName = `${callId}`;
            const recordingFilePath = `/var/spool/asterisk/recording/${recordingFileName}.wav`;
            await snoopChannel.record({
              name: recordingFileName,
              format: 'wav',
              beep: false,
              maxDurationSeconds: 0,
              ifExists: 'overwrite',
            });
            callStates[callId].recordingFilePath = recordingFilePath;
            logger.info(`Snoop recording started for call ${callId} at ${recordingFilePath}`);
          } catch (err) {
            logger.error(`Failed to start snoop recording for call ${callId}: ${err.message}`);
            await sendCallback(callId, 'recording.error', { error: err.message });
          }
        }
      }
    });
    
    ariClient.on('ChannelDestroyed', async (event) => {
      const callId = Object.keys(callStates).find(id => callStates[id].channelId === event.channel.id);
      if (callId) {
        if (callStates[callId].timeoutId) {
          clearTimeout(callStates[callId].timeoutId);
        }
        await onCallEnd(callId);
        const causeCode = event.cause;
        const cause = hangupCauseDescriptions[causeCode] || `Unknown cause (${causeCode})`;
        const recordingUrl = `${config.apiBaseUrl}/recording?call_id=${callId}`;
    
        const callState = callStates[callId];
        if (!callState) {
          logger.error(`Call state for call ID ${callId} not found.`);
          return;
        }
    
        const { apiKey, status, totalHoldDuration, actualAnswerTime } = callState;
        
        logger.info(`Call ${callId} ended with status: ${status}, answered: ${callState.callAnswered}`);
        
        if (!apiKey) {
          logger.error(`API key is undefined for call ID ${callId}. Skipping user-related operations.`);
          return;
        }
    
        const endTime = new Date();
        
        // Only calculate duration and charge if call was answered
        if (status === 'answered' && callState.callAnswered && actualAnswerTime) {
          // Calculate duration from answer time, not start time
          const totalDuration = endTime - actualAnswerTime;
          const duration = Math.ceil((totalDuration - totalHoldDuration) / 1000);
    
          logger.info(`Call ${callId} duration calculation:
            - Answer time: ${actualAnswerTime}
            - End time: ${endTime}
            - Total duration: ${totalDuration}ms
            - Hold duration: ${totalHoldDuration}ms
            - Actual billable seconds: ${duration}s`);
    
          if (duration >= 3) {
            try {
              // Fetch the country price with billing increment from database
              const countryCode = callState.countryCode;
              const countryPriceData = await CountryPrice.findOne({ 
                where: { countryCode: countryCode } 
              });
    
              if (!countryPriceData) {
                logger.error(`Country price not found for code: ${countryCode}`);
                return;
              }
    
              // Calculate billable duration
              const billingIncrement = countryPriceData.billingIncrement || '1/1';
              const billableDuration = calculateBillableDuration(duration, billingIncrement);
              const charge = parseFloat((billableDuration * countryPriceData.pricePerSecond).toFixed(4));
              
              logger.info(`Call ${callId} billing:
                - Status: ${status}
                - Country: ${countryCode}
                - Actual duration: ${duration}s
                - Billable duration: ${billableDuration}s (${billingIncrement})
                - Price per second: $${countryPriceData.pricePerSecond}
                - Total charge: $${charge}`);
              
              // Find and update user balance
              const user = await User.findOne({ where: { apikey: apiKey } });
              if (user) {
                const previousBalance = parseFloat(user.balance);
                
                if (previousBalance >= charge) {
                  // Update user balance
                  user.balance = parseFloat((previousBalance - charge).toFixed(4));
                  user.totalCalls = (user.totalCalls || 0) + 1;
                  await user.save();
                  
                  logger.info(`Balance deducted for user ${user.username || user.apikey}:
                    - Previous balance: $${previousBalance.toFixed(4)}
                    - Charge: $${charge}
                    - New balance: $${user.balance}`);
                  
                  // Create a user log entry
                  await UserLog.create({
                    userId: user.id,
                    action: 'Call Charged',
                    details: `Call ${callId} to ${callState.toNumber} charged $${charge} for ${billableDuration}s`
                  });
                } else {
                  logger.warn(`Insufficient balance for user ${apiKey}: Balance $${previousBalance}, Required $${charge}`);
                  user.failedCalls = (user.failedCalls || 0) + 1;
                  await user.save();
                  
                  await UserLog.create({
                    userId: user.id,
                    action: 'Call Failed - Insufficient Balance',
                    details: `Call ${callId} failed. Required: $${charge}, Available: $${previousBalance}`
                  });
                }
              } else {
                logger.error(`User not found with API key: ${apiKey}`);
              }
              
              // Send callback with billing details
              await sendCallback(callId, 'completed', {
                cause,
                duration,
                billableDuration,
                billingIncrement,
                pricePerMinute: (countryPriceData.pricePerSecond * 60).toFixed(3),
                charge: charge.toFixed(4),
                recording: recordingUrl,
              });
            } catch (err) {
              logger.error(`Error processing billing for call ${callId}: ${err.message}`, err);
              await sendCallback(callId, 'completed', {
                cause,
                duration: duration || 0,
                recording: recordingUrl,
                error: 'Billing processing failed'
              });
            }
          } else {
            logger.info(`Call ${callId} too short for billing: ${duration}s`);
            await incrementFailedCalls(apiKey, User);
            await sendCallback(callId, 'completed', {
              cause,
              duration: 0,
              recording: recordingUrl,
            });
          }
        } else {
          // Call was not answered
          logger.info(`Call ${callId} not answered - no charge. Status: ${status}, Cause: ${cause}`);
          await incrementFailedCalls(apiKey, User);
          await sendCallback(callId, 'completed', {
            cause,
            duration: 0,
            recording: recordingUrl,
          });
        }
        
        // Cleanup code
        if (callStates[callId]?.ttsCache) {
          for (const filePath of Object.values(callStates[callId].ttsCache)) {
            try {
              if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                logger.info(`Deleted TTS file: ${filePath}`);
              }
            } catch (err) {
              logger.error(`Failed to delete TTS file ${filePath}: ${err.message}`);
            }
          }
        }
        
        if (callStates[callId]?.playbackQueue) {
          callStates[callId].playbackQueue = [];
        }
        
        delete callStates[callId];
        logger.info(`Call ${callId} completed and cleaned up`);
      } else {
        logger.warn(`No call state found for channel ID ${event.channel.id}`);
      }
    });
    
    return ariClient;
  } catch (err) {
    logger.error('Error connecting to Asterisk ARI:', err);
    throw err;
  }
}

// Core call functions
async function createCall(to, from, callbackUrl, apikey, amd = false) {
  try {
    // Ensure ARI client is connected
    const client = await connectToAri();
    if (!client) {
      throw new Error('Failed to connect to ARI service');
    }
    
    const callId = generateCustomCallId();
    const cleanTo = to.replace(/^\+/, '');
    
    logger.info(`Creating call ${callId}: ${from} -> ${to} (${cleanTo})`);
    
    // Get country code validation
    const countryPrices = await CountryPrice.findAll({
      attributes: ['countryCode']
    });
    const countryCodes = countryPrices.map(price => price.countryCode);
    let countryCode = countryCodes.find(code => cleanTo.startsWith(code));
    
    if (!countryCode) {
      throw new Error(`Country code for the number ${to} is not recognized`);
    }
    
    const countryPrice = await CountryPrice.findOne({ where: { countryCode } });
    if (!countryPrice) {
      throw new Error(`Country price for code ${countryCode} is not set`);
    }

    if (!apikey) {
      throw new Error('API key is required');
    }

    const user = await User.findOne({ where: { apikey } });
    if (!user) {
      throw new Error('User not found for the given API key');
    }

    // Check active calls and handle limit
    const activeCalls = await CallState.findAll({
      where: {
        userId: user.id,
        status: { [Sequelize.Op.in]: ['initiated', 'answered', 'bridging', 'machine', 'notsure'] }
      },
      order: [['startTime', 'ASC']]
    });

    logger.info(`User ${user.id} has ${activeCalls.length} active calls (limit: ${user.concurrentCalls})`);

    // If at limit, terminate the oldest call
    if (activeCalls.length >= user.concurrentCalls) {
      const oldestCall = activeCalls[0];
      logger.info(`Concurrent limit reached. Terminating oldest call ${oldestCall.callId} to make room for new call`);
      
      try {
        // Try to hangup the call if it's still active
        if (callStates[oldestCall.callId] && callStates[oldestCall.callId].channelId) {
          const channelId = callStates[oldestCall.callId].channelId;
          try {
            const channel = await client.channels.get({ channelId });
            await channel.hangup({ reason: 'CALL_LIMIT_REACHED' });
            logger.info(`Hung up oldest call ${oldestCall.callId}`);
          } catch (err) {
            logger.warn(`Could not hangup channel ${channelId}: ${err.message}`);
          }
        }
        
        // Force update the call state if it's still not ended
        if (!oldestCall.endTime) {
          oldestCall.status = 'terminated';
          oldestCall.endTime = new Date();
          await oldestCall.save();
          
          // Send callback notification
          if (callStates[oldestCall.callId] && callStates[oldestCall.callId].callbackUrl) {
            await sendCallback(oldestCall.callId, 'terminated', {
              reason: 'Concurrent call limit - terminated to allow new call'
            });
          }
          
          // Clean up from memory
          delete callStates[oldestCall.callId];
        }
        
        // Wait a moment for cleanup
        await delay(500);
      } catch (err) {
        logger.error(`Error terminating oldest call: ${err.message}`);
      }
    }

    // Create the new call
    logger.info(`Originating call via endpoint: PJSIP/${cleanTo}@39671`);
    
    let channel;
    try {
      channel = await client.channels.originate({
        endpoint: `PJSIP/${cleanTo}@39671`,
        callerId: from,
        app: 'myapp',
        context: 'steroid',
        priority: 1,
        variables: { CALLID: callId },
        timeout: 120,
      });
    } catch (err) {
      logger.error(`Failed to originate call: ${err.message}`);
      throw new Error(`Failed to initiate call: ${err.message}`);
    }

    logger.info(`Channel created: ${channel.id} for call ${callId}`);

    // Create database record
    const callState = await CallState.create({
      callId,
      status: 'initiated',
      channelId: channel.id,
      bridgeId: uuidv4(),
      startTime: new Date(),
      userId: user.id,
      toNumber: to,
      fromNumber: from,
      countryCode,
    });

    // Store call state in memory
    callStates[callId] = {
      callbackUrl,
      amd: amd,
      amdCompleted: false,
      callAnswered: false,
      status: 'initiated',
      channelId: channel.id,
      outgoingChannelId: channel.id,
      dtmfDigits: '',
      apiKey: apikey,
      countryCode: countryCode,
      countryPrice: countryPrice.toJSON(),
      holdStartTime: null,
      totalHoldDuration: 0,
      userId: user.id,
      startTime: new Date(),
      actualAnswerTime: null,
      actionQueue: [],
      playbackQueue: [],
      toNumber: to,
      fromNumber: from,
    };

    await sendCallback(callId, 'initiated');

    logger.info(`Call ${callId} successfully created and initiated`);
    return callId;
    
  } catch (err) {
    logger.error(`Error in createCall: ${err.message}`, err);
    throw err;
  }
}

async function onCallEnd(callId) {
  // Clean up AI assistant if active
  if (aiAssistantStates[callId]) {
    logger.info(`Call ending, stopping AI assistant for call ${callId}`);
    await stopAiAssistant(callId, 'Call ended');
  }
  
  // Original onCallEnd logic
  if (callStates[callId] && callStates[callId].snoopChannelId) {
    try {
      const snoopChannel = await ariClient.channels.get({ channelId: callStates[callId].snoopChannelId });
      if (snoopChannel) {
        await snoopChannel.hangup();
        logger.info(`Snoop channel ${callStates[callId].snoopChannelId} hung up for call ${callId}`);
      }
    } catch (err) {
      if (err.message?.includes('Channel not found')) {
        logger.warn(`Snoop channel already terminated`);
      } else {
        logger.error(`Error hanging up snoop channel: ${err.message}`);
      }
    }
  }

  try {
    const callState = await CallState.findOne({ where: { callId } });
    if (callState) {
      let finalStatus = 'failed';
      
      if (callStates[callId]) {
        if (callStates[callId].status === 'answered' || callStates[callId].callAnswered) {
          finalStatus = 'completed';
        } else if (callStates[callId].status === 'terminated') {
          finalStatus = 'terminated';
        } else {
          finalStatus = 'failed';
        }
      }
      
      callState.status = finalStatus;
      callState.endTime = callState.endTime || new Date();
      await callState.save();
      
      logger.info(`CallState updated for call ${callId} - Final status: ${finalStatus}`);
    }
  } catch (err) {
    logger.error(`Error updating CallState in onCallEnd: ${err.message}`);
  }
}

async function queueAction(callId, actionType, actionParams) {
  try {
    if (!callStates[callId]) {
      throw new Error(`Call state not found for call ID ${callId}`);
    }

    if (!callStates[callId].actionQueue) {
      callStates[callId].actionQueue = [];
    }

    callStates[callId].actionQueue.push({ actionType, actionParams });
    
    logger.info(`Action ${actionType} queued for call ${callId}. Queue length: ${callStates[callId].actionQueue.length}`);
    
    logger.debug(`Action queue for call ${callId}: ${JSON.stringify(callStates[callId].actionQueue.map(a => a.actionType))}`);
    if (!callStates[callId].amd || callStates[callId].amdCompleted) {
      logger.info(`AMD not active or completed for call ${callId}, processing action queue immediately`);
      await processActionQueue(callId);
    } else {
      logger.info(`AMD active for call ${callId}, action will be processed after AMD completion`);
    }
  } catch (err) {
    logger.error(`Error queuing action ${actionType} for call ${callId}: ${err.message}`);
    throw err;
  }
}

async function processActionQueue(callId) {
  if (!callStates[callId]) {
    logger.warn(`Call state not found for call ID ${callId} in processActionQueue`);
    return;
  }

  if (!callStates[callId].actionQueue || callStates[callId].actionQueue.length === 0) {
    logger.debug(`No actions in queue for call ${callId}`);
    return;
  }

  if (callStates[callId].isProcessingActions) {
    logger.debug(`Already processing actions for call ${callId}`);
    return;
  }

  callStates[callId].isProcessingActions = true;
  const client = await connectToAri();

  try {
    logger.info(`Starting to process ${callStates[callId].actionQueue.length} actions for call ${callId}`);

    while (callStates[callId]?.actionQueue?.length > 0) {
      if (!callStates[callId]) {
        logger.warn(`Call state lost during action processing for call ${callId}`);
        break;
      }

      const { actionType, actionParams } = callStates[callId].actionQueue.shift();
      logger.info(`Processing action ${actionType} for call ${callId}`);

      try {
        const channelId = callStates[callId].channelId;
        if (!channelId) {
          throw new Error(`Channel ID not found for call ${callId}`);
        }

        let channelExists = true;
        try {
          await client.channels.get({ channelId });
          logger.debug(`Channel ${channelId} verified for call ${callId}`);
        } catch (err) {
          if (err.message?.includes('Channel not found')) {
            logger.error(`Channel ${channelId} no longer exists for call ${callId}`);
            channelExists = false;
          } else {
            throw err;
          }
        }

        if (!channelExists) {
          logger.error(`Stopping action queue processing - channel gone for call ${callId}`);
          break;
        }

        if (callStates[callId].amdCompleted && callStates[callId].amdProcessingDelay !== false) {
          await delay(200);
          callStates[callId].amdProcessingDelay = false;
        }

        switch (actionType) {
          case 'gatherText':
            await gatherText(
              actionParams.text,
              actionParams.voice,
              actionParams.maxDigits,
              actionParams.validDigits,
              callId,
              actionParams.maxTries,
              actionParams.timeoutMillis
            );
            break;
            
          case 'playText':
            await playText(actionParams.text, actionParams.voice, callId);
            break;
            
          case 'playAudio':
            await playAudio(actionParams.audioUrl, callId);
            break;
            
          case 'gatherAudio':
            await gatherAudio(
              actionParams.audioUrl,
              actionParams.maxDigits,
              actionParams.validDigits,
              callId,
              actionParams.maxTries,
              actionParams.timeoutMillis
            );
            break;
            
          default:
            logger.warn(`Unknown action type: ${actionType} for call ${callId}`);
        }

        logger.info(`Successfully processed action ${actionType} for call ${callId}`);
        
        if (callStates[callId]?.actionQueue?.length > 0) {
          await delay(100);
        }

      } catch (actionErr) {
        logger.error(`Error processing action ${actionType} for call ${callId}: ${actionErr.message}`);
        
        if (callStates[callId]?.callbackUrl) {
          await sendCallback(callId, 'action.error', {
            action: actionType,
            error: actionErr.message
          });
        }

        if (actionErr.message.includes('Channel not found') || 
            actionErr.message.includes('Call state not found')) {
          logger.error(`Critical error - stopping action queue for call ${callId}`);
          break;
        }
        
        logger.info(`Continuing with next action despite error for call ${callId}`);
      }
    }

    logger.info(`Finished processing action queue for call ${callId}`);

  } catch (err) {
    logger.error(`Fatal error in processActionQueue for call ${callId}: ${err.message}`);
    
    if (callStates[callId]?.callbackUrl) {
      await sendCallback(callId, 'actionqueue.error', {
        error: err.message
      });
    }
  } finally {
    if (callStates[callId]) {
      callStates[callId].isProcessingActions = false;
      
      if (callStates[callId].actionQueue && callStates[callId].actionQueue.length > 0) {
        logger.warn(`Clearing ${callStates[callId].actionQueue.length} remaining actions for call ${callId}`);
        callStates[callId].actionQueue = [];
      }
    }
  }
}

async function processPlaybackQueue(callId, channel) {
  if (!callStates[callId] || !callStates[callId].playbackQueue || callStates[callId].playbackQueue.length === 0) {
    if (callStates[callId]) {
      callStates[callId].playback = null;
      callStates[callId].isProcessingQueue = false;
    }
    return;
  }

  if (callStates[callId].isProcessingQueue) {
    return;
  }
  callStates[callId].isProcessingQueue = true;

  const nextItem = callStates[callId].playbackQueue.shift();
  const controlId = uuidv4();

  try {
    if (!channel) {
      const channelId = callStates[callId].channelId;
      if (!channelId) {
        logger.error(`No channel ID found for call ${callId}`);
        callStates[callId].isProcessingQueue = false;
        return;
      }
      
      try {
        const client = await connectToAri();
        channel = await client.channels.get({ channelId });
      } catch (err) {
        logger.error(`Failed to get channel for call ${callId}: ${err.message}`);
        callStates[callId].isProcessingQueue = false;
        return;
      }
    }

    let media;
    let callbackPrefix;
    let ttsFilePath = null;

    if (nextItem.type === 'audio') {
      media = `sound:${nextItem.url}`;
      callbackPrefix = 'playback';
      logger.info(`Playing queued audio file: ${nextItem.url} for call ${callId} with control_id: ${controlId}`);
    } else if (nextItem.type === 'text') {
      logger.info(`Starting text-to-speech audio generation for queued text in call ${callId}`);
      
      try {
        const ttsCacheKey = `${nextItem.text}:${nextItem.voice}`;
        if (callStates[callId].ttsCache && callStates[callId].ttsCache[ttsCacheKey]) {
          ttsFilePath = callStates[callId].ttsCache[ttsCacheKey];
          logger.info(`Using cached TTS file for call ${callId}: ${ttsFilePath}`);
        } else {
          ttsFilePath = await generateTtsAudio(nextItem.text, nextItem.voice);
          
          if (!callStates[callId].ttsCache) {
            callStates[callId].ttsCache = {};
          }
          callStates[callId].ttsCache[ttsCacheKey] = ttsFilePath;
          
          if (!callStates[callId].tempTtsFiles) {
            callStates[callId].tempTtsFiles = [];
          }
          callStates[callId].tempTtsFiles.push(ttsFilePath);
        }
        
        media = `sound:${path.basename(ttsFilePath, '.wav')}`;
        callbackPrefix = 'speak';
        logger.info(`Playing queued TTS file: ${ttsFilePath} for call ${callId} with control_id: ${controlId}`);
      } catch (err) {
        logger.error(`TTS generation failed for call ${callId}: ${err.message}`);
        
        if (callStates[callId]?.callbackUrl) {
          await sendCallback(callId, 'speak.error', { 
            control_id: controlId,
            error: err.message 
          });
        }
        
        callStates[callId].isProcessingQueue = false;
        await processPlaybackQueue(callId, channel);
        return;
      }
    } else {
      logger.warn(`Unknown queue item type for call ${callId}: ${nextItem.type}`);
      callStates[callId].isProcessingQueue = false;
      await processPlaybackQueue(callId, channel);
      return;
    }

    if (callStates[callId]?.callbackUrl) {
      await sendCallback(callId, `${callbackPrefix}.started`, { control_id: controlId });
    }

    let playbackCompleted = false;
    let retryCount = 0;
    const maxRetries = 2;

    const attemptPlayback = async () => {
      try {
        const playback = await channel.play({ media });
        callStates[callId].playback = playback;
        callStates[callId].currentControlId = controlId;

        playback.once('PlaybackFinished', async () => {
          if (!callStates[callId] || playbackCompleted) return;
          playbackCompleted = true;

          logger.info(`${callbackPrefix} finished for call ${callId} with control_id: ${controlId}`);
          
          if (callStates[callId]?.callbackUrl) {
            await sendCallback(callId, `${callbackPrefix}.ended`, { control_id: controlId });
          }
          
          callStates[callId].playback = null;
          callStates[callId].currentControlId = null;
          callStates[callId].isProcessingQueue = false;
          
          await processPlaybackQueue(callId, channel);
        });

        playback.once('PlaybackFailed', async (err) => {
          if (!callStates[callId] || playbackCompleted) return;
          
          logger.error(`${callbackPrefix} failed for call ${callId} with control_id: ${controlId}: ${err.message}`);
          
          if (retryCount < maxRetries) {
            retryCount++;
            logger.info(`Retrying playback for call ${callId}, attempt ${retryCount + 1}`);
            await delay(500);
            await attemptPlayback();
          } else {
            playbackCompleted = true;
            
            if (callStates[callId]?.callbackUrl) {
              await sendCallback(callId, `${callbackPrefix}.error`, { 
                control_id: controlId,
                error: err.message 
              });
            }
            
            callStates[callId].playback = null;
            callStates[callId].currentControlId = null;
            callStates[callId].isProcessingQueue = false;
            
            await processPlaybackQueue(callId, channel);
          }
        });

      } catch (err) {
        logger.error(`Error starting playback for call ${callId}: ${err.message}`);
        
        if (retryCount < maxRetries) {
          retryCount++;
          await delay(500);
          await attemptPlayback();
        } else {
          callStates[callId].playback = null;
          callStates[callId].isProcessingQueue = false;
          await processPlaybackQueue(callId, channel);
        }
      }
    };

    await attemptPlayback();

  } catch (err) {
    logger.error(`Error processing playback queue for call ${callId}: ${err.message}`);
    callStates[callId].playback = null;
    callStates[callId].isProcessingQueue = false;
    
    await processPlaybackQueue(callId, channel);
  }
}

async function playText(text, voice, callId) {
  const client = await connectToAri();

  try {
    const channelId = callStates[callId]?.channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    const channel = await client.channels.get({ channelId });
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    if (!callStates[callId].playbackQueue) {
      callStates[callId].playbackQueue = [];
    }

    callStates[callId].playbackQueue.push({ type: 'text', text, voice });
    logger.info(`Added text to playback queue for call ${callId}. Queue length: ${callStates[callId].playbackQueue.length}`);

    if (!callStates[callId].playback && !callStates[callId].isProcessingQueue) {
      await processPlaybackQueue(callId, channel);
    }

  } catch (err) {
    logger.error(`Error queuing text for call ${callId}: ${err.message}`);
    throw err;
  }
}

async function playAudio(audioUrl, callId) {
  const client = await connectToAri();

  try {
    const channelId = callStates[callId]?.channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    const channel = await client.channels.get({ channelId });
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    if (!callStates[callId].playbackQueue) {
      callStates[callId].playbackQueue = [];
    }

    callStates[callId].playbackQueue.push({ type: 'audio', url: audioUrl });
    logger.info(`Added audio to playback queue for call ${callId}. Queue length: ${callStates[callId].playbackQueue.length}`);

    if (!callStates[callId].playback && !callStates[callId].isProcessingQueue) {
      await processPlaybackQueue(callId, channel);
    }

  } catch (err) {
    logger.error(`Error queuing audio for call ${callId}: ${err.message}`);
    throw err;
  }
}

async function gatherText(text, voice, maxDigits, validDigits = '0123456789*#', callId, maxTries = 3, timeoutMillis = 60000) {
  const client = await connectToAri();

  try {
    if (!callStates[callId]) {
      throw new Error(`Call state not found for call ID ${callId}`);
    }

    const channelId = callStates[callId].channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    let channel;
    try {
      channel = await client.channels.get({ channelId });
    } catch (err) {
      logger.error(`Failed to get channel ${channelId}: ${err.message}`);
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    const ttsCacheKey = `${text}:${voice}`;
    let ttsFilePath = callStates[callId].ttsCache?.[ttsCacheKey];
    if (!ttsFilePath || !fs.existsSync(ttsFilePath)) {
      ttsFilePath = await generateTtsAudio(text, voice);
      callStates[callId].ttsCache = callStates[callId].ttsCache || {};
      callStates[callId].ttsCache[ttsCacheKey] = ttsFilePath;
    } else {
      logger.info(`Using cached TTS file for call ${callId}: ${ttsFilePath}`);
    }

    const playAndGather = async (attempt = 0) => {
      if (!callStates[callId]) {
        return { digits: '', invalidDigits: '' };
      }
      
      if (attempt >= maxTries) {
        logger.info(`Max tries (${maxTries}) reached for call ${callId}`);
        await sendCallback(callId, 'maxretry.finished');
        return { digits: '', invalidDigits: '' };
      }

      logger.info(`Starting gather attempt ${attempt + 1}/${maxTries} for call ${callId}`);
      const soundFile = path.basename(ttsFilePath, '.wav');

      let digits = '';
      let invalidDigits = '';
      let isCompleted = false;
      let timeoutHandle = null;
      let dtmfHandler = null;
      let playbackFinished = false;

      if (callStates[callId].activeDtmfHandler) {
        channel.removeListener('ChannelDtmfReceived', callStates[callId].activeDtmfHandler);
        callStates[callId].activeDtmfHandler = null;
      }

      return new Promise(async (resolve) => {
        const completeGathering = () => {
          if (isCompleted) return;
          isCompleted = true;
          
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          
          if (dtmfHandler) {
            channel.removeListener('ChannelDtmfReceived', dtmfHandler);
          }
          callStates[callId].activeDtmfHandler = null;
        };

        dtmfHandler = async (event) => {
          if (!callStates[callId] || isCompleted) return;

          const digit = event.digit.toString();
          logger.info(`Received DTMF digit: ${digit} for call ${callId}`);

          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }

          if (validDigits.includes(digit)) {
            digits += digit;
            await sendCallback(callId, 'dtmf.entered', { digit });

            if (digits.length === maxDigits) {
              logger.info(`Collected ${maxDigits} digits for call ${callId}`);
              
              if (callStates[callId]?.playback) {
                try {
                  await callStates[callId].playback.stop();
                  logger.info(`Stopped playback after collecting ${maxDigits} digits`);
                } catch (err) {
                  if (!err.message?.includes('Playback not found')) {
                    logger.error(`Error stopping playback: ${err.message}`);
                  }
                }
                callStates[callId].playback = null;
              }
              
              completeGathering();
              resolve({ digits, invalidDigits });
            } else {
              if (playbackFinished) {
                timeoutHandle = setTimeout(() => {
                  if (!callStates[callId] || isCompleted) return;
                  logger.info(`Timeout after digit entry for call ${callId}`);
                  completeGathering();
                  resolve({ digits, invalidDigits });
                }, timeoutMillis);
              }
            }
          } else {
            invalidDigits += digit;
            await sendCallback(callId, 'dtmf.invalid', { digit });
            
            if (playbackFinished) {
              timeoutHandle = setTimeout(() => {
                if (!callStates[callId] || isCompleted) return;
                logger.info(`Timeout after invalid digit for call ${callId}`);
                completeGathering();
                resolve({ digits, invalidDigits });
              }, timeoutMillis);
            }
          }
        };

        callStates[callId].activeDtmfHandler = dtmfHandler;
        
        channel.on('ChannelDtmfReceived', dtmfHandler);
        logger.info(`DTMF listener attached for call ${callId}`);

        try {
          if (callStates[callId]?.playback) {
            try {
              await callStates[callId].playback.stop();
              callStates[callId].playback = null;
            } catch (err) {
              logger.debug(`Previous playback stop failed: ${err.message}`);
            }
          }

          const playback = await channel.play({ media: `sound:${soundFile}` });
          callStates[callId].playback = playback;

          playback.on('PlaybackFinished', async () => {
            if (!callStates[callId] || isCompleted) return;
            
            logger.info(`Playback finished for call ${callId}, starting timeout of ${timeoutMillis}ms`);
            playbackFinished = true;
            callStates[callId].playback = null;

            timeoutHandle = setTimeout(async () => {
              if (!callStates[callId] || isCompleted) return;
              
              logger.info(`Timeout reached for call ${callId}`);
              completeGathering();

              if (digits === '' && attempt + 1 < maxTries) {
                logger.info(`No DTMF received, retrying (${attempt + 2}/${maxTries})`);
                const result = await playAndGather(attempt + 1);
                resolve(result);
              } else {
                if (digits === '' && attempt + 1 >= maxTries) {
                  await sendCallback(callId, 'maxretry.finished');
                }
                resolve({ digits, invalidDigits });
              }
            }, timeoutMillis);
          });

          playback.on('PlaybackFailed', async (err) => {
            logger.error(`Playback failed for call ${callId}: ${err.message}`);
            completeGathering();
            
            if (attempt + 1 < maxTries) {
              logger.info(`Retrying after playback failure (${attempt + 2}/${maxTries})`);
              const result = await playAndGather(attempt + 1);
              resolve(result);
            } else {
              resolve({ digits, invalidDigits });
            }
          });
        } catch (err) {
          logger.error(`Playback error for call ${callId}: ${err.message}`);
          completeGathering();
          
          if (attempt + 1 < maxTries) {
            logger.info(`Retrying after error (${attempt + 2}/${maxTries})`);
            const result = await playAndGather(attempt + 1);
            resolve(result);
          } else {
            resolve({ digits, invalidDigits });
          }
        }
      });
    };

    const { digits, invalidDigits } = await playAndGather(0);

    if (callStates[callId]) {
      callStates[callId].dtmfDigits = digits;
      if (digits) {
        await sendCallback(callId, 'dtmf.gathered', { digits });
      }
      if (invalidDigits) {
        logger.info(`Invalid digits received: ${invalidDigits} for call ${callId}`);
      }
      logger.info(`DTMF gathering completed for call ${callId}: ${digits || 'no digits'}`);
    }

    return { digits, invalidDigits };

  } catch (err) {
    logger.error(`Error during DTMF gathering for call ${callId}:`, err);
    throw err;
  }
}

async function gatherAudio(audioUrl, maxDigits, validDigits = '0123456789*#', callId, maxTries = 3, timeoutMillis = 60000) {
  const client = await connectToAri();

  try {
    if (!callStates[callId]) {
      throw new Error(`Call state not found for call ID ${callId}`);
    }

    const channelId = callStates[callId].channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    let channel;
    try {
      channel = await client.channels.get({ channelId });
    } catch (err) {
      logger.error(`Failed to get channel ${channelId}: ${err.message}`);
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    const playAndGather = async (attempt = 0) => {
      if (!callStates[callId]) {
        return { digits: '', invalidDigits: '' };
      }
      
      if (attempt >= maxTries) {
        logger.info(`Max tries (${maxTries}) reached for call ${callId}`);
        await sendCallback(callId, 'maxretry.finished');
        return { digits: '', invalidDigits: '' };
      }

      logger.info(`Starting audio gather attempt ${attempt + 1}/${maxTries} for call ${callId}`);

      let digits = '';
      let invalidDigits = '';
      let isCompleted = false;
      let timeoutHandle = null;
      let dtmfHandler = null;
      let playbackFinished = false;

      if (callStates[callId].activeDtmfHandler) {
        channel.removeListener('ChannelDtmfReceived', callStates[callId].activeDtmfHandler);
        callStates[callId].activeDtmfHandler = null;
      }

      return new Promise(async (resolve) => {
        const completeGathering = () => {
          if (isCompleted) return;
          isCompleted = true;
          
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          
          if (dtmfHandler) {
            channel.removeListener('ChannelDtmfReceived', dtmfHandler);
          }
          callStates[callId].activeDtmfHandler = null;
        };

        dtmfHandler = async (event) => {
          if (!callStates[callId] || isCompleted) return;

          const digit = event.digit.toString();
          logger.info(`Received DTMF digit: ${digit} for call ${callId}`);

          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }

          if (validDigits.includes(digit)) {
            digits += digit;
            await sendCallback(callId, 'dtmf.entered', { digit });

            if (digits.length === maxDigits) {
              logger.info(`Collected ${maxDigits} digits for call ${callId}`);
              
              if (callStates[callId]?.playback) {
                try {
                  await callStates[callId].playback.stop();
                  logger.info(`Stopped playback after collecting ${maxDigits} digits`);
                } catch (err) {
                  if (!err.message?.includes('Playback not found')) {
                    logger.error(`Error stopping playback: ${err.message}`);
                  }
                }
                callStates[callId].playback = null;
              }
              
              completeGathering();
              resolve({ digits, invalidDigits });
            } else {
              if (playbackFinished) {
                timeoutHandle = setTimeout(() => {
                  if (!callStates[callId] || isCompleted) return;
                  logger.info(`Timeout after digit entry for call ${callId}`);
                  completeGathering();
                  resolve({ digits, invalidDigits });
                }, timeoutMillis);
              }
            }
          } else {
            invalidDigits += digit;
            await sendCallback(callId, 'dtmf.invalid', { digit });
            
            if (playbackFinished) {
              timeoutHandle = setTimeout(() => {
                if (!callStates[callId] || isCompleted) return;
                logger.info(`Timeout after invalid digit for call ${callId}`);
                completeGathering();
                resolve({ digits, invalidDigits });
              }, timeoutMillis);
            }
          }
        };

        callStates[callId].activeDtmfHandler = dtmfHandler;
        
        channel.on('ChannelDtmfReceived', dtmfHandler);
        logger.info(`DTMF listener attached for call ${callId}`);

        try {
          if (callStates[callId]?.playback) {
            try {
              await callStates[callId].playback.stop();
              callStates[callId].playback = null;
            } catch (err) {
              logger.debug(`Previous playback stop failed: ${err.message}`);
            }
          }

          const playback = await channel.play({ media: `sound:${audioUrl}` });
          callStates[callId].playback = playback;

          playback.on('PlaybackFinished', async () => {
            if (!callStates[callId] || isCompleted) return;
            
            logger.info(`Audio playback finished for call ${callId}, starting timeout of ${timeoutMillis}ms`);
            playbackFinished = true;
            callStates[callId].playback = null;

            timeoutHandle = setTimeout(async () => {
              if (!callStates[callId] || isCompleted) return;
              
              logger.info(`Timeout reached for call ${callId}`);
              completeGathering();

              if (digits === '' && attempt + 1 < maxTries) {
                logger.info(`No DTMF received, retrying (${attempt + 2}/${maxTries})`);
                const result = await playAndGather(attempt + 1);
                resolve(result);
              } else {
                if (digits === '' && attempt + 1 >= maxTries) {
                  await sendCallback(callId, 'maxretry.finished');
                }
                resolve({ digits, invalidDigits });
              }
            }, timeoutMillis);
          });

          playback.on('PlaybackFailed', async (err) => {
            logger.error(`Audio playback failed for call ${callId}: ${err.message}`);
            completeGathering();
            
            if (attempt + 1 < maxTries) {
              logger.info(`Retrying after playback failure (${attempt + 2}/${maxTries})`);
              const result = await playAndGather(attempt + 1);
              resolve(result);
            } else {
              await sendCallback(callId, 'playback.error', { error: err.message });
              resolve({ digits, invalidDigits });
            }
          });
        } catch (err) {
          logger.error(`Audio playback error for call ${callId}: ${err.message}`);
          completeGathering();
          
          if (attempt + 1 < maxTries) {
            logger.info(`Retrying after error (${attempt + 2}/${maxTries})`);
            const result = await playAndGather(attempt + 1);
            resolve(result);
          } else {
            await sendCallback(callId, 'playback.error', { error: err.message });
            resolve({ digits, invalidDigits });
          }
        }
      });
    };

    const { digits, invalidDigits } = await playAndGather(0);

    if (callStates[callId]) {
      callStates[callId].dtmfDigits = digits;
      if (digits) {
        await sendCallback(callId, 'dtmf.gathered', { digits });
      }
      if (invalidDigits) {
        logger.info(`Invalid digits received: ${invalidDigits} for call ${callId}`);
      }
      logger.info(`Audio DTMF gathering completed for call ${callId}: ${digits || 'no digits'}`);
    }

    return { digits, invalidDigits };

  } catch (err) {
    logger.error(`Error during audio DTMF gathering for call ${callId}:`, err);
    throw err;
  }
}

async function transferCall(callId, pstnNumber, from) {
  const client = await connectToAri();

  try {
    const channelId = callStates[callId]?.channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    if (callStates[callId].isOnHold) {
      logger.info(`Unholding call ${callId} before transfer`);
      await unholdCall(callId);
    }

    const originalChannel = await client.channels.get({ channelId });
    if (!originalChannel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    const totalTime = callStates[callId]?.totalTime || 300;

    const outboundChannel = await client.channels.originate({
      endpoint: `PJSIP/${pstnNumber}@39671`,
      callerId: from,
      app: 'myapp',
      context: 'steroid',
      appArgs: channelId,
      originator: channelId,
      priority: 1,
      timeout: 120,
    });

    logger.info(`Outbound channel created: ${outboundChannel.id} to PSTN number: ${pstnNumber}`);
    callStates[callId].outboundChannelId = outboundChannel.id;

    callStates[callId].dtmfDigitsA = '';
    callStates[callId].dtmfDigitsB = '';
    const maxDigits = 10;
    const terminatingDigits = ['#', '*'];

    let bridge;
    let bridgeEnded = false;

    await sendCallback(callId, 'bridging', { transferredTo: pstnNumber });

    const handleDtmfLegA = async (event) => {
      const digit = event.digit.toString();
      logger.info(`DTMF digit received from original channel: ${digit}`);
      await sendCallback(callId, 'dtmf.entered', { digit, leg: 'A' });

      callStates[callId].dtmfDigitsA += digit;

      if (terminatingDigits.includes(digit) || callStates[callId].dtmfDigitsA.length >= maxDigits) {
        await sendCallback(callId, 'dtmf.gathered', { digits: callStates[callId].dtmfDigitsA, leg: 'A' });
        callStates[callId].dtmfDigitsA = '';
      }
    };

    const handleDtmfLegB = async (event) => {
      const digit = event.digit.toString();
      logger.info(`DTMF digit received from transferred channel: ${digit}`);
      await sendCallback(callId, 'dtmf.entered', { digit, leg: 'B' });

      callStates[callId].dtmfDigitsB += digit;

      if (terminatingDigits.includes(digit) || callStates[callId].dtmfDigitsB.length >= maxDigits) {
        await sendCallback(callId, 'dtmf.gathered', { digits: callStates[callId].dtmfDigitsB, leg: 'B' });
        callStates[callId].dtmfDigitsB = '';
      }
    };

    originalChannel.on('ChannelDtmfReceived', handleDtmfLegA);
    outboundChannel.on('ChannelDtmfReceived', handleDtmfLegB);

    outboundChannel.on('StasisStart', async () => {
      try {
        bridge = await client.bridges.create({ type: 'mixing' });
        callStates[callId].bridgeId = bridge.id;
        
        await bridge.addChannel({ channel: [channelId, outboundChannel.id] });
        logger.info(`Channels bridged: ${channelId} and ${outboundChannel.id}`);
        
        callStates[callId].status = 'bridged';
        await sendCallback(callId, 'bridged', { transferredTo: pstnNumber });
      } catch (err) {
        logger.error(`Error creating bridge: ${err.message}`);
      }
    });

    outboundChannel.on('ChannelStateChange', async (event) => {
      if (event.channel.state === 'Up') {
        logger.info(`Transfer call answered: ${outboundChannel.id}`);
        
        if (callStates[callId].timeoutId) {
          clearTimeout(callStates[callId].timeoutId);
          delete callStates[callId].timeoutId;
        }
      }
    });

    const endBridge = async () => {
      if (!bridgeEnded) {
        bridgeEnded = true;
        await sendCallback(callId, 'bridged.ended', { transferredTo: pstnNumber });
      }
    };

    originalChannel.on('ChannelDestroyed', async () => {
      logger.info(`Original channel ${originalChannel.id} ended`);
      
      if (outboundChannel) {
        try {
          await outboundChannel.hangup();
        } catch (err) {
          logger.error(`Error hanging up transferred channel: ${err.message}`);
        }
      }

      if (bridge) {
        try {
          await bridge.destroy();
        } catch (err) {
          logger.error(`Error destroying bridge: ${err.message}`);
        }
      }

      await endBridge();
      originalChannel.removeListener('ChannelDtmfReceived', handleDtmfLegA);
    });

    outboundChannel.on('ChannelDestroyed', async () => {
      logger.info(`Transferred call ended: ${outboundChannel.id}`);
      
      if (originalChannel) {
        try {
          await originalChannel.hangup();
        } catch (err) {
          logger.error(`Error hanging up original channel: ${err.message}`);
        }
      }

      if (bridge) {
        try {
          await bridge.destroy();
        } catch (err) {
          logger.error(`Error destroying bridge: ${err.message}`);
        }
      }

      await endBridge();
      outboundChannel.removeListener('ChannelDtmfReceived', handleDtmfLegB);
    });

    callStates[callId].transferredTo = pstnNumber;
    callStates[callId].timeoutId = setTimeout(async () => {
      try {
        if (callStates[callId]?.status === 'bridged') {
          await hangupCall(callId);
          logger.info(`Call ${callId} ended after ${totalTime} seconds timeout`);
        }
      } catch (err) {
        logger.error(`Error ending call on timeout: ${err.message}`);
      }
    }, totalTime * 1000);

  } catch (err) {
    logger.error(`Error transferring call ${callId}: ${err.message}`);
    throw err;
  }
}

async function gatherDtmfOnTransfer(callId) {
  const client = await connectToAri();

  try {
    const outboundChannelId = callStates[callId]?.outboundChannelId;
    if (!outboundChannelId) {
      throw new Error(`Outbound channel not found for call ID ${callId}`);
    }

    const outboundChannel = await client.channels.get({ channelId: outboundChannelId });
    if (!outboundChannel) {
      throw new Error(`Outbound channel with ID ${outboundChannelId} not found`);
    }

    let digits = '';
    let isCompleted = false;

    const gatherPromise = new Promise((resolve) => {
      outboundChannel.on('ChannelDtmfReceived', async (event) => {
        const digit = event.digit.toString();
        await sendCallback(callId, 'dtmf.entered', { digit });

        digits += digit;
        if (digit === '#' || digit === '*') {
          isCompleted = true;
          resolve(digits);
        }
      });
    });

    const collectedDigits = await gatherPromise;
    logger.info(`Collected DTMF digits: ${collectedDigits} for call ${callId}`);

    if (isCompleted) {
      outboundChannel.removeAllListeners('ChannelDtmfReceived');
    }

    callStates[callId].dtmfDigits = collectedDigits;
    await sendCallback(callId, 'dtmf.gathered', { digits: collectedDigits });
  } catch (err) {
    logger.error('Error during DTMF gathering for transferred call:', err);
    throw err;
  }
}

async function holdCall(callId) {
  const client = await connectToAri();
  
  try {
    if (!callStates[callId]) {
      throw new Error(`Call state not found for call ID ${callId}`);
    }

    if (callStates[callId].isOnHold) {
      logger.info(`Call ${callId} is already on hold`);
      return;
    }

    const channelId = callStates[callId].channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    const channel = await client.channels.get({ channelId });
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    if (callStates[callId].playback) {
      try {
        await callStates[callId].playback.stop();
        callStates[callId].playback = null;
      } catch (err) {
        logger.warn(`Could not stop current playback: ${err.message}`);
      }
    }

    if (callStates[callId].playbackQueue) {
      callStates[callId].playbackQueue = [];
    }

    const playHoldMusic = async () => {
      try {
        if (!callStates[callId] || !callStates[callId].isOnHold) {
          return;
        }

        const playback = await channel.play({ media: 'sound:hold' });
        callStates[callId].holdPlayback = playback;

        playback.once('PlaybackFinished', async () => {
          if (callStates[callId] && callStates[callId].isOnHold) {
            await playHoldMusic();
          }
        });

        playback.once('PlaybackFailed', (err) => {
          logger.error(`Hold music playback failed for call ${callId}: ${err.message}`);
          if (callStates[callId] && callStates[callId].isOnHold) {
            setTimeout(() => playHoldMusic(), 1000);
          }
        });
      } catch (err) {
        logger.error(`Error playing hold music for call ${callId}: ${err.message}`);
        if (callStates[callId] && callStates[callId].isOnHold) {
          setTimeout(() => playHoldMusic(), 1000);
        }
      }
    };

    callStates[callId].isOnHold = true;
    callStates[callId].holdStartTime = new Date();
    callStates[callId].previousStatus = callStates[callId].status;
    callStates[callId].status = 'hold';

    await playHoldMusic();

    await sendCallback(callId, 'hold');
    
    logger.info(`Call ${callId} put on hold successfully`);
  } catch (err) {
    logger.error(`Error holding call ${callId}: ${err.message}`);
    throw err;
  }
}

async function unholdCall(callId) {
  const client = await connectToAri();
  
  try {
    if (!callStates[callId]) {
      throw new Error(`Call state not found for call ID ${callId}`);
    }

    if (!callStates[callId].isOnHold) {
      logger.info(`Call ${callId} is not on hold`);
      return;
    }

    const channelId = callStates[callId].channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    const channel = await client.channels.get({ channelId });
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    if (callStates[callId].holdPlayback) {
      try {
        await callStates[callId].holdPlayback.stop();
        logger.info(`Stopped hold music for call ${callId}`);
      } catch (err) {
        logger.debug(`Hold music stop error (likely already stopped): ${err.message}`);
      }
      callStates[callId].holdPlayback = null;
    }

    if (callStates[callId].holdStartTime) {
      const holdEndTime = new Date();
      const holdDuration = holdEndTime - callStates[callId].holdStartTime;
      callStates[callId].totalHoldDuration = (callStates[callId].totalHoldDuration || 0) + holdDuration;
      logger.info(`Call ${callId} was on hold for ${holdDuration}ms`);
    }

    callStates[callId].isOnHold = false;
    callStates[callId].holdStartTime = null;
    callStates[callId].status = callStates[callId].previousStatus || 'active';
    delete callStates[callId].previousStatus;

    await sendCallback(callId, 'unhold');
    
    logger.info(`Call ${callId} taken off hold successfully`);
  } catch (err) {
    logger.error(`Error unholding call ${callId}: ${err.message}`);
    throw err;
  }
}

async function hangupCall(callId) {
  const client = await connectToAri();
  try {
    const channelId = callStates[callId]?.channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${callId}`);
    }

    const channel = await client.channels.get({ channelId });
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    await channel.hangup();
    logger.info(`Hangup initiated for call ${callId}`);
  } catch (err) {
    logger.error('Error hanging up call:', err);
    throw err;
  }
}

const startMixMonitorRecording = async (channelId, callId, timeout) => {
  try {
    const recordingFilename = `mixmonitor-${callId}`;
    const recordingOptions = {
      channelId: channelId,
      name: recordingFilename,
      format: 'wav',
      recordingFormat: 'wav',
      beep: true,
      ifExists: 'overwrite',
      terminateOn: 'any',
      recordingDir: '/var/spool/asterisk/recording',
    };
    await ariClient.channels.record(recordingOptions);
    console.log(`MixMonitor recording started for call ${callId}`);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        ariClient.channels.record({
          channelId: channelId,
          name: recordingFilename,
          action: 'stop',
        });
        resolve(`/var/spool/asterisk/recording/${recordingFilename}`);
      }, timeout * 1000);

      ariClient.once('RecordingFinished', (event) => {
        console.log(`RecordingFinished event: ${JSON.stringify(event.recording)}`);
        if (event.recording.name === recordingFilename) {
          console.log(`MixMonitor recording finished for call ${callId}`);
          clearTimeout(timeoutId);
          resolve(`/var/spool/asterisk/recording/${recordingFilename}`);
        }
      });

      ariClient.once('RecordingFailed', (event) => {
        console.error(`Recording failed for call ${callId}:`, event);
        clearTimeout(timeoutId);
        reject(new Error(`Recording failed for call ${callId}`));
      });
    });
  } catch (err) {
    console.error(`Error starting MixMonitor recording for call ${callId}:`, err);
    throw err;
  }
};

async function startSpeechRecognition(callId) {
  const audioFilePath = `/var/spool/asterisk/recording/mixmonitor-${callId}.wav`;
  const maxRetries = 3;
  let currentRetry = 0;
  
  async function attemptRecognition() {
    try {
      console.log(`Processing file: ${audioFilePath}`);
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found at path: ${audioFilePath}`);
      }
      await delay(1000);
      const stats = fs.statSync(audioFilePath);
      console.log(`Audio file size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Audio file is empty');
      }
      const audioBuffer = fs.readFileSync(audioFilePath);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      const subscriptionKey = config.azureSpeech.apiKey;
      const serviceRegion = config.azureSpeech.region;
      const form = new FormData();
      form.append('audio', audioBlob, {
        filename: `mixmonitor-${callId}.wav`,
        contentType: 'audio/wav'
      });
      form.append('definition', JSON.stringify({
        locales: ["en-IN"]
      }));

      console.log('Form data contents:', {
        hasAudio: form.has('audio'),
        hasDefinition: form.has('definition'),
        audioSize: audioBuffer.length
      });

      try {
        const response = await axios.post(
          `https://${serviceRegion}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`,
          form,
          {
            headers: {
              'Ocp-Apim-Subscription-Key': subscriptionKey,
              'Content-Type': 'multipart/form-data',
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 30000
          }
        );

        if (response.data && response.data.combinedPhrases && response.data.combinedPhrases[0]) {
          const transcription = response.data.combinedPhrases[0].text;
          console.log(`Received transcription: ${transcription}`);
          await sendCallback(callId, 'alpha.gathered', { transcription: transcription || 'No Data' });
        } else {
          console.log('No transcription data received');
          await sendCallback(callId, 'alpha.gathered', { transcription: 'No Data' });
        }
      } catch (error) {
        if (error.response?.status === 429) {
          currentRetry++;
          if (currentRetry < maxRetries) {
            const backoffDelay = Math.min(Math.pow(2, currentRetry) * 1000, 10000);
            console.log(`Rate limited. Retrying in ${backoffDelay}ms (attempt ${currentRetry + 1}/${maxRetries})`);
            await delay(backoffDelay);
            return attemptRecognition();
          }
        }
        throw error;
      }
    } catch (err) {
      console.error(`Error during speech recognition for call ${callId}:`, err);
      
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
        console.error('Response headers:', err.response.headers);
      }

      try {
        const stats = fs.statSync(audioFilePath);
        console.error('Audio file stats:', {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          permissions: stats.mode.toString(8)
        });
        const headerBuffer = Buffer.alloc(44);
        const fd = fs.openSync(audioFilePath, 'r');
        fs.readSync(fd, headerBuffer, 0, 44, 0);
        fs.closeSync(fd);
        
        console.error('WAV header (first 44 bytes):', headerBuffer.toString('hex'));
        console.error('RIFF check:', headerBuffer.slice(0, 4).toString());
        console.error('Format check:', headerBuffer.slice(8, 12).toString());
        console.error('Subformat check:', headerBuffer.slice(12, 16).toString());
        
      } catch (statErr) {
        console.error('Error getting file stats:', statErr);
      }

      await sendCallback(callId, 'speech.error', { error: err.message });
      throw err;
    }
  }

  return attemptRecognition();
}

// AI Assistant Functions
async function initializeAiAssistant(callId, config) {
  try {
    const openai = new OpenAI({
      apiKey: require('./config').openai.apiKey,
    });

    await openai.models.list().catch(err => {
      throw new Error(`Invalid OpenAI API key in server config: ${err.message}`);
    });

    aiAssistantStates[callId] = {
      assistant_id: config.id || `asst_${Date.now()}`,
      openai: openai,
      instructions: config.instructions,
      voice: config.voice,
      voice_settings: config.voice_settings || {},
      greeting: config.greeting,
      interruption_enabled: config.interruption_settings?.enable !== false,
      transcription_model: config.transcription?.model || 'whisper-1',
      conversation_history: [],
      messages: [
        {
          role: 'system',
          content: config.instructions
        }
      ],
      isActive: true,
      isProcessing: false,
      isListening: false,
      currentPlayback: null,
      audioChunks: [],
      silenceTimer: null,
      speechStartTime: null,
      lastActivityTime: Date.now(),
      silenceThreshold: 1500,
      maxSilenceDuration: 30000,
      callbackUrl: config.callbackUrl,
      recordingActive: false,
      snoopChannel: null,
      recordingFilePath: null,
      processedAudioLength: 0,
    };

    logger.info(`AI Assistant initialized for call ${callId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to initialize AI Assistant for call ${callId}: ${error.message}`);
    throw error;
  }
}

async function processAiResponse(callId, userInput) {
  const state = aiAssistantStates[callId];
  if (!state || !state.isActive) return;

  if (state.isProcessing) {
    logger.warn(`AI already processing for call ${callId}, skipping`);
    return;
  }

  try {
    state.isProcessing = true;
    state.lastActivityTime = Date.now();

    state.messages.push({
      role: 'user',
      content: userInput
    });

    if (state.messages.length > 20) {
      state.messages = [
        state.messages[0],
        ...state.messages.slice(-19)
      ];
    }

    const completion = await Promise.race([
      state.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: state.messages,
        temperature: 0.7,
        max_tokens: 150,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI timeout')), 10000)
      )
    ]);

    const aiResponse = completion.choices[0].message.content;
    
    state.messages.push({
      role: 'assistant',
      content: aiResponse
    });

    const timestamp = getFormattedTimestamp();
    state.conversation_history.push({
      speaker: 'user',
      text: userInput,
      timestamp: timestamp
    });
    
    state.conversation_history.push({
      speaker: 'assistant',
      text: aiResponse,
      timestamp: timestamp
    });

    await sendCallback(callId, 'ai.transcribed', {
      speaker: 'user',
      text: userInput,
      timestamp: timestamp
    });

    await sendCallback(callId, 'ai.transcribed', {
      speaker: 'assistant',
      text: aiResponse,
      timestamp: timestamp
    });

    const ttsFilePath = await generateMultilingualTtsAudio(aiResponse, state.voice, callId);
    
    if (!callStates[callId].aiTtsFiles) {
      callStates[callId].aiTtsFiles = [];
    }
    callStates[callId].aiTtsFiles.push(ttsFilePath);
    
    await playAiAudio(ttsFilePath, callId);

  } catch (error) {
    logger.error(`Error processing AI response for call ${callId}: ${error.message}`);
    
    await sendCallback(callId, 'ai.error', {
      error: error.message,
      timestamp: getFormattedTimestamp()
    });
    
    if (state.isActive) {
      state.isProcessing = false;
      continueAiListening(callId);
    }
  }
}

async function playAiAudio(audioFilePath, callId) {
  const client = await connectToAri();
  const state = aiAssistantStates[callId];
  
  if (!state || !state.isActive || !callStates[callId]) return;

  try {
    const channelId = callStates[callId].channelId;
    const channel = await client.channels.get({ channelId });
    
    if (state.currentPlayback) {
      try {
        await state.currentPlayback.stop();
      } catch (err) {
        logger.debug(`Could not stop previous AI playback: ${err.message}`);
      }
    }
    
    const soundFile = path.basename(audioFilePath, '.wav');
    const playback = await channel.play({ media: `sound:${soundFile}` });
    
    state.currentPlayback = playback;
    state.isListening = false;
    
    playback.once('PlaybackFinished', async () => {
      state.currentPlayback = null;
      state.isProcessing = false;
      
      if (state.isActive) {
        await delay(100);
        continueAiListening(callId);
      }
    });

    playback.once('PlaybackFailed', async (err) => {
      logger.error(`AI playback failed for call ${callId}: ${err.message}`);
      state.currentPlayback = null;
      state.isProcessing = false;
      
      if (state.isActive) {
        continueAiListening(callId);
      }
    });

  } catch (error) {
    logger.error(`Error playing AI audio for call ${callId}: ${error.message}`);
    state.isProcessing = false;
  }
}

async function continueAiListening(callId) {
  const state = aiAssistantStates[callId];
  if (!state || !state.isActive || state.isListening) return;
  
  state.isListening = true;
  state.audioChunks = [];
  state.processedAudioLength = 0;
  
  logger.info(`AI continuing to listen for call ${callId}`);
}

async function processAudioChunk(callId) {
  const state = aiAssistantStates[callId];
  if (!state || !state.isActive || !state.isListening || state.isProcessing) return;

  try {
    const recordingPath = callStates[callId]?.recordingFilePath;
    if (!recordingPath || !fs.existsSync(recordingPath)) {
      logger.debug(`Recording file not found for AI processing: ${recordingPath}`);
      return;
    }

    const stats = fs.statSync(recordingPath);
    const currentLength = stats.size;
    
    if (currentLength <= state.processedAudioLength + 44) {
      return;
    }

    const newDataLength = currentLength - state.processedAudioLength;
    const buffer = Buffer.alloc(newDataLength);
    const fd = fs.openSync(recordingPath, 'r');
    fs.readSync(fd, buffer, 0, newDataLength, state.processedAudioLength);
    fs.closeSync(fd);
    
    state.processedAudioLength = currentLength;
    
    let hasVoice = false;
    for (let i = 0; i < buffer.length - 1; i += 2) {
      const sample = buffer.readInt16LE(i);
      if (Math.abs(sample) > 1000) {
        hasVoice = true;
        break;
      }
    }

    if (hasVoice) {
      if (!state.speechStartTime) {
        state.speechStartTime = Date.now();
        logger.info(`Speech started for AI call ${callId}`);
        
        if (state.currentPlayback && state.interruption_enabled) {
          try {
            await state.currentPlayback.stop();
            logger.info(`AI playback interrupted for call ${callId}`);
            state.currentPlayback = null;
          } catch (err) {
            logger.debug(`Could not stop AI playback: ${err.message}`);
          }
        }
      }
      
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer);
        state.silenceTimer = null;
      }
      
      state.audioChunks.push(buffer);
      
    } else if (state.speechStartTime && !state.silenceTimer) {
      state.silenceTimer = setTimeout(async () => {
        if (!state.isActive || state.isProcessing) return;
        
        const speechDuration = Date.now() - state.speechStartTime;
        if (speechDuration < 500) {
          logger.debug(`Speech too short (${speechDuration}ms), ignoring`);
          state.audioChunks = [];
          state.speechStartTime = null;
          state.silenceTimer = null;
          return;
        }
        
        logger.info(`Speech ended for AI call ${callId}, processing...`);
        state.isListening = false;
        
        try {
          const audioBuffer = Buffer.concat(state.audioChunks);
          
          const wavBuffer = createWavBuffer(audioBuffer, 8000, 1, 16);
          
          const transcription = await recognizeSpeechForAI(wavBuffer, callId);
          
          if (transcription && transcription.trim()) {
            logger.info(`AI transcribed for call ${callId}: "${transcription}"`);
            await processAiResponse(callId, transcription);
          } else {
            state.isProcessing = false;
            continueAiListening(callId);
          }
        } catch (err) {
          logger.error(`AI transcription error: ${err.message}`);
          state.isProcessing = false;
          
          if (err.message.includes('Rate limited')) {
            await delay(2000);
          }
          continueAiListening(callId);
        }
        
        state.audioChunks = [];
        state.speechStartTime = null;
        state.silenceTimer = null;
        
      }, state.silenceThreshold);
    }
    
    if (Date.now() - state.lastActivityTime > state.maxSilenceDuration) {
      logger.info(`Extended silence detected for AI call ${callId}, ending conversation`);
      await stopAiAssistant(callId, 'Extended silence - conversation ended');
    }
    
  } catch (error) {
    logger.error(`Error processing audio chunk for AI: ${error.message}`);
  }
}

async function stopAiAssistant(callId, reason = 'Manual stop') {
  const state = aiAssistantStates[callId];
  if (!state) return;

  try {
    logger.info(`Stopping AI assistant for call ${callId}: ${reason}`);
    
    state.isActive = false;
    state.isListening = false;
    
    if (state.currentPlayback) {
      try {
        await state.currentPlayback.stop();
      } catch (err) {
        logger.debug(`Could not stop AI playback during cleanup: ${err.message}`);
      }
    }
    
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
    }
    
    if (state.callbackUrl || callStates[callId]?.callbackUrl) {
      const callbackUrl = state.callbackUrl || callStates[callId].callbackUrl;
      try {
        await axios.post(callbackUrl, {
          state: 'ai.ended',
          call_id: callId,
          timestamp: getFormattedTimestamp(),
          reason: reason,
          conversation_history: state.conversation_history,
          total_interactions: Math.floor(state.conversation_history.length / 2),
          duration_seconds: Math.floor((Date.now() - (state.startTime || Date.now())) / 1000)
        }, {
          timeout: 5000
        });
      } catch (err) {
        logger.error(`Failed to send AI ended callback: ${err.message}`);
      }
    }
    
    if (callStates[callId]?.aiTtsFiles) {
      for (const file of callStates[callId].aiTtsFiles) {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            logger.debug(`Deleted AI TTS file: ${file}`);
          }
        } catch (err) {
          logger.error(`Failed to delete AI TTS file: ${err.message}`);
        }
      }
      delete callStates[callId].aiTtsFiles;
    }
    
    delete aiAssistantStates[callId];
    
    logger.info(`AI assistant stopped and cleaned up for call ${callId}`);
    
  } catch (error) {
    logger.error(`Error stopping AI assistant: ${error.message}`);
  }
}

// V2 API Routes
app.post('/v2/create-call', async (req, res) => {
  let { to_, from_, callbackurl, apikey, amd } = req.body;

  try {
    if (!to_ || !from_ || !callbackurl || !apikey) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    try {
      const decodedUrl = decodeURIComponent(callbackurl);
      new URL(decodedUrl);
      callbackurl = decodedUrl;
    } catch (err) {
      return res.status(400).json({ success: false, error: 'Invalid callback URL format' });
    }

    if (amd !== undefined) {
      if (typeof amd === 'string') {
        amd = amd.toLowerCase() === 'true';
      } else if (typeof amd !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'AMD must be a boolean value (true, false, "True", or "False").'
        });
      }
    }

    const user = await User.findOne({ where: { apikey } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }
    
    if (user.isDisabled) {
      return res.status(403).json({ success: false, error: 'API key is disabled' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, error: 'API key is banned' });
    }

    if (parseFloat(user.balance) < 1.00) {
      return res.status(402).json({ 
        success: false, 
        error: 'Insufficient balance. Minimum balance required is 1.00 USD'
      });
    }

    const callId = await createCall(to_, from_, callbackurl, apikey, amd);
    
    res.json({ success: true, call_id: callId });
    logger.info(`v2/create-call: Call created with ID ${callId}`);
    
  } catch (err) {
    logger.error('Error in create-call endpoint:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Failed to create call'
    });
  }
});

app.post('/v2/play-text', async (req, res) => {
  const { text, voice, call_id } = req.body;
  if (!text || !voice || !call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }
  try {
    if (!callStates[call_id]) {
      return res.status(404).json({ success: false, error: `Call ${call_id} not found` });
    }
    if (callStates[call_id].amd && !callStates[call_id].amdCompleted) {
      await queueAction(call_id, 'playText', { text, voice });
      res.json({ success: true, message: 'Action queued pending AMD completion' });
      logger.info(`v2/play-text: Play text action queued for call ${call_id}`);
    } else {
      await playText(text, voice, call_id);
      res.json({ success: true });
      logger.info(`v2/play-text: Text played for call ${call_id}`);
    }
  } catch (err) {
    logger.error('Error playing text:', err);
    res.status(500).json({ success: false, error: 'Failed to play text' });
  }
});

app.post('/v2/gather-text', async (req, res) => {
  const { text, voice, maxDigits, validDigits = '0123456789*#', call_id, maxTries = 3, timeoutMillis = 6000 } = req.body;

  if (!text || !voice || !maxDigits || !call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  try {
    if (!callStates[call_id]) {
      return res.status(404).json({ success: false, error: `Call ${call_id} not found` });
    }

    if (callStates[call_id].amd && !callStates[call_id].amdCompleted) {
      await queueAction(call_id, 'gatherText', {
        text,
        voice,
        maxDigits,
        validDigits,
        maxTries,
        timeoutMillis,
      });
      res.json({ success: true, message: 'Action queued pending AMD completion' });
      logger.info(`v2/gather-text: Gathering action queued for call ${call_id}`);
    } else {
      await gatherText(text, voice, maxDigits, validDigits, call_id, maxTries, timeoutMillis);
      res.json({ success: true });
      logger.info(`v2/gather-text: Gathering process initiated for call ${call_id}`);
    }
  } catch (err) {
    logger.error('Error initiating gathering process:', err);
    res.status(500).json({ success: false, error: 'Failed to initiate gathering process' });
  }
});

app.post('/v2/play-audio', async (req, res) => {
  const { audioUrl, call_id } = req.body;

  if (!audioUrl || !call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  try {
    if (!callStates[call_id]) {
      return res.status(404).json({ success: false, error: `Call ${call_id} not found` });
    }

    if (callStates[call_id].amd && !callStates[call_id].amdCompleted) {
      await queueAction(call_id, 'playAudio', { audioUrl });
      res.json({ success: true, message: 'Action queued pending AMD completion' });
      logger.info(`v2/play-audio: Play audio action queued for call ${call_id}`);
    } else {
      await playAudio(audioUrl, call_id);
      res.json({ success: true });
      logger.info(`v2/play-audio: Audio played for call ${call_id}`);
    }
  } catch (err) {
    logger.error('Error playing audio:', err);
    res.status(500).json({ success: false, error: 'Failed to play audio' });
  }
});

app.post('/v2/gather-audio', async (req, res) => {
  const { audioUrl, maxDigits, validDigits = '0123456789*#', call_id, maxTries = 3, timeoutMillis = 6000 } = req.body;

  if (!audioUrl || !maxDigits || !call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  try {
    if (!callStates[call_id]) {
      return res.status(404).json({ success: false, error: `Call ${call_id} not found` });
    }

    if (callStates[call_id].amd && !callStates[call_id].amdCompleted) {
      await queueAction(call_id, 'gatherAudio', {
        audioUrl,
        maxDigits,
        validDigits,
        maxTries,
        timeoutMillis,
      });
      res.json({ success: true, message: 'Action queued pending AMD completion' });
      logger.info(`v2/gather-audio: Audio gathering action queued for call ${call_id}`);
    } else {
      await gatherAudio(audioUrl, maxDigits, validDigits, call_id, maxTries, timeoutMillis);
      res.json({ success: true });
      logger.info(`v2/gather-audio: Audio gathering process initiated for call ${call_id}`);
    }
  } catch (err) {
    logger.error('Error initiating audio gathering process:', err);
    res.status(500).json({ success: false, error: 'Failed to initiate audio gathering process' });
  }
});

app.post('/v2/gather-alpha', async (req, res) => {
  let { call_id, timeout = 60 } = req.body;

  if (!call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: call_id' });
  }

  if (timeout < 1 || timeout > 60) {
    return res.status(400).json({ success: false, error: 'Timeout must be between 1 and 60 seconds' });
  }

  try {
    const channelId = callStates[call_id]?.channelId;
    if (!channelId) {
      throw new Error(`Channel not found for call ID ${call_id}`);
    }

    const recordingFilePath = await startMixMonitorRecording(channelId, call_id, timeout);
    await startSpeechRecognition(call_id, recordingFilePath);

    res.json({ success: true });
  } catch (err) {
    console.error('Error during speech recognition:', err);
    await sendCallback(call_id, 'speech.error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to recognize speech' });
  }
});

app.post('/v2/transfer', async (req, res) => {
  const { call_id, forward } = req.body;

  if (!call_id || !forward) {
    return res.status(400).json({ success: false, error: 'Missing required parameters: call_id, forward are required.' });
  }

  try {
    await transferCall(call_id, forward);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to transfer call', details: err.message });
  }
});

app.post('/v2/dtmf', async (req, res) => {
  const { call_id, maxDigits } = req.body;
  if (!call_id || !maxDigits) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }
  try {
    await gatherDtmfOnTransfer(call_id, maxDigits);
    res.json({ success: true });
    logger.info(`v2/dtmf: DTMF gathered for transferred call ${call_id}`);
  } catch (err) {
    logger.error('Error gathering DTMF on transferred call:', err);
    res.status(500).json({ success: false, error: 'Failed to gather DTMF' });
  }
});

app.post('/v2/hangup', async (req, res) => {
  const { call_id } = req.body;
  if (!call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameter' });
  }
  try {
    await hangupCall(call_id);
    res.json({ success: true });
    logger.info(`v2/hangup: Call hung up`);
  } catch (err) {
    logger.error('Error hanging up call:', err);
    res.status(500).json({ success: false, error: 'Failed to hang up call' });
  }
});

app.post('/v2/hold', async (req, res) => {
  const { call_id } = req.body;
  if (!call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: call_id' });
  }
  try {
    await holdCall(call_id);
    res.json({ success: true });
    logger.info(`v2/hold: Call ${call_id} put on hold`);
  } catch (err) {
    logger.error('Error holding call:', err);
    res.status(500).json({ success: false, error: 'Failed to hold call' });
  }
});

app.post('/v2/unhold', async (req, res) => {
  const { call_id } = req.body;
  if (!call_id) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: call_id' });
  }
  try {
    await unholdCall(call_id);
    res.json({ success: true });
    logger.info(`v2/unhold: Call ${call_id} taken off hold`);
  } catch (err) {
    logger.error('Error unholding call:', err);
    res.status(500).json({ success: false, error: 'Failed to unhold call' });
  }
});

app.post('/v2/start-ai', async (req, res) => {
  const { assistant, voice, voice_settings, greeting, interruption_settings, transcription, call_id, callbackUrl } = req.body;

  try {
    if (!assistant?.instructions || !voice || !greeting || !call_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: assistant.instructions, voice, greeting, and call_id are required' 
      });
    }

    if (!callStates[call_id]) {
      return res.status(404).json({ 
        success: false, 
        error: `Call ${call_id} not found or not active` 
      });
    }

    if (callStates[call_id].status !== 'answered' && callStates[call_id].status !== 'bridged') {
      return res.status(400).json({ 
        success: false, 
        error: `Call ${call_id} must be answered before starting AI assistant` 
      });
    }

    if (aiAssistantStates[call_id]) {
      return res.status(400).json({ 
        success: false, 
        error: `AI assistant already active for call ${call_id}` 
      });
    }

    const validVoices = [
      'en-US-JennyMultilingualNeural', 'en-US-RyanMultilingualNeural',
      'en-GB-LibbyNeural', 'en-GB-RyanNeural',
      'en-IN-NeerjaNeural', 'en-IN-PrabhatNeural',
      'en-AU-NatashaNeural', 'en-AU-WilliamNeural',
      'en-CA-ClaraNeural', 'en-CA-LiamNeural'
    ];
    
    if (!validVoices.includes(voice)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid voice. Supported voices: ${validVoices.join(', ')}` 
      });
    }

    await initializeAiAssistant(call_id, {
      id: assistant.id || `asst_${Date.now()}`,
      instructions: assistant.instructions,
      voice: voice,
      voice_settings: voice_settings || {},
      greeting: greeting,
      interruption_settings: interruption_settings || { enable: true },
      transcription: transcription || { model: 'whisper-1' },
      callbackUrl: callbackUrl || callStates[call_id].callbackUrl,
    });

    aiAssistantStates[call_id].startTime = Date.now();

    await sendCallback(call_id, 'ai.started', {
      timestamp: getFormattedTimestamp()
    });

    try {
      const greetingAudio = await generateMultilingualTtsAudio(greeting, voice, call_id);
      
      if (!callStates[call_id].aiTtsFiles) {
        callStates[call_id].aiTtsFiles = [];
      }
      callStates[call_id].aiTtsFiles.push(greetingAudio);
      
      await playAiAudio(greetingAudio, call_id);

      const timestamp = getFormattedTimestamp();
      aiAssistantStates[call_id].conversation_history.push({
        speaker: 'assistant',
        text: greeting,
        timestamp: timestamp
      });

      await sendCallback(call_id, 'ai.transcribed', {
        speaker: 'assistant',
        text: greeting,
        timestamp: timestamp
      });

      const monitoringInterval = setInterval(async () => {
        if (!aiAssistantStates[call_id] || !aiAssistantStates[call_id].isActive) {
          clearInterval(monitoringInterval);
          return;
        }
        await processAudioChunk(call_id);
      }, 100);

      aiAssistantStates[call_id].monitoringInterval = monitoringInterval;

    } catch (error) {
      await stopAiAssistant(call_id, `Startup error: ${error.message}`);
      throw error;
    }

    res.json({ 
      success: true, 
      message: 'AI assistant started successfully',
      assistant_id: aiAssistantStates[call_id].assistant_id
    });

    logger.info(`AI assistant started for call ${call_id}`);

  } catch (error) {
    logger.error('Error starting AI assistant:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to start AI assistant: ${error.message}` 
    });
  }
});

app.post('/v2/stop-ai', async (req, res) => {
  const { call_id, callbackUrl } = req.body;

  try {
    if (!call_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameter: call_id' 
      });
    }

    const state = aiAssistantStates[call_id];
    if (!state) {
      return res.status(404).json({ 
        success: false, 
        error: `AI assistant not found for call ${call_id}` 
      });
    }

    const conversationHistory = [...state.conversation_history];
    const totalInteractions = Math.floor(conversationHistory.length / 2);
    
    if (state.monitoringInterval) {
      clearInterval(state.monitoringInterval);
    }

    await stopAiAssistant(call_id, 'API request');

    res.json({ 
      success: true, 
      message: 'AI assistant stopped successfully',
      conversation_history: conversationHistory,
      total_interactions: totalInteractions
    });

    logger.info(`AI assistant stopped via API for call ${call_id}`);

  } catch (error) {
    logger.error('Error stopping AI assistant:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to stop AI assistant: ${error.message}` 
    });
  }
});

app.get('/recording', async (req, res) => {
  const callId = req.query.call_id;
  if (!callId) {
    return res.status(400).json({ error: 'Missing call_id parameter' });
  }
  const recordingPath = `/var/spool/asterisk/recording/${callId}.wav`;
  try {
    if (fs.existsSync(recordingPath)) {
      logger.info(`Downloading recording file: ${recordingPath}`);
      res.download(recordingPath, `${callId}.wav`);
    } else {
      logger.error(`Recording not found: ${recordingPath}`);
      res.status(404).json({ error: 'Recording not found' });
    }
  } catch (err) {
    logger.error('Error fetching recording:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch recording' });
  }
});

app.post('/v2/balance', async (req, res) => {
  const { apikey } = req.body;

  if (!apikey) {
    return res.status(400).json({ success: false, error: 'API key is required.' });
  }

  try {
    const user = await User.findOne({
      where: { apikey },
      attributes: ['balance', 'totalCalls', 'failedCalls', 'currency'],
    });

    if (user) {
      res.json({
        success: true,
        data: {
          balance: user.balance,
          totalCalls: user.totalCalls,
          failedCalls: user.failedCalls,
          currency: user.currency,
        },
      });
    } else {
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error fetching API key details:', error);
    res.status(500).json({ success: false, error: 'An error occurred while fetching API key details.' });
  }
});

app.get('/v2/health', async (req, res) => {
  try {
    const ariConnected = await checkAriConnection(ariClient);
    const dbConnected = await sequelize.authenticate().then(() => true).catch(() => false);
    
    const health = {
      status: ariConnected && dbConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        ari: ariConnected ? 'connected' : 'disconnected',
      }
    };
    
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// Use web API router
app.use('/', webApiRouter);

// Cleanup function
async function cleanupAllActiveCalls() {
  logger.info('Cleaning up all active calls before shutdown...');
  
  try {
    const activeCalls = await CallState.findAll({
      where: {
        status: { [Sequelize.Op.in]: ['initiated', 'answered', 'bridging', 'machine', 'notsure'] },
        endTime: null
      }
    });
    
    logger.info(`Found ${activeCalls.length} active calls to clean up`);
    
    for (const call of activeCalls) {
      try {
        if (callStates[call.callId] && callStates[call.callId].channelId && ariClient) {
          try {
            const channel = await ariClient.channels.get({ 
              channelId: callStates[call.callId].channelId 
            });
            await channel.hangup({ reason: 'SYSTEM_SHUTDOWN' });
          } catch (err) {
            logger.debug(`Channel already gone for call ${call.callId}`);
          }
        }
        
        call.status = 'terminated';
        call.endTime = new Date();
        await call.save();
        
        if (callStates[call.callId] && callStates[call.callId].callbackUrl) {
          await sendCallback(call.callId, 'terminated', {
            reason: 'System shutdown'
          });
        }
        
        logger.info(`Cleaned up call ${call.callId}`);
      } catch (err) {
        logger.error(`Error cleaning up call ${call.callId}: ${err.message}`);
      }
    }
    
    Object.keys(callStates).forEach(callId => {
      delete callStates[callId];
    });
    
    logger.info('All active calls cleaned up');
  } catch (err) {
    logger.error('Error during cleanup:', err);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown...');
  await cleanupAllActiveCalls();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown...');
  await cleanupAllActiveCalls();
  process.exit(0);
});

process.on('beforeExit', async () => {
  logger.info('Process exiting, cleaning up...');
  await cleanupAllActiveCalls();
});

process.on('uncaughtException', async (err) => {
  logger.error('Uncaught exception:', err);
  await cleanupAllActiveCalls();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await cleanupAllActiveCalls();
  process.exit(1);
});

// Start server
sequelize.sync().then(async () => {
  logger.info('Cleaning up stale calls from previous session...');
  
  try {
    const staleCalls = await CallState.update(
      { 
        status: 'terminated',
        endTime: new Date()
      },
      {
        where: {
          status: { [Sequelize.Op.in]: ['initiated', 'answered', 'bridging', 'machine', 'notsure'] },
          endTime: null
        }
      }
    );
    
    logger.info(`Cleaned up ${staleCalls[0]} stale calls from previous session`);
  } catch (err) {
    logger.error('Error cleaning stale calls:', err);
  }
  
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    setInterval(() => deleteOldRecordingsAndAudioFiles(RECORDING_PATH, SOUNDS_DIR), 60 * 60 * 1000);
    setInterval(() => deleteOldCallLogs(CallState, logger), 24 * 60 * 60 * 1000);
    setInterval(() => cleanupExpiredPayments(PaymentTransaction, logger), 60 * 60 * 1000);
  });
}).catch(err => {
  logger.error('Failed to start server:', err);
});

module.exports = app;