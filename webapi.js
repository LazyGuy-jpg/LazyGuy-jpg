const express = require('express');
const router = express.Router();
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

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
  isAdmin
} = require('./helpers');
const {
  calculateBillableDuration,
  getBillingIncrementName,
  verifyNowPaymentsSignature,
  generateSecureOrderId,
  calculateBalanceCut,
  getPricePerSecond
} = require('./utils');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Payment limiter
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 payment requests per 15 minutes
  message: 'Too many payment requests, please try again later'
});

// Public routes
router.get('/', (req, res) => {
  res.render('index.html');
});

router.get('/login', (req, res) => {
  res.render('login.html');
});

router.get('/about', (req, res) => {
  res.render('about.html');
});

router.post('/login', async (req, res) => {
  const { apikey } = req.body;
  try {
    const user = await User.findOne({ where: { apikey } });
    if (user) {
      req.session.user = user;
      await UserLog.create({
        userId: user.id,
        action: 'User Login',
        details: 'User logged in',
      });
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid API key. Please try again.' });
    }
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again later.' });
  }
});

router.post('/validate-apikey', async (req, res) => {
  const { apikey } = req.body;

  try {
    const user = await User.findOne({ where: { apikey } });
    res.json({ success: user ? true : false });
  } catch (error) {
    logger.error('Error during API key validation:', error);
    res.status(500).json({ success: false, error: 'An error occurred. Please try again later.' });
  }
});

router.get('/logout', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    req.session.destroy(async (err) => {
      if (err) {
        logger.error('Error logging out:', err);
        res.status(500).send('Error logging out.');
      } else {
        await UserLog.create({
          userId: userId,
          action: 'User Logout',
          details: 'User logged out',
        });
        res.redirect('/login');
      }
    });
  } catch (error) {
    logger.error('Error during logout:', error);
    res.status(500).send('An error occurred while logging out.');
  }
});

