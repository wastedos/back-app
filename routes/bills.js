const express = require('express');
const router = express.Router();
const Bill = require('../models/bills');
const { Safe, Deposit, } = require("../models/transaction.js")
const { authenticate, } = require('../middlewares/authMiddleware');

// =========================================== GET ===========================================
router.get('/read-bills', async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    const totals = {
      billTotal: 0,
      payTotal: 0,
      theRestTotal: 0,
    };

    // حساب الإجماليات
    bills.forEach(bill => {
      totals.billTotal += bill.total ? bill.total : 0;
      totals.payTotal += bill.pay ? bill.pay : 0;
      totals.theRestTotal += bill.theRest ? bill.theRest : 0;
    });
    const result = {
      totalBills: totals.billTotal,
      totalPay: totals.payTotal,
      totaltheRest: totals.theRestTotal,
    }
    res.status(200).json({ bills, result });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching job orders', error: err.message });
  }
});

// read bill for analysis
router.get('/read-bill', async (req, res) => {
  try {
      const { month, year } = req.query;
      let filter = {};
      if (month && year) {
          const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1); // إضافة شهر
          filter.createdAt = { $gte: startDate, $lt: endDate }; // استعلام بين تواريخ
      } else if (year) {
        const startDate = new Date(`${year}-01-01T00:00:00Z`);
        const endDate = new Date(`${year}-12-31T23:59:59Z`);
        filter.createdAt = { $gte: startDate, $lt: endDate };
      }
    
      const bills = await Bill.find(filter);
      // تجميع المعلومات المطلوبة
      const totals = {
          sellPartsTotal: 0,
          buyNewPartsTotal: 0,
          sellNewPartsTotal: 0,
          buyOutJobsTotal: 0,
          sellOutJobsTotal: 0,
          otherTotal: 0,
          invoiceTotal: 0,
          discountTotal: 0,
      };
      // تحليل كل الفواتير وجمع القيم
      bills.forEach(bill => {
          // جمع إجمالي بيع الأجزاء
          totals.sellPartsTotal += bill.parts.reduce((total, part) => total + (part.pricesell * part.quantity || 0), 0);
          // جمع إجمالي شراء وبيع newparts
          bill.newparts.forEach(newPart => {
              totals.buyNewPartsTotal += (newPart.pricebuy * newPart.quantity || 0);
              totals.sellNewPartsTotal += (newPart.pricesell * newPart.quantity || 0);
          });
          // جمع إجمالي شراء وبيع outjobs
          bill.outjob.forEach(job => {
              totals.buyOutJobsTotal += (job.jobPriceBuy || 0);
              totals.sellOutJobsTotal += (job.jobPriceSell || 0);
          });
          // جمع إجمالي other
          totals.otherTotal += bill.other.reduce((total, other) => total + (other.otherPrice || 0), 0);
          //اجمالي المصنعيات
          totals.discountTotal += bill.discount ? bill.discount : 0;
          // جمع إجمالي المصنعيات
          totals.invoiceTotal += bill.invoice.reduce((total, invoice) => total + (invoice.invoicePrice || 0), 0);
      });
      // حساب الإجماليات النهائية
      const totalIncome = (totals.sellPartsTotal + totals.sellNewPartsTotal + totals.sellOutJobsTotal + totals.otherTotal + totals.invoiceTotal) - totals.discountTotal;
      const totalExpenses = totals.buyNewPartsTotal + totals.buyOutJobsTotal;
      const profit = totalIncome - totalExpenses;
      const result = {
          totalIncome,
          totalExpenses,
          profit,
          discountTotal: totals.discountTotal,
          invoiceTotal: totals.invoiceTotal,
          sellPartsTotal: totals.sellPartsTotal,
          buyNewPartsTotal: totals.buyNewPartsTotal,
          sellNewPartsTotal: totals.sellNewPartsTotal,
          buyOutJobsTotal: totals.buyOutJobsTotal,
          sellOutJobsTotal: totals.sellOutJobsTotal,
          otherTotal: totals.otherTotal,
      };
      res.json(result);
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
// =========================================== UPDATE ===========================================

//update byid
router.put("/update-byid/:id", async (req, res) => {
  try {
    const { carKm, chassis } = req.body;  // استخراج الحقول اللي جاية في الـ body

    // انشاء كائن للتحديث بناءً على الحقول الموجودة في الـ body
    const updateData = {};
    if (carKm !== undefined) updateData.carKm = carKm;
    if (chassis !== undefined) updateData.chassis = chassis;

    // تحديث المنتج بناءً على الـ id والـ updateData المرسل
    const bills = await Bill.findByIdAndUpdate(
      req.params.id,
      { $set: updateData }, // فقط الحقول المرسلة سيتم تحديثها
      { new: true }
    );

    // لو المنتج مش موجود، ارجع برسالة خطأ
    if (!bills) {
      return res.status(404).json({ message: "المنتج غير متوفر في المخزن" });
    }

    // إرجاع المنتج بعد التحديث
    res.status(200).json(bills);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// سداد باقي الفاتورة
router.put("/payed-bills/:id", async (req, res) => {
  try {
    const { payed, typeSafe } = req.body;

    if (!payed || payed <= 0) {
      return res.status(400).json({ error: "يجب إدخال مبلغ صحيح" });
    }
    if (!typeSafe) {
      return res.status(400).json({ error: "يجب إدخال نوع الخزنة" });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: "الفاتورة غير موجودة" });
    }

    if (payed > bill.theRest) {
      return res.status(400).json({ error: "المبلغ المدفوع أكبر من المبلغ المتبقي في الفاتورة" });
    }

    console.log("bill.payed قبل push:", bill.payed);

    if (!Array.isArray(bill.payed)) {
      bill.payed = [];
    }

    // ✅ تم تصحيح السطر هنا ✅
    bill.payed.push({ payment: typeSafe, payedPrice: payed });

    bill.pay += payed;
    bill.theRest -= payed;

    // تسجيل الإيداع في `Deposit`
    const depositRecord = new Deposit({
      typeSafe,
      amountDeposit: payed,
      reasonDeposit: `دفعة على فاتورة رقم ${bill.Jobid}`,
    });

    // تحديث الخزنة بزيادة المبلغ المدفوع
    const updatedSafe = await Safe.findOneAndUpdate(
      { typeSafe },
      { $inc: { amountSafe: +payed } }, // إضافة المبلغ إلى الخزنة
      { new: true, upsert: true }
    );

    await bill.save();
    await depositRecord.save();
    
    res.status(200).json({ message: "تم تحديث الفاتورة", bill, depositRecord, updatedSafe });
    
  } catch (error) {
    console.error("خطأ أثناء الدفع:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدفع" });
  }
});


// =========================================== DELETE ===========================================
/*
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
*/


module.exports = router;
