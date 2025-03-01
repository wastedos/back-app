const express = require("express");
const router = express.Router();
const moment = require('moment');
const { Safe, Deposit, Withdraw, Transfer } = require("../models/transaction");

// ================================================ GET ================================================

router.get("/safe", async (req, res) => {
  try {
    const safes = await Safe.find();
    res.status(200).json(safes);
  } catch (error) {
    res.status(500).json({ error: "خطأ في عرض البيانات", details: error.message });
  }
});

router.get("/read-deposit", async (req, res) => {
  try {
    const deposit = await Deposit.find().sort({ createdAt: -1 });
    res.status(200).json(deposit);
  } catch (error) {
    res.status(500).json({ error: "خطأ في عرض البيانات", details: error.message });
  }
});

router.get("/read-withdraw", async (req, res) => {
  try {
    const withdraw = await Withdraw.find().sort({ createdAt: -1 });
    res.status(200).json(withdraw);
  } catch (error) {
    res.status(500).json({ error: "خطأ في عرض البيانات", details: error.message });
  }
});

router.get("/read-transfer", async (req, res) => {
  try {
    const transfer = await Transfer.find().sort({ createdAt: -1 });
    res.status(200).json(transfer);
  } catch (error) {
    res.status(500).json({ error: "خطأ في عرض البيانات", details: error.message });
  }
});


router.get('/monthly-transactions', async (req, res) => {
  try {
    const { month, year } = req.query;
    let filter = {};

    if (month && year) {
      const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1); // Adding one month for the end date
      filter.createdAt = { $gte: startDate, $lt: endDate }; // Query for transactions within the date range
    } else if (year) {
      const startDate = new Date(`${year}-01-01T00:00:00Z`);
      const endDate = new Date(`${year}-12-31T23:59:59Z`);
      filter.createdAt = { $gte: startDate, $lt: endDate }; // Query for transactions within the year
    }

    const allSafes = ["cash", "vodafone", "instapay", "fawry"];

    const deposits = await Deposit.aggregate([
      { $match: filter },
      { $group: { _id: "$typeSafe", totalDeposit: { $sum: "$amountDeposit" } } }
    ]);

    const withdraws = await Withdraw.aggregate([
      { $match: filter },
      { $group: { _id: "$typeSafe", totalWithdraw: { $sum: "$amountWithdraw" } } }
    ]);

    const formattedDeposits = allSafes.map(safe => {
      const deposit = deposits.find(d => d._id === safe);
      return { _id: safe, totalDeposit: deposit ? deposit.totalDeposit : 0 };
    });

    const formattedWithdraws = allSafes.map(safe => {
      const withdraw = withdraws.find(w => w._id === safe);
      return { _id: safe, totalWithdraw: withdraw ? withdraw.totalWithdraw : 0 };
    });

    res.status(200).json({
      deposits: formattedDeposits,
      withdraws: formattedWithdraws
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "خطأ في جلب البيانات", details: error.message });
  }
});




// دالة لإرجاع بداية اليوم ونهايته
const getTodayRange = () => {
  const startOfDay = moment().startOf("day").toDate();
  const endOfDay = moment().endOf("day").toDate();
  return { startOfDay, endOfDay };
};
// API لجلب عمليات الإيداع والسحب لليوم الحالي فقط
router.get("/today-transactions", async (req, res) => {
  try {
    const { startOfDay, endOfDay } = getTodayRange();

    const deposits = await Deposit.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const withdraws = await Withdraw.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    res.status(200).json({ deposits, withdraws });
  } catch (error) {
    console.error("Error fetching today's transactions:", error); // ✅ طباعة الخطأ في السيرفر
    res.status(500).json({ error: "خطأ في جلب بيانات اليوم", details: error.message });
  }
});



// ================================================ POST ================================================
// إيداع
router.post("/deposit", async (req, res) => {
  try {
    const { typeSafe, amountDeposit, reasonDeposit } = req.body;

    if (!typeSafe || !amountDeposit) {
      return res.status(400).json({ error: "يرجى إدخال نوع المحفظة والمبلغ" });
    }

    // تحديث المحفظة
    const safe = await Safe.findOneAndUpdate(
      { typeSafe },
      { $inc: { amountSafe: amountDeposit } },
      { new: true, upsert: true } // إنشاء محفظة إذا لم تكن موجودة
    );

    // حفظ عملية الإيداع
    const deposit = new Deposit({ typeSafe, amountDeposit, reasonDeposit });
    await deposit.save();

    res.status(200).json({ message: "تم الإيداع بنجاح", safe });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الإيداع", details: error.message });
  }
});

// سحب
router.post("/withdraw", async (req, res) => {
  try {
    const { typeSafe, amountWithdraw, typeWithdraw, payee, reasonWithdraw } = req.body;

    if (!typeSafe || !amountWithdraw || !typeWithdraw) {
      return res.status(400).json({ error: "يرجى إدخال جميع الحقول المطلوبة" });
    }

    // التأكد من وجود رصيد كافٍ
    const safe = await Safe.findOne({ typeSafe });
    if (!safe || safe.amountSafe < amountWithdraw) {
      return res.status(400).json({ error: "رصيد غير كافٍ" });
    }

    // تحديث المحفظة
    safe.amountSafe -= amountWithdraw;
    await safe.save();

    // حفظ عملية السحب
    const withdraw = new Withdraw({ typeSafe, amountWithdraw, typeWithdraw, payee, reasonWithdraw });
    await withdraw.save();

    res.status(200).json({ message: "تم السحب بنجاح", safe });
  } catch (error) {
    res.status(500).json({ error: "خطأ في السحب", details: error.message });
  }
});

// تحويل
router.post("/transfer", async (req, res) => {
  try {
    const { fromSafe, toSafe, amountTransfer, reasonTransfer } = req.body;

    if (!fromSafe || !toSafe || !amountTransfer) {
      return res.status(400).json({ error: "يرجى إدخال جميع الحقول المطلوبة" });
    }

    // التأكد من وجود رصيد كافٍ في المحفظة المصدر
    const sourceSafe = await Safe.findOne({ typeSafe: fromSafe });
    if (!sourceSafe || sourceSafe.amountSafe < amountTransfer) {
      return res.status(400).json({ error: "رصيد غير كافٍ في المحفظة المصدر" });
    }

    // تحديث المحافظ
    sourceSafe.amountSafe -= amountTransfer;
    await sourceSafe.save();

    const targetSafe = await Safe.findOneAndUpdate(
      { typeSafe: toSafe },
      { $inc: { amountSafe: amountTransfer } },
      { new: true, upsert: true }
    );

    // حفظ عملية التحويل
    const transfer = new Transfer({ fromSafe, toSafe, amountTransfer, reasonTransfer });
    await transfer.save();

    res.status(200).json({ message: "تم التحويل بنجاح", sourceSafe, targetSafe });
  } catch (error) {
    res.status(500).json({ error: "خطأ في التحويل", details: error.message });
  }
});




// ================================================ PUT ================================================


module.exports = router;