// Authenticated user routes
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.user.id);
    if (user) {
      res.render('dashboard.html', { balance: user.balance, status: req.query.status || null });
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    logger.error('Error loading dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

router.get('/topup', isAuthenticated, (req, res) => {
  try {
    res.render('topup.html');
  } catch (error) {
    logger.error('Error rendering topup page:', error);
    res.status(500).send('An error occurred while loading the topup page.');
  }
});

router.get('/prices', isAuthenticated, (req, res) => {
  try {
    res.render('price-list.html');
  } catch (error) {
    logger.error('Error rendering price list:', error);
    res.status(500).send('An error occurred while loading the price list.');
  }
});

router.get('/user/data', isAuthenticated, async (req, res) => {
  try {
    logger.info(`Fetching user data for session user: ${JSON.stringify(req.session.user)}`);
    const user = await User.findOne({ where: { apikey: req.session.user.apikey } });
    if (!user) {
      logger.warn(`User not found for apikey: ${req.session.user.apikey}`);
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const responseData = {
      success: true,
      id: user.id,
      apiKey: user.apikey,
      username: user.username,
      profilePic: user.profilePic,
      telegramUsername: user.telegramUsername,
      totalCalls: user.totalCalls,
      failedCalls: user.failedCalls,
      balance: user.balance,
      currency: user.currency,
      concurrentCalls: user.concurrentCalls
    };
    logger.info(`Sending user data: ${JSON.stringify(responseData)}`);
    res.json(responseData);
  } catch (error) {
    logger.error('Error fetching user data:', error);
    res.status(500).json({ success: false, error: 'Error fetching user data.' });
  }
});

router.get('/user/history', isAuthenticated, async (req, res) => {
  try {
    res.render('user-logs.html');
  } catch (error) {
    logger.error('Error rendering user logs:', error);
    res.status(500).send('Error retrieving logs.');
  }
});

router.get('/api/user-logs', isAuthenticated, async (req, res, next) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
    const whereCondition = { userId: req.session.user.id };
    if (search) {
      whereCondition[Sequelize.Op.or] = [
        { action: { [Sequelize.Op.like]: `%${search}%` } },
        { details: { [Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    const { count: totalLogs, rows: logs } = await UserLog.findAndCountAll({
      where: whereCondition,
      offset,
      limit: parseInt(limit),
      order: [['timestamp', 'DESC']],
    });

    if (totalLogs === 0) {
      return res.status(404).json({ success: false, error: 'No user logs found.' });
    }

    const formattedLogs = logs.map(log => ({
      action: log.action,
      details: log.details,
      timestamp: log.timestamp,
    }));

    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        total: totalLogs,
        page: parseInt(page),
        pages: Math.ceil(totalLogs / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching user logs:', error);
    res.status(500).json({ success: false, error: 'Error fetching user logs.' });
  }
});

router.get('/user/calls', isAuthenticated, async (req, res) => {
  res.render('usercall-logs.html');
});

router.get('/api/call-logs', isAuthenticated, async (req, res) => {
  const { page = 1, limit = 20, toNumber = '', fromNumber = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const sessionUser = req.session.user;
    if (!sessionUser) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const user = await User.findOne({ where: { apikey: sessionUser.apikey } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const whereCondition = { userId: user.id };
    
    if (toNumber || fromNumber) {
      whereCondition[Sequelize.Op.or] = [];
      if (toNumber) {
        whereCondition[Sequelize.Op.or].push({ toNumber: { [Sequelize.Op.like]: `%${toNumber}%` } });
      }
      if (fromNumber) {
        whereCondition[Sequelize.Op.or].push({ fromNumber: { [Sequelize.Op.like]: `%${fromNumber}%` } });
      }
    }

    logger.info(`Fetching call logs for user ${user.id} with conditions:`, whereCondition);

    const { count: totalLogs, rows: logs } = await CallState.findAndCountAll({
      where: whereCondition,
      offset: offset,
      limit: parseInt(limit),
      order: [['startTime', 'DESC']],
      attributes: ['callId', 'toNumber', 'fromNumber', 'startTime', 'endTime', 'countryCode', 'status'],
    });

    logger.info(`Found ${totalLogs} call logs for user ${user.id}`);

    if (totalLogs === 0) {
      return res.json({
        success: true,
        data: {
          logs: [],
          total: 0,
          page: parseInt(page),
          pages: 0,
        },
      });
    }

    const formattedLogs = await Promise.all(logs.map(async (log) => {
      const actualTime = log.endTime && log.startTime ? Math.floor((log.endTime - log.startTime) / 1000) : 0;
      
      let billableTime = 0;
      let balanceCut = 0;
      let pricePerMinute = 0;
      let billingIncrement = '1/1';
      
      try {
        const countryPrice = await CountryPrice.findOne({ where: { countryCode: log.countryCode } });
        
        if (countryPrice) {
          pricePerMinute = (countryPrice.pricePerSecond * 60).toFixed(3);
          billingIncrement = countryPrice.billingIncrement || '1/1';
          
          if ((log.status === 'completed' || log.status === 'answered') && actualTime > 0) {
            billableTime = calculateBillableDuration(actualTime, billingIncrement);
            balanceCut = billableTime * countryPrice.pricePerSecond;
          }
        }
      } catch (err) {
        logger.error(`Error calculating pricing for call ${log.callId}:`, err);
      }
      
      return {
        callId: log.callId,
        toNumber: log.toNumber || 'N/A',
        fromNumber: log.fromNumber || 'N/A',
        countryCode: log.countryCode || 'N/A',
        status: log.status || 'unknown',
        actualTime,
        billableTime,
        billingIncrement,
        pricePerMinute,
        balanceCut: balanceCut.toFixed(4),
      };
    }));

    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        total: totalLogs,
        page: parseInt(page),
        pages: Math.ceil(totalLogs / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching call logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'An error occurred while fetching call logs',
      details: error.message 
    });
  }
});

router.get('/user/country-prices', isAuthenticated, async (req, res) => {
  try {
    const countryPrices = await CountryPrice.findAll();
    res.json(countryPrices);
  } catch (error) {
    logger.error('Error retrieving country prices for user:', error);
    res.status(500).json({ success: false, error: 'Error retrieving country prices.' });
  }
});

router.get('/user/settings', isAuthenticated, (req, res) => {
  try {
    res.render('settings.html');
  } catch (error) {
    logger.error('Error rendering settings page:', error);
    res.status(500).send('An error occurred while loading the settings page.');
  }
});

router.get('/api-docs', isAuthenticated, (req, res) => {
  try {
    res.render('api-docs.html');
  } catch (error) {
    logger.error('Error rendering API docs page:', error);
    res.status(500).send('An error occurred while loading the API docs page.');
  }
});

router.post('/user/update-profile-pic', isAuthenticated, upload.single('profilePic'), async (req, res) => {
  try {
    const user = await User.findOne({ where: { apikey: req.session.user.apikey } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    if (req.file) {
      user.profilePic = `/uploads/${req.file.filename}`;
      await user.save();
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
  } catch (error) {
    logger.error('Error updating profile picture:', error);
    res.status(500).json({ success: false, error: 'Error updating profile picture.' });
  }
});

router.post('/user/update-settings', isAuthenticated, async (req, res) => {
  const { telegramUsername, username } = req.body;
  try {
    const user = await User.findOne({ where: { apikey: req.session.user.apikey } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    user.telegramUsername = telegramUsername || user.telegramUsername;
    user.username = username || user.username;
    await user.save();
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Error updating settings.' });
  }
});

router.get('/user/announcements', isAuthenticated, async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      order: [['postedAt', 'DESC']],
    });
    res.json(announcements);
  } catch (error) {
    logger.error('Error fetching announcements for user:', error);
    res.status(500).json({ success: false, error: 'Error fetching announcements.' });
  }
});

router.get('/user/update-notices', isAuthenticated, async (req, res) => {
  try {
    const notices = await UpdateNotice.findAll({
      order: [['postedAt', 'DESC']],
    });
    res.json(notices);
  } catch (error) {
    logger.error('Error fetching update notices for user:', error);
    res.status(500).json({ success: false, error: 'Error fetching update notices.' });
  }
});

router.get('/user/chat/messages', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const messages = await ChatMessage.findAll({
      where: { userId: user.id },
      order: [['sentAt', 'ASC']],
      attributes: ['id', 'sender', 'message', 'sentAt']
    });
    res.json(messages);
  } catch (error) {
    logger.error('Error fetching user chat messages:', error);
    res.status(500).json({ success: false, error: 'Error fetching messages.' });
  }
});

router.post('/user/chat/send', isAuthenticated, async (req, res) => {
  const { message } = req.body;
  try {
    const user = req.session.user;
    const chatMessage = await ChatMessage.create({
      userId: user.id,
      sender: 'user',
      message,
    });
    
    await UserLog.create({
      userId: user.id,
      action: 'Chat Message Sent',
      details: `User sent message: ${message.substring(0, 50)}...`,
    });
    
    res.json({ success: true, chatMessage });
  } catch (error) {
    logger.error('Error sending chat message:', error);
    res.status(500).json({ success: false, error: 'Error sending message.' });
  }
});

// Payment routes
router.get('/payment-currencies', isAuthenticated, async (req, res) => {
  try {
    const supportedCurrencies = ['btc', 'eth', 'bnbmainnet', 'usdterc20', 'usdttrc20', 'ltc'];
    
    res.json({
      success: true,
      currencies: supportedCurrencies
    });
    
  } catch (error) {
    console.error('Error in payment currencies endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch payment currencies' 
    });
  }
});

router.post('/create-payment', [isAuthenticated, paymentLimiter], async (req, res) => {
  const { amount, payCurrency = 'btc' } = req.body;
  const user = req.session.user;

  if (!amount || amount < config.nowpayments.minTopup) {
    return res.status(400).json({ 
      success: false, 
      error: `Minimum top-up amount is $${config.nowpayments.minTopup}` 
    });
  }

  if (amount > 10000) {
    return res.status(400).json({ 
      success: false, 
      error: 'Maximum top-up amount is $10,000' 
    });
  }

  let transaction;
  try {
    const orderId = generateSecureOrderId(user.id);
    const transactionId = uuidv4();

    transaction = await PaymentTransaction.create({
      transactionId,
      userId: user.id,
      paymentId: 'pending',
      orderId,
      amount: parseFloat(amount),
      currency: 'USD',
      payCurrency,
      status: 'waiting',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    const paymentData = {
      price_amount: parseFloat(amount),
      price_currency: 'usd',
      pay_currency: payCurrency,
      order_id: orderId,
      order_description: `Balance top-up for user ${user.username || user.apikey}`,
      ipn_callback_url: config.nowpayments.callbackUrl,
      success_url: `${config.apiBaseUrl}/dashboard?payment=success`,
      cancel_url: `${config.apiBaseUrl}/topup?payment=cancelled`
    };

    const response = await axios.post(
      'https://api.nowpayments.io/v1/payment',
      paymentData,
      {
        headers: {
          'x-api-key': config.nowpayments.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    transaction.paymentId = response.data.payment_id.toString();
    transaction.payAddress = response.data.pay_address;
    transaction.payAmount = response.data.pay_amount;
    await transaction.save();

    await UserLog.create({
      userId: user.id,
      action: 'Payment Initiated',
      details: `Initiated ${payCurrency.toUpperCase()} payment for $${amount}`
    });

    res.json({
      success: true,
      paymentUrl: response.data.payment_url,
      paymentId: response.data.payment_id,
      payAddress: response.data.pay_address,
      payAmount: response.data.pay_amount,
      payCurrency: response.data.pay_currency,
      expirationDate: response.data.expiration_estimate_date
    });

  } catch (error) {
    logger.error('Error creating payment:', error.response?.data || error);
    
    if (transaction) {
      await transaction.destroy();
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create payment. Please try again.' 
    });
  }
});

router.post('/nowpayments-ipn', async (req, res) => {
  const signature = req.headers['x-nowpayments-sig'];
  const payload = req.body;

  logger.info(`NOWPayments IPN received for payment ${payload.payment_id}`);

  if (!verifyNowPaymentsSignature(payload, signature, config.nowpayments.ipnSecret)) {
    logger.error('Invalid NOWPayments IPN signature');
    return res.status(400).send('Invalid signature');
  }

  try {
    const transaction = await PaymentTransaction.findOne({
      where: { 
        paymentId: payload.payment_id.toString(),
        orderId: payload.order_id
      },
      include: [{ model: User }]
    });

    if (!transaction) {
      logger.error(`Transaction not found for payment ${payload.payment_id}`);
      return res.status(404).send('Transaction not found');
    }

    if (transaction.status === 'finished' && payload.payment_status === 'finished') {
      logger.info(`Payment ${payload.payment_id} already processed`);
      return res.status(200).send('OK');
    }

    const previousStatus = transaction.status;
    transaction.status = payload.payment_status;
    transaction.actuallyPaid = payload.actually_paid || payload.pay_amount;
    transaction.updatedAt = new Date();

    switch (payload.payment_status) {
      case 'finished':
        const expectedAmount = transaction.amount;
        const paidAmountUSD = parseFloat(payload.price_amount);
        const tolerance = 0.01;

        if (Math.abs(paidAmountUSD - expectedAmount) > tolerance) {
          logger.error(`Payment amount mismatch for ${payload.payment_id}. Expected: ${expectedAmount}, Paid: ${paidAmountUSD}`);
          transaction.amount = paidAmountUSD;
        }

        const user = transaction.User;
        const previousBalance = parseFloat(user.balance);
        const creditAmount = paidAmountUSD;
        
        user.balance = (previousBalance + creditAmount).toFixed(2);
        await user.save();

        transaction.completedAt = new Date();
        await transaction.save();

        await UserLog.create({
          userId: user.id,
          action: 'Payment Completed',
          details: `Payment ${payload.payment_id} completed. Added ${creditAmount} to balance. New balance: ${user.balance}`
        });

        await AdminLog.create({
          action: 'Payment Received',
          details: `User ${user.username || user.apikey} topped up ${creditAmount} via ${payload.pay_currency}`
        });

        logger.info(`Payment ${payload.payment_id} completed successfully. User ${user.id} balance updated from ${previousBalance} to ${user.balance}`);
        break;

      case 'partially_paid':
        await transaction.save();
        
        await UserLog.create({
          userId: transaction.userId,
          action: 'Payment Partially Paid',
          details: `Payment ${payload.payment_id} partially paid. Expected: ${payload.pay_amount}, Received: ${payload.actually_paid}`
        });
        
        logger.warn(`Payment ${payload.payment_id} partially paid`);
        break;

      case 'expired':
      case 'failed':
      case 'refunded':
        await transaction.save();
        
        await UserLog.create({
          userId: transaction.userId,
          action: `Payment ${payload.payment_status}`,
          details: `Payment ${payload.payment_id} ${payload.payment_status}`
        });
        
        logger.info(`Payment ${payload.payment_id} ${payload.payment_status}`);
        break;

      default:
        await transaction.save();
        logger.info(`Payment ${payload.payment_id} status updated to ${payload.payment_status}`);
    }

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Error processing NOWPayments IPN:', error);
    res.status(500).send('Internal error');
  }
});

router.get('/payment-status/:paymentId', isAuthenticated, async (req, res) => {
  const { paymentId } = req.params;
  const user = req.session.user;

  try {
    const transaction = await PaymentTransaction.findOne({
      where: { 
        paymentId: paymentId,
        userId: user.id
      }
    });

    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        error: 'Payment not found' 
      });
    }

    if (transaction.status !== 'finished' && transaction.status !== 'failed' && transaction.status !== 'expired') {
      try {
        const response = await axios.get(
          `https://api.nowpayments.io/v1/payment/${paymentId}`,
          {
            headers: {
              'x-api-key': config.nowpayments.apiKey
            }
          }
        );

        if (response.data.payment_status !== transaction.status) {
          const ipnPayload = {
            payment_id: response.data.payment_id,
            payment_status: response.data.payment_status,
            pay_address: response.data.pay_address,
            price_amount: response.data.price_amount,
            price_currency: response.data.price_currency,
            pay_amount: response.data.pay_amount,
            pay_currency: response.data.pay_currency,
            order_id: response.data.order_id,
            order_description: response.data.order_description,
            actually_paid: response.data.actually_paid,
            outcome_amount: response.data.outcome_amount,
            outcome_currency: response.data.outcome_currency
          };

          const signature = crypto
            .createHmac('sha512', config.nowpayments.ipnSecret)
            .update(JSON.stringify(ipnPayload))
            .digest('hex');

          await axios.post(`${config.apiBaseUrl}/nowpayments-ipn`, ipnPayload, {
            headers: {
              'x-nowpayments-sig': signature
            }
          });
        }
      } catch (error) {
        logger.error('Error checking payment status with NOWPayments:', error);
      }
    }

    res.json({
      success: true,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      payCurrency: transaction.payCurrency,
      payAmount: transaction.payAmount,
      actuallyPaid: transaction.actuallyPaid,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt
    });

  } catch (error) {
    logger.error('Error checking payment status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check payment status' 
    });
  }
});

router.get('/payment-history', isAuthenticated, async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const user = req.session.user;

  try {
    const { count: total, rows: transactions } = await PaymentTransaction.findAndCountAll({
      where: { userId: user.id },
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        transactions: transactions.map(t => ({
          paymentId: t.paymentId,
          amount: t.amount,
          currency: t.currency,
          payCurrency: t.payCurrency,
          status: t.status,
          createdAt: t.createdAt,
          completedAt: t.completedAt
        })),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching payment history:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch payment history' 
    });
  }
});

// Admin routes
router.get('/admin', (req, res) => {
  res.render('admin.html');
});

router.post('/admin', (req, res) => {
  const { secret } = req.body;
  if (secret === config.ADMIN_SECRET) {
    req.session.admin = true;
    AdminLog.create({
      action: 'Admin Login',
      details: 'Admin logged in',
    });
    res.redirect('/admin/dashboard');
  } else {
    res.status(401).send('Invalid secret key.');
  }
});

router.get('/admin/dashboard', isAdmin, (req, res) => {
  try {
    res.render('admin-dashboard.html');
  } catch (error) {
    logger.error('Error rendering admin dashboard:', error);
    res.status(500).send('An error occurred while loading the admin dashboard.');
  }
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(async (err) => {
    if (err) {
      logger.error('Error logging out:', err);
      res.status(500).send('Error logging out.');
    } else {
      await AdminLog.create({
        action: 'Admin Logout',
        details: 'Admin logged out',
      });
      res.redirect('/admin');
    }
  });
});

router.get('/admin/create-apikey', isAdmin, (req, res) => {
  try {
    res.render('create-apikey.html');
  } catch (error) {
    logger.error('Error rendering create API key page:', error);
    res.status(500).send('Error loading create API key page.');
  }
});

router.post('/admin/create-apikey', isAdmin, async (req, res) => {
  try {
    const newApiKey = generateApiKey();
    const user = await User.create({ 
      apikey: newApiKey,
      concurrentCalls: 10
    });
    logger.info(`New API key created for user ${user.id} and saved to the database.`);
    await AdminLog.create({
      action: 'Create API Key',
      details: `New API key created: ${newApiKey}`,
    });
    res.json({ success: true, apikey: newApiKey });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ success: false, error: 'Error creating API key.' });
  }
});

router.get('/admin/api-keys', isAdmin, async (req, res) => {
  try {
    const apiKeys = await User.findAll({
      attributes: ['username', 'apikey', 'totalCalls', 'failedCalls', 'balance', 'currency', 'concurrentCalls', 'isDisabled', 'isBanned'],
    });
    if (!apiKeys.length) {
      return res.status(404).json({ success: false, error: 'No API keys found.' });
    }
    res.json(apiKeys);
  } catch (error) {
    logger.error('Error retrieving API keys:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve API keys: ' + error.message });
  }
});

router.put('/admin/api-keys/:apiKey/disable', isAdmin, async (req, res) => {
  const { apiKey } = req.params;
  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      user.isDisabled = true;
      await user.save();
      await AdminLog.create({
        action: 'Disable API Key',
        details: `API key disabled: ${apiKey}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error disabling API key:', error);
    res.status(500).json({ success: false, error: 'Error disabling API key.' });
  }
});

router.put('/admin/api-keys/:apiKey/enable', isAdmin, async (req, res) => {
  const { apiKey } = req.params;
  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      user.isDisabled = false;
      await user.save();
      await AdminLog.create({
        action: 'Enable API Key',
        details: `API key enabled: ${apiKey}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error enabling API key:', error);
    res.status(500).json({ success: false, error: 'Error enabling API key.' });
  }
});

router.put('/admin/api-keys/:apiKey/ban', isAdmin, async (req, res) => {
  const { apiKey } = req.params;
  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      user.isBanned = !user.isBanned;
      await user.save();
      await AdminLog.create({
        action: user.isBanned ? 'Ban API Key' : 'Unban API Key',
        details: `API key ${user.isBanned ? 'banned' : 'unbanned'}: ${apiKey}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error toggling ban status for API key:', error);
    res.status(500).json({ success: false, error: 'Error toggling ban status for API key.' });
  }
});

router.put('/admin/api-keys/:apiKey/username', isAdmin, async (req, res) => {
  const { apiKey } = req.params;
  const { username } = req.body;

  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      const previousUsername = user.username;
      user.username = username || 'User';
      await user.save();
      await AdminLog.create({
        action: 'Update Username',
        details: `API key: ${apiKey}, Previous Username: ${previousUsername}, New Username: ${user.username}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error updating username:', error);
    res.status(500).json({ success: false, error: 'Error updating username.' });
  }
});

router.put('/admin/api-keys/:apiKey/balance', isAdmin, async (req, res) => {
  const { apiKey } = req.params;
  const { balance } = req.body;
  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      const previousBalance = user.balance;
      user.balance = balance;
      await user.save();
      await AdminLog.create({
        action: 'Update Balance',
        details: `API key: ${apiKey}, Previous Balance: ${previousBalance}, New Balance: ${balance}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error updating balance:', error);
    res.status(500).json({ success: false, error: 'Error updating balance.' });
  }
});

router.put('/admin/api-keys/:apiKey/concurrent-calls', isAdmin, async (req, res) => {
  const { apiKey } = req.params;
  const { concurrentCalls } = req.body;

  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      const previousConcurrentCalls = user.concurrentCalls;
      user.concurrentCalls = concurrentCalls;
      await user.save();
      await AdminLog.create({
        action: 'Update Concurrent Calls',
        details: `API key: ${apiKey}, Previous Concurrent Calls: ${previousConcurrentCalls}, New Concurrent Calls: ${concurrentCalls}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error updating concurrent calls:', error);
    res.status(500).json({ success: false, error: 'Error updating concurrent calls.' });
  }
});

router.delete('/admin/api-keys/:apiKey', isAdmin, async (req, res) => {
  const { apiKey } = req.params;
  try {
    const user = await User.findOne({ where: { apikey: apiKey } });
    if (user) {
      await UserLog.destroy({ where: { userId: user.id } });
      await CallState.destroy({ where: { userId: user.id } });
      await user.destroy();
      await AdminLog.create({
        action: 'Delete API Key',
        details: `API key deleted: ${apiKey}`,
      });
      res.json({ success: true });
    } else {
      logger.warn(`API key not found for deletion: ${apiKey}`);
      res.status(404).json({ success: false, error: 'API key not found.' });
    }
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({ success: false, error: 'An error occurred while deleting the API key.' });
  }
});

router.get('/admin/action/logs', isAdmin, async (req, res) => {
  try {
    const logs = await AdminLog.findAll({ order: [['timestamp', 'DESC']] });
    res.render('admin-action-logs.html', { logs });
  } catch (error) {
    logger.error('Error retrieving admin logs:', error);
    res.status(500).send('Error retrieving logs.');
  }
});

router.get('/admin/stats', isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'totalCalls', 'failedCalls'],
    });

    let totalSuccessCalls = 0;
    let totalFailedCalls = 0;
    let totalApiKeys = users.length;

    users.forEach(user => {
      totalSuccessCalls += user.totalCalls || 0;
      totalFailedCalls += user.failedCalls || 0;
    });

    const callStates = await CallState.findAll({
      attributes: ['id', 'status'],
    });
    const completedCalls = callStates.filter(call => call.status === 'completed').length;
    logger.info(`Verified completed calls from CallState: ${completedCalls}`);

    res.json({
      success: true,
      totalSuccessCalls: totalSuccessCalls,
      totalFailedCalls: totalFailedCalls,
      totalApiKeys: totalApiKeys,
    });
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats: ' + error.message });
  }
});

