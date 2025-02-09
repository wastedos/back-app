const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();// تعريفة داخل الروتر
const { JWT_SECRET } = process.env;

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  const { name, phone, password, birth, gender, role, date_create } = req.body;

  // التحقق من وجود الحقول
  if (!name || !phone || !password || !birth || !gender || !role ) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ phone });
    if (existingUser) return res.status(400).json({ message: 'this phone already exists' });

    const user = await User.create({ name, phone, password, birth, gender, role, date_create });
    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  try {
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user._id, phone: user.phone, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '10h' });
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// تسجيل الخروج
const blacklist = new Set(); // قائمة سوداء لتخزين الرموز الملغاة
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; // استخراج الـ JWT من الهيدر

  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  try {
    // تحقق من صحة التوكن
    jwt.verify(token, JWT_SECRET);
    blacklist.add(token); //إضافة التوكن إلى القائمة السوداء
    return res.status(200).json({ message: 'Logout successful' });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token or already logged out' });
  }
});

module.exports = router;
