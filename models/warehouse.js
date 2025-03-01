const mongoose = require("mongoose");
const moment = require('moment');

//product
const productSchema = new mongoose.Schema({
  code: { type: Number, required: true, unique: true },
  codeCategory: { type: String,},
  carModel: { type: String, },
  category: { type: String,},
  brand: { type: String, },
  income: { type: Number, },
  outgo: { type: Number, },
  returnin: { type: Number, },
  returnout: { type: Number, },
  quantity: { type: Number,},
  price: { type: Number, },
  total: { type: Number, },
});

//income
const incomeSchema = new mongoose.Schema({
  code: { type: Number, required: true, },
  codeCategory: { type: String, },
  billnumber: { type: String, },
  carModel: { type: String, },
  category: { type: String, required: true, },
  brand: { type: String, required: true, },
  quantity: { type: Number, required: true, },
  price: { type: Number, required: true, },
  total: { type: Number, required: true, },
  dealerName: { type: String,  },
  createdAt: { type: Date, default: Date.now, },
  date: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});

//outgo
const outgoSchema = new mongoose.Schema({
  code: { type: Number, required: true, },
  codeCategory: { type: String,},
  billnumber: { type: String,},
  carModel: { type: String},
  category: { type: String, },
  brand: { type: String,  },
  quantity: { type: Number, },
  qtyoutgo: { type: Number, },
  price: { type: Number,  },
  total: { type: Number,  },
  buyer: { type: String },
  buyerphone: { type: Number },
  createdAt: { type: Date, default: Date.now, },
  date: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});

//return 
const returnincomeSchema = new mongoose.Schema({
  code: { type: Number, required: true,},
  codeCategory: { type: String,},
  billnumber: { type: String, },
  carModel: { type: String},
  category: { type: String, required: true },
  brand: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
  dealerName: { type: String, },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now, },
  date: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});


//return outgo
const returnoutgoSchema = new mongoose.Schema({
  code: { type: Number, required: true,},
  codeCategory: { type: String,},
  billnumber: { type: String, },
  carModel: { type: String},
  category: { type: String, },
  brand: { type: String, },
  quantity: { type: Number,  },
  price: { type: Number,  },
  total: { type: Number, },
  buyer: { type: String },
  buyerphone: { type: Number },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now, },
  date: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});


//history
const historySchema = new mongoose.Schema({
  userid: { type: String, required: true },
  code: { type: Number, required: true },
  category: { type: String, required: true },
  brand: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  reason: { type: String },
  action: { type: String, enum: ['delete', 'update'] },
  date: { type: Date, default: Date.now }
});


// Create Models
const Product = mongoose.model('Product', productSchema);
const Income = mongoose.model('Income', incomeSchema);
const Outgo = mongoose.model('Outgo', outgoSchema);
const ReturnIncome = mongoose.model('Returnincome', returnincomeSchema);
const ReturnOutgo = mongoose.model('Returnoutgo', returnoutgoSchema);
const Historywarehouse = mongoose.model('Historywarehouse', historySchema);

// Export Models
module.exports = {
  Product,
  Income,
  Outgo,
  ReturnIncome,
  ReturnOutgo,
  Historywarehouse,
};

