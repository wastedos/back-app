const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middlewares/authMiddleware')

/* ===================================== POST ===================================== */



/* ===================================== GET ===================================== */
// Read all product
router.get("/read-users", async (req, res) => {
  try {
    const user = await User.find();
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//عرض المستخدمين في الصفحة ال dashboard
router.get('/stats', async (req, res) => {
    try {
      // الحصول على عدد المستخدمين بناءً على الدور
      const adminCount = await User.countDocuments({ role: 'admin' });
      const employeeCount = await User.countDocuments({ role: 'employee' });
      const userCount = await User.countDocuments({ role: 'user' });
  
      res.status(200).json({
        success: true,
        data: {
          admin: adminCount,
          employee: employeeCount,
          users: userCount,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Something went wrong',
        error: error.message,
      });
    }
});


/* ===================================== PUT ===================================== */
//Update users by id
router.put("/update-user/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);
    console.log("Request Body:", req.body);

    const { password, ...updateData } = req.body; // استخراج كلمة المرور إن وجدت

    // تأكد من عدم تضمين الحقول الفارغة في updateData
    Object.keys(updateData).forEach((key) => {
      if (!updateData[key]) {
        delete updateData[key]; // حذف الحقل إذا كانت قيمته فارغة
      }
    });

    // إذا كانت كلمة المرور موجودة، تشفيرها
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt); // تشفير كلمة المرور
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// تحديث المستخدم حسب الـ id الموجود في التوكن
router.put("/update-user", authenticate, async (req, res) => {
  try {
    console.log("Authenticated User ID:", req.user.id);
    console.log("Request Body:", req.body);

    const { password, ...formData } = req.body; // استخراج كلمة المرور إن وجدت

    // تأكد من عدم تضمين الحقول الفارغة في formData
    Object.keys(formData).forEach((key) => {
      if (!formData[key]) {
        delete formData[key]; // حذف الحقل إذا كانت قيمته فارغة
      }
    });

    // إذا كانت كلمة المرور موجودة، تشفيرها
    if (password) {
      const salt = await bcrypt.genSalt(10);
      formData.password = await bcrypt.hash(password, salt);
    }
    const userId = req.user.id;
    const user = await User.updateOne({ _id: userId }, { $set: formData });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});


/* ===================================== DELETE ===================================== */
//Delete income by id
router.delete("/delete-user/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// حذف المستخدم حسب الـ id الموجود في التوكن
router.delete("/delete-user", authenticate, async (req, res) => {
  try {
    console.log("Authenticated User ID:", req.user.id);

    const user = await User.findByIdAndDelete(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;