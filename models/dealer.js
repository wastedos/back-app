const mongoose = require("mongoose");
const moment = require('moment');


//التجار
const dealerSchema = new mongoose.Schema({
  dealerName: { type: String, required: true, },
  dealerPhone: { type: String, },
  service: { type: String,  },
  typeService: [
    {
      date: { type: String, default: () => moment().format('MM-DD-YYYY')},
      code: { type: String},
      type: { type: String, },
      count: { type: Number, },
      servicePriceBuy: { type: Number, },
      servicePriceSell: { type: Number, },
      billNumber: { type: String, },
      imageName: { type: String, },
    },
  ],
  totalPriceBuy: { type: Number, default: 0 },
  totalPriceSell: { type: Number, default: 0 },
  payed: { type: Number, default: 0},
  theRest: { type: Number, default: 0},
});


dealerSchema.pre("save", function (next) {
  this.totalPriceBuy = this.typeService.reduce((acc, item) => acc + ((item.servicePriceBuy || 0) * (item.count || 1)), 0);
  this.totalPriceSell = this.typeService.reduce((acc, item) => acc + ((item.servicePriceSell || 0) * (item.count || 1)), 0);
  this.theRest = this.totalPriceBuy - this.payed;
  next();
});

// Create Models
const Dealer = mongoose.model('Dealer', dealerSchema);


// Export Models
module.exports = {
  Dealer,
};