router.get('/admin/call-logs', isAdmin, (req, res) => {
  try {
    res.render('admin-logs.html');
  } catch (error) {
    logger.error('Error rendering admin call logs page:', error);
    res.status(500).send('Error loading admin call logs page.');
  }
});

router.get('/admin/api/call-logs', isAdmin, async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
    const whereCondition = {};
    if (search) {
      whereCondition[Sequelize.Op.or] = [
        { '$User.apikey$': { [Sequelize.Op.like]: `%${search}%` } },
        { toNumber: { [Sequelize.Op.like]: `%${search}%` } },
        { fromNumber: { [Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    const { count: totalLogs, rows: logs } = await CallState.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User,
          attributes: ['apikey'],
          required: true,
        },
      ],
      offset,
      limit: parseInt(limit),
      order: [['startTime', 'DESC']],
      attributes: ['callId', 'toNumber', 'fromNumber', 'startTime', 'endTime', 'countryCode', 'status'],
    });

    if (totalLogs === 0) {
      return res.status(404).json({ success: false, error: 'No call logs found.' });
    }

    const formattedLogs = await Promise.all(logs.map(async (log) => {
      let balanceCut = 0;
      let totalTime = 0;
      
      if (log.status === 'completed' || log.status === 'answered') {
        totalTime = log.endTime && log.startTime ? Math.floor((log.endTime - log.startTime) / 1000) : 0;
        if (totalTime > 0) {
          balanceCut = await calculateBalanceCut(log.startTime, log.endTime, log.countryCode, CountryPrice, logger);
        }
      }
      
      return {
        apikey: log.User.apikey,
        callId: log.callId,
        toNumber: log.toNumber,
        fromNumber: log.fromNumber,
        countryCode: log.countryCode,
        status: log.status,
        totalTime,
        balanceCut,
      };
    }));

    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        total: totalLogs,
        page: parseInt(page),
        pages: Math.ceil(totalLogs / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching admin call logs:', error);
    res.status(500).json({ success: false, error: 'An error occurred while fetching call logs.' });
  }
});

