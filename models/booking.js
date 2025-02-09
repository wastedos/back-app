const mongoose = require("mongoose");


const bookingSchema = new mongoose.Schema({
  userid: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  brand: { type: String, required: true },
  datevisit: { type: String, required: true },
  reason: { type: String, required: true },
  state: { type: String, required: true },
  date: { type: Date, default: Date.now },  // تاريخ إنشاء الحجز
});

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
