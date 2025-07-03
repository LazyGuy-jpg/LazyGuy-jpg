const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config');

// Initialize Sequelize with MySQL
const sequelize = new Sequelize(
  config.db.database,
  config.db.username,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    dialectOptions: config.db.dialectOptions,
    pool: config.db.pool,
    logging: config.db.logging,
    benchmark: config.db.benchmark,
    define: config.db.define,
    retry: {
      max: 3,
      timeout: 30000,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ETIMEDOUT/,
        /ECONNRESET/,
        /ECONNREFUSED/
      ]
    }
  }
);

// User model with indexes
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  apikey: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    validate: {
      len: [32, 64]
    }
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'Default'
  },
  profilePic: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: 'https://via.placeholder.com/100?text=A'
  },
  telegramUsername: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  totalCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  failedCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  balance: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0.0000,
    get() {
      const value = this.getDataValue('balance');
      return value ? Number(value).toFixed(4) : "0.0000";
    },
    set(value) {
      this.setDataValue('balance', parseFloat(value).toFixed(4));
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
    validate: {
      isIn: [['USD', 'EUR', 'GBP', 'CAD', 'AUD']]
    }
  },
  concurrentCalls: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
    validate: {
      min: 1,
      max: 1000
    }
  },
  isDisabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isBanned: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  indexes: [
    { unique: true, fields: ['apikey'] },
    { fields: ['isDisabled', 'isBanned'] },
    { fields: ['balance'] },
    { fields: ['createdAt'] }
  ],
  tableName: 'users'
});

// Admin log model
const AdminLog = sequelize.define('AdminLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['timestamp'] },
    { fields: ['action'] }
  ],
  tableName: 'admin_logs'
});

// User log model with optimized indexes
const UserLog = sequelize.define('UserLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  indexes: [
    { fields: ['userId', 'timestamp'] },
    { fields: ['action'] },
    { fields: ['timestamp'] }
  ],
  tableName: 'user_logs'
});

// Country price model with optimized structure
const CountryPrice = sequelize.define('CountryPrice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  countryCode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true
  },
  countryName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  pricePerSecond: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  billingIncrement: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '1/1',
    validate: {
      is: /^\d+\/\d+$/
    }
  },
  billingIncrementName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'Per Second'
  }
}, {
  indexes: [
    { unique: true, fields: ['countryCode'] },
    { fields: ['pricePerSecond'] }
  ],
  tableName: 'country_prices'
});

// Payment transaction model with comprehensive indexes
const PaymentTransaction = sequelize.define('PaymentTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  paymentId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  orderId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  payCurrency: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  payAddress: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  payAmount: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  actuallyPaid: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired'),
    allowNull: false,
    defaultValue: 'waiting'
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [
    { unique: true, fields: ['transactionId'] },
    { unique: true, fields: ['paymentId'] },
    { unique: true, fields: ['orderId'] },
    { fields: ['userId', 'status'] },
    { fields: ['status', 'createdAt'] },
    { fields: ['createdAt'] }
  ],
  tableName: 'payment_transactions'
});

// Call state model with optimized indexes for heavy read/write
const CallState = sequelize.define('CallState', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.ENUM('initiated', 'answered', 'completed', 'failed', 'bridging', 'bridged', 'machine', 'notsure', 'terminated', 'hold'),
    allowNull: false
  },
  channelId: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  bridgeId: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  dtmfDigits: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  toNumber: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  fromNumber: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  countryCode: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  callbackUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  indexes: [
    { unique: true, fields: ['callId'] },
    { fields: ['userId', 'status'] },
    { fields: ['status', 'startTime'] },
    { fields: ['endTime'] },
    { fields: ['channelId'] },
    { fields: ['startTime'] },
    { fields: ['userId', 'startTime'] }
  ],
  tableName: 'call_states'
});

// Announcement model
const Announcement = sequelize.define('Announcement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  postedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['postedAt'] }
  ],
  tableName: 'announcements'
});

// Chat message model with optimized structure
const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  sender: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  sentAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['userId', 'sentAt'] },
    { fields: ['sender'] },
    { fields: ['sentAt'] }
  ],
  tableName: 'chat_messages'
});

// Update notice model
const UpdateNotice = sequelize.define('UpdateNotice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('notice', 'patch'),
    allowNull: false
  },
  postedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['type', 'postedAt'] },
    { fields: ['postedAt'] }
  ],
  tableName: 'update_notices'
});

// Define associations
User.hasMany(CallState, { foreignKey: 'userId', onDelete: 'CASCADE' });
CallState.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(UserLog, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserLog.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(ChatMessage, { foreignKey: 'userId' });
ChatMessage.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(PaymentTransaction, { foreignKey: 'userId' });
PaymentTransaction.belongsTo(User, { foreignKey: 'userId' });

// Database sync options for production
const syncOptions = {
  alter: false, // Don't alter tables in production
  force: false  // Don't drop tables
};

// Helper function to ensure indexes are created
async function ensureIndexes() {
  if (config.nodeEnv === 'production') {
    // In production, only add indexes if they don't exist
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Add any custom indexes here if needed
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
  }
}

module.exports = {
  sequelize,
  User,
  AdminLog,
  UserLog,
  CountryPrice,
  PaymentTransaction,
  CallState,
  Announcement,
  ChatMessage,
  UpdateNotice,
  syncOptions,
  ensureIndexes
};