router.get('/admin/country-price', isAdmin, async (req, res) => {
  try {
    res.render('country-price.html');
  } catch (error) {
    logger.error('Error rendering country price page:', error);
    res.status(500).send('An error occurred while loading the country price page.');
  }
});

router.get('/admin/country-prices', isAdmin, async (req, res) => {
  try {
    const countryPrices = await CountryPrice.findAll();
    res.json(countryPrices);
  } catch (error) {
    logger.error('Error retrieving country prices:', error);
    res.status(500).json({ success: false, error: 'Error retrieving country prices.' });
  }
});

router.post('/admin/country-prices', isAdmin, async (req, res) => {
  const { countryCode, countryName, pricePerSecond, billingIncrement = '1/1' } = req.body;
  
  if (!/^\d+\/\d+$/.test(billingIncrement)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid billing increment format. Use format like "6/6", "30/30", etc.' 
    });
  }
  
  try {
    const billingIncrementName = getBillingIncrementName(billingIncrement);
    
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('CountryPrices');
    
    const countryPriceData = {
      countryCode, 
      countryName, 
      pricePerSecond
    };
    
    if (tableInfo.billingIncrement) {
      countryPriceData.billingIncrement = billingIncrement;
    }
    if (tableInfo.billingIncrementName) {
      countryPriceData.billingIncrementName = billingIncrementName;
    }
    
    await CountryPrice.create(countryPriceData);
    
    await AdminLog.create({
      action: 'Create Country Price',
      details: `Country: ${countryName} (${countryCode}), Price: ${pricePerSecond}/sec, Billing: ${billingIncrement}`,
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error adding country price:', error);
    res.status(500).json({ success: false, error: 'Error adding country price.', details: error.message });
  }
});

