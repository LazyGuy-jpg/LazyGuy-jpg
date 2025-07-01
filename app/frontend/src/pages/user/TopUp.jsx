import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCardIcon,
  CurrencyDollarIcon,
  GiftIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { paymentAPI, userAPI } from '../../services/api';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore';

const AMOUNTS = [50, 100, 200, 500, 1000];

const CRYPTO_CURRENCIES = {
  btc: { name: 'Bitcoin', icon: '₿' },
  eth: { name: 'Ethereum', icon: 'Ξ' },
  bnbmainnet: { name: 'BNB', icon: 'BNB' },
  usdterc20: { name: 'USDT (ERC20)', icon: 'USDT' },
  usdttrc20: { name: 'USDT (TRC20)', icon: 'USDT' },
  ltc: { name: 'Litecoin', icon: 'Ł' }
};

export default function TopUp() {
  const { updateUserData } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('btc');
  const [bonusRules, setBonusRules] = useState([]);
  const [selectedBonus, setSelectedBonus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);

  useEffect(() => {
    fetchBonusRules();
    
    // Check for payment status from URL params
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      setPaymentSuccess(true);
      updateUserData();
    } else if (paymentStatus === 'cancelled') {
      setPaymentCancelled(true);
    }
  }, [searchParams]);

  const fetchBonusRules = async () => {
    try {
      const response = await userAPI.getBonusRules();
      setBonusRules(response.data.rules || []);
    } catch (error) {
      console.error('Failed to fetch bonus rules:', error);
    }
  };

  const getApplicableBonus = (amount) => {
    const applicable = bonusRules.filter(rule => 
      rule.isActive && 
      amount >= rule.minAmount && 
      (!rule.maxAmount || amount <= rule.maxAmount)
    );
    
    // Return the best bonus
    return applicable.sort((a, b) => {
      const bonusA = calculateBonusAmount(a, amount);
      const bonusB = calculateBonusAmount(b, amount);
      return bonusB - bonusA;
    })[0] || null;
  };

  const calculateBonusAmount = (rule, amount) => {
    if (!rule) return 0;
    
    let bonus = 0;
    if (rule.bonusType === 'percentage') {
      bonus = (amount * rule.bonusValue) / 100;
    } else {
      bonus = rule.bonusValue;
    }
    
    if (rule.maxBonusAmount && bonus > rule.maxBonusAmount) {
      bonus = rule.maxBonusAmount;
    }
    
    return bonus;
  };

  const handleAmountChange = (value) => {
    setAmount(value);
    setCustomAmount('');
    const bonus = getApplicableBonus(value);
    setSelectedBonus(bonus);
  };

  const handleCustomAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) {
      setCustomAmount(value);
      setAmount(0);
      const numValue = parseFloat(value) || 0;
      const bonus = getApplicableBonus(numValue);
      setSelectedBonus(bonus);
    }
  };

  const getFinalAmount = () => {
    return customAmount ? parseFloat(customAmount) : amount;
  };

  const getTotalWithBonus = () => {
    const base = getFinalAmount();
    const bonus = calculateBonusAmount(selectedBonus, base);
    return base + bonus;
  };

  const handlePayment = async () => {
    const finalAmount = getFinalAmount();
    
    if (finalAmount < 50) {
      toast.error('Minimum top-up amount is $50');
      return;
    }

    setLoading(true);
    try {
      const response = await paymentAPI.createPayment({
        amount: finalAmount,
        payCurrency: selectedCurrency,
        bonusRuleId: selectedBonus?.id
      });

      if (response.data.paymentUrl) {
        window.location.href = response.data.paymentUrl;
      } else {
        toast.error('Failed to create payment URL');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your balance will be updated shortly. This may take a few minutes.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (paymentCancelled) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h2>
          <p className="text-gray-600 mb-6">
            Your payment was cancelled. No charges were made.
          </p>
          <button
            onClick={() => setPaymentCancelled(false)}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Top Up Your Balance</h1>
        <p className="text-gray-600">Add funds to your account using cryptocurrency</p>
      </div>

      {/* Amount Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Amount (USD)</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {AMOUNTS.map((value) => (
            <button
              key={value}
              onClick={() => handleAmountChange(value)}
              className={`p-4 rounded-lg border-2 transition-all ${
                amount === value && !customAmount
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CurrencyDollarIcon className="h-6 w-6 mx-auto mb-2 text-gray-600" />
              <p className="text-lg font-semibold">${value}</p>
            </button>
          ))}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or enter custom amount
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              value={customAmount}
              onChange={handleCustomAmountChange}
              placeholder="Enter amount"
              className="input-field pl-8"
              min="50"
              step="0.01"
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">Minimum: $50</p>
        </div>
      </div>

      {/* Bonus Display */}
      {selectedBonus && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <GiftIcon className="h-5 w-5 text-green-600 mr-2" />
            <h3 className="text-sm font-medium text-green-800">Bonus Applied!</h3>
          </div>
          <p className="mt-1 text-sm text-green-700">
            {selectedBonus.name}: Get ${calculateBonusAmount(selectedBonus, getFinalAmount()).toFixed(2)} bonus
          </p>
          <p className="text-xs text-green-600 mt-1">{selectedBonus.description}</p>
        </div>
      )}

      {/* Currency Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Payment Currency</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(CRYPTO_CURRENCIES).map(([key, currency]) => (
            <button
              key={key}
              onClick={() => setSelectedCurrency(key)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedCurrency === key
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-gray-700 mb-1">{currency.icon}</div>
              <p className="text-sm font-medium">{currency.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="card bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="font-medium">${getFinalAmount().toFixed(2)}</span>
          </div>
          
          {selectedBonus && (
            <div className="flex justify-between text-green-600">
              <span>Bonus:</span>
              <span className="font-medium">+${calculateBonusAmount(selectedBonus, getFinalAmount()).toFixed(2)}</span>
            </div>
          )}
          
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total Credit:</span>
              <span>${getTotalWithBonus().toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handlePayment}
            disabled={loading || getFinalAmount() < 50}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                <CreditCardIcon className="h-5 w-5" />
                Pay with {CRYPTO_CURRENCIES[selectedCurrency].name}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Payment Information</h3>
            <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>Payments are processed securely through NOWPayments</li>
              <li>Your balance will be updated automatically after confirmation</li>
              <li>Cryptocurrency transactions may take 10-30 minutes to confirm</li>
              <li>Contact support if your balance doesn't update within 1 hour</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}