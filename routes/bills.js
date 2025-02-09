const express = require('express');
const router = express.Router();
const Bill = require('../models/bills');
const { authenticate, } = require('../middlewares/authMiddleware');

// =========================================== GET ===========================================
router.get('/read-bills', async (req, res) => {
  try {
    const bills = await Bill.find();
    res.status(200).json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching job orders', error: err.message });
  }
});

// Read bills by id
router.get("/read-bill/:id", async (req, res) => {
  try {
    const bills = await Bill.findById(req.params.id);
    if (!bills) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/user-bills", authenticate, async (req, res) => {
  try {
    const userPhone = req.user.phone; // استخراج رقم الهاتف من التوكن

    if (!userPhone) {
      return res.status(400).json({ message: "رقم الهاتف غير موجود في التوكن" });
    }

    const bills = await Bill.find({ clientPhone: userPhone });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: "خطأ في جلب الفواتير", error });
  }
});


// =========================================== DELETE ===========================================
  // حذف طلب تشغيل عند إصدار فاتورة
  router.delete('/delete-byid/:id', async (req, res) => {
  try {
    const deleteBill = await Bill.findByIdAndDelete(req.params.id);
    if (!deleteBill) {
      return res.status(404).json({ message: 'Job order not found' });
    }
    res.status(200).json({ message: 'تم حزف الفاتورة' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting job order', error: err.message });
  }
});


module.exports = router;
