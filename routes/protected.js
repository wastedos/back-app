const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const User = require('../models/User');



/*
router.get('/role', authenticate, (req, res) => {
  // يتم إرسال الدور الموجود في التوكن
  res.status(200).json({ role: req.user.role });
  
});
*/

// جلب الدور مباشرة من قاعدة البيانات
router.get('/role', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('role'); // جلب الدور فقط
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ role: user.role });
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get('/user-info', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name phone role'); // جلب البيانات المطلوبة فقط
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
