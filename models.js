const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config');

const sequelize = new Sequelize({
  dialect: config.db.dialect,
  storage: config.db.storage,
  logging: console.log,
  pool: {
    max: 50,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const User = sequelize.define('User', {
  apikey: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Default',
  },
  profilePic: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'https://via.placeholder.com/100?text=A',
  },
  telegramUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  totalCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  failedCalls: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  balance: {
    type: DataTypes.FLOAT(10, 2),
    defaultValue: 0.00,
    get() {
      const value = this.getDataValue('balance');
      return value ? Number(value).toFixed(2) : "0.00";
    }
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD',
  },
  concurrentCalls: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  isDisabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  isBanned: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

const AdminLog = sequelize.define('AdminLog', {
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

const UserLog = sequelize.define('UserLog', {
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
});

const CountryPrice = sequelize.define('CountryPrice', {
  countryCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  countryName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pricePerSecond: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  billingIncrement: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '1/1',
    validate: {
      is: /^\d+\/\d+$/,
    }
  },
  billingIncrementName: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Per Second',
  }
});

const PaymentTransaction = sequelize.define('PaymentTransaction', {
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD',
  },
  payCurrency: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  actuallyPaid: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'waiting',
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

const CallState = sequelize.define('CallState', {
  callId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  channelId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bridgeId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dtmfDigits: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  toNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fromNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  countryCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Announcement = sequelize.define('Announcement', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  postedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

const ChatMessage = sequelize.define('ChatMessage', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  sender: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  sentAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

const UpdateNotice = sequelize.define('UpdateNotice', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('notice', 'patch'),
    allowNull: false,
  },
  postedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
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
  UpdateNotice
};