router.put('/admin/country-prices/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  const { countryCode, countryName, pricePerSecond, billingIncrement = '1/1' } = req.body;

  if (!/^\d+\/\d+$/.test(billingIncrement)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid billing increment format. Use format like "6/6", "30/30", etc.' 
    });
  }

  try {
    const countryPrice = await CountryPrice.findByPk(id);
    if (countryPrice) {
      const oldValues = {
        countryCode: countryPrice.countryCode,
        pricePerSecond: countryPrice.pricePerSecond,
        billingIncrement: countryPrice.billingIncrement || '1/1'
      };
      
      countryPrice.countryCode = countryCode;
      countryPrice.countryName = countryName;
      countryPrice.pricePerSecond = pricePerSecond;
      
      const queryInterface = sequelize.getQueryInterface();
      const tableInfo = await queryInterface.describeTable('CountryPrices');
      
      if (tableInfo.billingIncrement) {
        countryPrice.billingIncrement = billingIncrement;
      }
      if (tableInfo.billingIncrementName) {
        countryPrice.billingIncrementName = getBillingIncrementName(billingIncrement);
      }
      
      await countryPrice.save();
      
      await AdminLog.create({
        action: 'Update Country Price',
        details: `Country: ${countryName} (${countryCode}), Old: ${oldValues.pricePerSecond}/sec ${oldValues.billingIncrement}, New: ${pricePerSecond}/sec ${billingIncrement}`,
      });
      
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Country price not found.' });
    }
  } catch (error) {
    logger.error('Error updating country price:', error);
    res.status(500).json({ success: false, error: 'Error updating country price.' });
  }
});

