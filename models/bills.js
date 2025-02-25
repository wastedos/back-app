const mongoose = require('mongoose');
const moment = require('moment');

const BillsSchema = new mongoose.Schema({
  Jobid: { type: Number, required: true },
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true },
  carModel: { type: String, required: true },
  carColor: { type: String, required: true },
  chassis: { type: String, },
  carKm: { type: String, },
  jobs: [
    {
      jobName: {type: String},
    }
  ],
  parts: [
    {
      code: { type: String, },
      quantity: { type: Number, },
      pricesell: { type: Number, },
      category: { type: String, },
    },
  ],
  newparts: [
    {
      category: { type: String, },
      dealerName: { type: String, },
      quantity: { type: Number, },
      pricebuy: { type: Number, },
      pricesell: { type: Number, },
      imageName: { type: String, },
    },
  ],
  outjob: [
    {
      jobName: { type: String, },
      dealerName: { type: String, },
      jobPriceBuy: { type: Number, },
      jobPriceSell: { type: Number, },
      imageName: { type: String, },
    },
  ],
  other: [
    {
      otherName: { type: String, },
      otherPrice: { type: Number, },
    },
  ],
  payed: [
    {
      payment: { type: String, },
      payedPrice: { type: Number, },
    },
  ],
  theRest: { type: Number, },
  payment: { type: String, required: true },
  invoice: { type: Number,  },
  discount: { type: Number, },
  total: { type: Number, },
  date:{ type: String,default: () => moment().format('MM-DD-YYYY') },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Bills', BillsSchema);
