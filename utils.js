const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');

// Delay utility
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Hangup cause descriptions
const hangupCauseDescriptions = {
  '16': 'Normal Clearing',
  '17': 'User Busy',
  '18': 'No User Response',
  '19': 'No Answer',
  '20': 'Subscriber Absent',
  '21': 'Call Rejected',
  '22': 'Number Changed',
  '23': 'Redirected to New Destination',
  '26': 'Answered Elsewhere',
  '27': 'Destination Out of Order',
  '28': 'Invalid Number Format',
  '29': 'Facility Rejected',
  '34': 'Circuit/Channel Congestion',
  '38': 'Network Out of Order',
  '41': 'Temporary Failure',
  '42': 'Switching Equipment Congestion',
  '43': 'Access Information Discarded',
  '44': 'Requested Channel Unavailable',
  '50': 'Requested Facility Not Subscribed',
  '52': 'Outgoing Call Barred',
  '54': 'Incoming Call Barred',
  '57': 'Bearer Capability Not Authorized',
  '58': 'Bearer Capability Not Available',
  '65': 'Bearer Capability Not Implemented',
  '66': 'Channel Type Not Implemented',
  '69': 'Requested Facility Not Implemented',
  '81': 'Invalid Call Reference',
  '88': 'Incompatible Destination',
  '95': 'Invalid Message Unspecified',
  '96': 'Mandatory IE Missing',
  '97': 'Message Type Nonexistent',
  '98': 'Wrong Message',
  '99': 'IE Nonexistent',
  '100': 'Invalid IE Contents',
  '101': 'Wrong Call State',
  '102': 'Recovery on Timer Expiry',
  '111': 'Protocol Error',
  '127': 'Interworking'
};

// Calculate billable duration based on billing increment
function calculateBillableDuration(actualSeconds, billingIncrement, minimumChargeableSeconds = 3) {
  if (actualSeconds <= minimumChargeableSeconds) return 0;
  const [initial, subsequent] = billingIncrement.split('/').map(Number);
  if (actualSeconds <= initial) {
    return initial;
  }
  
  const remainingSeconds = actualSeconds - initial;
  const additionalIncrements = Math.ceil(remainingSeconds / subsequent);
  
  return initial + (additionalIncrements * subsequent);
}

// Get billing increment name
function getBillingIncrementName(increment) {
  const commonNames = {
    '1/1': 'Per Second',
    '6/6': '6/6 Second',
    '30/30': '30/30 Second',
    '60/60': '60/60 Second (Per Minute)',
    '30/6': '30/6 Second',
    '60/6': '60/6 Second',
    '60/30': '60/30 Second'
  };
  return commonNames[increment] || increment;
}

// Verify NOWPayments signature
function verifyNowPaymentsSignature(payload, receivedSignature, ipnSecret) {
  const sortedKeys = Object.keys(payload).sort();
  const sortedPayload = {};
  sortedKeys.forEach(key => {
    if (payload[key] !== null && payload[key] !== undefined) {
      sortedPayload[key] = payload[key];
    }
  });
  
  const jsonString = JSON.stringify(sortedPayload);
  const calculatedSignature = crypto
    .createHmac('sha512', ipnSecret)
    .update(jsonString)
    .digest('hex');
  
  return calculatedSignature === receivedSignature;
}

// Generate secure order ID
function generateSecureOrderId(userId) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `${userId}-${timestamp}-${randomBytes}`;
}

// Get formatted timestamp
function getFormattedTimestamp() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  });
}

// Delete old files from directory
function deleteOldFiles(directory, excludeFile, deleteAfterHours = 12) {
  const now = Date.now();

  fs.readdir(directory, (err, files) => {
    if (err) {
      console.error(`Error reading directory ${directory}:`, err);
      return;
    }

    files.forEach((file) => {
      if (excludeFile && file === excludeFile) {
        return;
      }
      const filePath = path.join(directory, file);

      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Error getting stats for file ${filePath}:`, err);
          return;
        }

        if (stats.isFile()) {
          const fileExtension = path.extname(file).toLowerCase();
          const audioExtensions = ['.wav', '.mp3', '.ogg', '.flac']; 
          if (audioExtensions.includes(fileExtension)) {
            const fileAgeInHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
            if (fileAgeInHours > deleteAfterHours) {
              fs.unlink(filePath, (err) => {
                if (err) {
                  console.error(`Error deleting file ${filePath}:`, err);
                } else {
                  console.log(`Deleted old audio file: ${filePath}`);
                }
              });
            }
          }
        }
      });
    });
  });
}

// Delete old recordings and audio files
function deleteOldRecordingsAndAudioFiles(recordingPath, soundsDir) {
  deleteOldFiles(recordingPath);
  deleteOldFiles(soundsDir, 'hold.wav');
}

// Delete old call logs
async function deleteOldCallLogs(CallState, logger) {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const deletedCount = await CallState.destroy({
      where: {
        startTime: {
          [Sequelize.Op.lt]: twoWeeksAgo,
        },
      },
    });

    logger.info(`Deleted ${deletedCount} call logs older than 2 weeks`);
  } catch (error) {
    logger.error('Error deleting old call logs:', error);
  }
}

// Calculate balance cut for a call
async function calculateBalanceCut(startTime, endTime, countryCode, CountryPrice, logger) {
  if (!startTime || !endTime) return 0;
  
  try {
    const actualSeconds = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
    if (actualSeconds <= 0) {
      return 0;
    }
    
    const countryPrice = await CountryPrice.findOne({ where: { countryCode } });
    if (countryPrice) {
      const billableSeconds = calculateBillableDuration(actualSeconds, countryPrice.billingIncrement || '1/1');
      return parseFloat((billableSeconds * countryPrice.pricePerSecond).toFixed(4));
    } else {
      logger.warn(`Price not found for country code: ${countryCode}`);
      return 0;
    }
  } catch (error) {
    logger.error('Error calculating balance cut:', error);
    return 0;
  }
}

// Get price per second for a country
async function getPricePerSecond(countryCode, CountryPrice, logger) {
  try {
    const countryPrice = await CountryPrice.findOne({ where: { countryCode } });
    if (countryPrice) {
      return countryPrice.pricePerSecond;
    } else {
      logger.warn(`Price not found for country code: ${countryCode}`);
      return 0;
    }
  } catch (error) {
    logger.error('Error retrieving country price:', error);
    return 0;
  }
}

// Cleanup expired payments
async function cleanupExpiredPayments(PaymentTransaction, logger) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const expiredPayments = await PaymentTransaction.findAll({
      where: {
        status: 'waiting',
        createdAt: { [Sequelize.Op.lt]: oneDayAgo }
      }
    });

    for (const payment of expiredPayments) {
      payment.status = 'expired';
      await payment.save();
      
      logger.info(`Marked payment ${payment.paymentId} as expired`);
    }
  } catch (error) {
    logger.error('Error cleaning up expired payments:', error);
  }
}

// Helper function to create WAV buffer with header
function createWavBuffer(audioData, sampleRate, channels, bitsPerSample) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = audioData.length;
  const bufferSize = 44 + dataSize;
  
  const buffer = Buffer.alloc(bufferSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(bufferSize - 8, 4);
  buffer.write('WAVE', 8);
  
  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  audioData.copy(buffer, 44);
  
  return buffer;
}

module.exports = {
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
};