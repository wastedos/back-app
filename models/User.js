const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const moment = require('moment');

const UserSchema = new mongoose.Schema({
  image: {
    type: String
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  pwd: {
    type: String,
    required: true,
  },
  birth: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'employee'], // يمكن إضافة أدوار أخرى
    default: 'user', // القيمة الافتراضية
  },
  date_create: {
    type: String,
    default: () => moment().format('MM-DD-YYYY')
  }
});

// تشفير كلمة المرور قبل الحفظ
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);