router.delete('/admin/country-prices/:countryCode', isAdmin, async (req, res) => {
  const { countryCode } = req.params;
  try {
    const countryPrice = await CountryPrice.findOne({ where: { countryCode } });
    if (countryPrice) {
      await countryPrice.destroy();
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Country price not found.' });
    }
  } catch (error) {
    logger.error('Error deleting country price:', error);
    res.status(500).json({ success: false, error: 'Error deleting country price.' });
  }
});

router.delete('/admin/country-prices/:id', isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    logger.info(`Attempting to delete country price with ID: ${id}`);
    const countryPrice = await CountryPrice.findByPk(id);
    if (countryPrice) {
      logger.info(`Found country price with ID: ${id}, deleting...`);
      await countryPrice.destroy();
      logger.info(`Successfully deleted country price with ID: ${id}`);
      res.json({ success: true });
    } else {
      logger.warn(`Country price with ID ${id} not found`);
      res.status(404).json({ success: false, error: 'Country price not found.' });
    }
  } catch (error) {
    logger.error('Error deleting country price:', error);
    res.status(500).json({ success: false, error: 'Error deleting country price.' });
  }
});

router.get('/admin/announcements', isAdmin, async (req, res) => {
  try {
    const announcements = await Announcement.findAll({
      order: [['postedAt', 'DESC']],
    });
    res.json(announcements);
  } catch (error) {
    logger.error('Error fetching announcements:', error);
    res.status(500).json({ success: false, error: 'Error fetching announcements.' });
  }
});

