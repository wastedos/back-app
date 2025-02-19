const mongoose = require('mongoose');

const jobOrderSchema = new mongoose.Schema({
  Jobid: { type: Number, },
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
  outjob: [
    {
      jobName: { type: String, },
      dealerName: { type: String, },
      quantity: { type: Number, default: 1 },
      jobPriceBuy: { type: Number, },
      jobPriceSell: { type: Number, },
      imageName: { type: String },
    },
  ],
  newparts: [
    {
      category: { type: String, },
      dealerName: { type: String, },
      quantity: { type: Number, },
      pricesell: { type: Number, },
      pricebuy: { type: Number, },
      imageName: { type: String },
    },
  ],
  other: [
    {
      otherName: { type: String, },
      otherPrice: { type: Number, },
    },
  ],
  payment: { type: String, },
  invoice: { type: Number, },
  discount: { type: Number, },
  total: { type: Number, },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to calculate Jobid and total before saving
jobOrderSchema.pre('save', async function (next) {
  
  if (!this.Jobid) {
    // Generate Jobid as the next sequential number
    const lastOrder = await mongoose.model('JobOrder').findOne().sort({ Jobid: -1 });
    this.Jobid = lastOrder ? lastOrder.Jobid + 1 : 1; // Start from 1 if no orders exist
  }
  /*
  let currentJobId = 0;
  function getNextJobId() {
    currentJobId += 1;
    return currentJobId;
  }
  // عند الإنشاء:
  if (!this.Jobid) {
    this.Jobid = getNextJobId();
  }
  */

  // Calculate totals for each array
  const partsTotal = this.parts.reduce((sum, part) => sum + (part.quantity * part.pricesell || 0), 0);
  const newPartsTotal = this.newparts.reduce((sum, part) => sum + (part.quantity * part.pricesell || 0), 0);
  const outjobTotal = this.outjob.reduce((sum, job) => sum + (job.jobPriceSell || 0), 0);
  const otherTotal = this.other.reduce((sum, item) => sum + (item.otherPrice || 0), 0);

  // Calculate the grand total
  this.total = partsTotal + newPartsTotal + outjobTotal + otherTotal + this.invoice - (this.discount || 0);
  next();
});


module.exports = mongoose.model('JobOrder', jobOrderSchema);
