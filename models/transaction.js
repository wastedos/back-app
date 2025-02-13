const mongoose = require("mongoose");
const moment = require('moment');

const SafeSchema = new mongoose.Schema({
  typeSafe: {
    type: String,
    enum: ['cash', 'vodafone', 'instapay', 'fawry'],
    required: true
  },
  amountSafe: { 
    type: Number,
    required: true,
    min: [0, 'Amount must be positive']
  },
  branch : { type: String, },
  createdAt: { type: Date, default: () => moment().format('MM-DD-YYYY'), },
  formatDate: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});

const DepositSchema = new mongoose.Schema({
  typeSafe: { type: String, required: true },
  amountDeposit: { 
    type: Number, 
    required: true,
    min: [0, 'Amount must be positive']
  },
  reasonDeposit: { type: String },
  branch : { type: String, },
  createdAt: { type: Date, default: () => moment().format('MM-DD-YYYY'), },
  formatDate: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});

const WithdrawSchema = new mongoose.Schema({
  typeSafe: { type: String, required: true },
  amountWithdraw: { 
    type: Number, 
    required: true,
    min: [0, 'Amount must be positive']
  },
  typeWithdraw: { type: String,},
  payee: { type: String, },
  reasonWithdraw: { type: String },
  branch : { type: String, },
  createdAt: { type: Date, default: () => moment().format('MM-DD-YYYY'), },
  formatDate: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});

const TransferSchema = new mongoose.Schema({
  fromSafe: {
    type: String,
    enum: ['cash', 'vodafone', 'instapay', 'fawry'],
    required: true
  },
  toSafe: {
    type: String,
    enum: ['cash', 'vodafone', 'instapay', 'fawry'],
    required: true
  },
  amountTransfer: { 
    type: Number,
    required: true,
    min: [0, 'Amount must be positive']
  },
  reasonTransfer: { type: String },
  branch : { type: String, },
  createdAt: { type: Date, default: () => moment().format('MM-DD-YYYY'), },
  formatDate: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});

const Safe = mongoose.model("Safe", SafeSchema);
const Deposit = mongoose.model("Deposit", DepositSchema);
const Withdraw = mongoose.model("Withdraw", WithdrawSchema);
const Transfer = mongoose.model("Transfer", TransferSchema);

module.exports = {
  Safe,
  Deposit,
  Withdraw,
  Transfer
};