router.post('/admin/announcements', isAdmin, async (req, res) => {
  const { title, content } = req.body;
  try {
    const announcement = await Announcement.create({ title, content });
    await AdminLog.create({
      action: 'Create Announcement',
      details: `Announcement created: ${title}`,
    });
    res.json({ success: true, announcement });
  } catch (error) {
    logger.error('Error creating announcement:', error);
    res.status(500).json({ success: false, error: 'Error creating announcement.' });
  }
});

router.delete('/admin/announcements/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const announcement = await Announcement.findByPk(id);
    if (announcement) {
      await announcement.destroy();
      await AdminLog.create({
        action: 'Delete Announcement',
        details: `Announcement deleted: ${announcement.title}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Announcement not found.' });
    }
  } catch (error) {
    logger.error('Error deleting announcement:', error);
    res.status(500).json({ success: false, error: 'Error deleting announcement.' });
  }
});

router.get('/admin/chats/:userId', isAdmin, async (req, res) => {
  const { userId } = req.params;
  try {
    const messages = await ChatMessage.findAll({
      where: { userId },
      order: [['sentAt', 'ASC']],
      include: [{ model: User, attributes: ['username', 'apikey'] }],
    });
    res.json(messages);
  } catch (error) {
    logger.error('Error fetching chat messages:', error);
    res.status(500).json({ success: false, error: 'Error fetching chat messages.' });
  }
});

router.get('/admin/chats', isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'apikey'],
      include: [{ model: ChatMessage, attributes: ['id'], required: true }],
      group: ['User.id'],
    });
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users with chats:', error);
    res.status(500).json({ success: false, error: 'Error fetching users with chats.' });
  }
});

router.post('/admin/chats/:userId', isAdmin, async (req, res) => {
  const { userId } = req.params;
  const { message } = req.body;
  try {
    const chatMessage = await ChatMessage.create({
      userId,
      sender: 'admin',
      message,
    });
    await AdminLog.create({
      action: 'Send Chat Message',
      details: `Message sent to user ${userId}: ${message}`,
    });
    res.json({ success: true, chatMessage });
  } catch (error) {
    logger.error('Error sending chat message:', error);
    res.status(500).json({ success: false, error: 'Error sending chat message.' });
  }
});

router.get('/admin/update-notices', isAdmin, async (req, res) => {
  try {
    const notices = await UpdateNotice.findAll({
      order: [['postedAt', 'DESC']],
    });
    res.json(notices);
  } catch (error) {
    logger.error('Error fetching update notices:', error);
    res.status(500).json({ success: false, error: 'Error fetching update notices.' });
  }
});

router.post('/admin/update-notices', isAdmin, async (req, res) => {
  const { title, content, type } = req.body;
  try {
    const notice = await UpdateNotice.create({ title, content, type });
    await AdminLog.create({
      action: `Create ${type === 'notice' ? 'Notice' : 'Patch'}`,
      details: `${type === 'notice' ? 'Notice' : 'Patch'} created: ${title}`,
    });
    res.json({ success: true, notice });
  } catch (error) {
    logger.error('Error creating update notice:', error);
    res.status(500).json({ success: false, error: 'Error creating update notice.' });
  }
});

router.delete('/admin/update-notices/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const notice = await UpdateNotice.findByPk(id);
    if (notice) {
      await notice.destroy();
      await AdminLog.create({
        action: `Delete ${notice.type === 'notice' ? 'Notice' : 'Patch'}`,
        details: `${notice.type === 'notice' ? 'Notice' : 'Patch'} deleted: ${notice.title}`,
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Update notice not found.' });
    }
  } catch (error) {
    logger.error('Error deleting update notice:', error);
    res.status(500).json({ success: false, error: 'Error deleting update notice.' });
  }
});

router.get('/admin/payment-transactions', isAdmin, async (req, res) => {
  const { page = 1, limit = 20, status = '', userId = '' } = req.query;
  const offset = (page - 1) * limit;

  try {
    const whereCondition = {};
    if (status) whereCondition.status = status;
    if (userId) whereCondition.userId = userId;

    const { count: total, rows: transactions } = await PaymentTransaction.findAndCountAll({
      where: whereCondition,
      include: [{
        model: User,
        attributes: ['username', 'apikey', 'balance']
      }],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        transactions,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching admin payment transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch payment transactions' 
    });
  }
});

module.exports = router;