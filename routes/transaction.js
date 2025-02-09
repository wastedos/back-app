const express = require("express");
const router = express.Router();
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
    const deposit = await Deposit.find();
    res.status(200).json(deposit);
  } catch (error) {
    res.status(500).json({ error: "خطأ في عرض البيانات", details: error.message });
  }
});

router.get("/read-withdraw", async (req, res) => {
  try {
    const withdraw = await Withdraw.find();
    res.status(200).json(withdraw);
  } catch (error) {
    res.status(500).json({ error: "خطأ في عرض البيانات", details: error.message });
  }
});

router.get("/read-transfer", async (req, res) => {
  try {
    const transfer = await Transfer.find();
    res.status(200).json(transfer);
  } catch (error) {
    res.status(500).json({ error: "خطأ في عرض البيانات", details: error.message });
  }
});


router.get("/withdraw-chart-data", async (req, res) => {
  try {
    const { month } = req.query; // الشهر المطلوب (مثال: "1" لشهر يناير)

    if (!month) {
      return res.status(400).json({ error: "يرجى تحديد الشهر" });
    }

    // تحديد نطاق التاريخ بناءً على الشهر
    const startOfMonth = moment().month(month - 1).startOf('month').format('MM-DD-YYYY');
    const endOfMonth = moment().month(month - 1).endOf('month').format('MM-DD-YYYY');

    // جلب بيانات السحوبات ضمن الشهر
    const withdraws = await Withdraw.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: "$typeSafe",  // تجميع حسب نوع الخزنة
          totalWithdraw: { $sum: "$amountWithdraw" },
        },
      },
    ]);

    // إرسال البيانات للـ Frontend
    res.status(200).json({ withdraws });
  } catch (error) {
    console.error("Error fetching withdraw chart data:", error);
    res.status(500).json({ error: "خطأ في جلب بيانات السحوبات", details: error.message });
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
    const { typeSafe, amountWithdraw, typeWithdraw, reasonWithdraw } = req.body;

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
    const withdraw = new Withdraw({ typeSafe, amountWithdraw, typeWithdraw, reasonWithdraw });
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
