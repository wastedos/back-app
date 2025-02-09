const express = require('express');
const router = express.Router();
const JobOrder = require('../models/joborder');
const Bill = require('../models/bills');
const { Safe, Deposit, } = require("../models/transaction");
const { Dealer, } = require("../models/dealer");
const { Product, Income, Outgo, ReturnIncome, ReturnOutgo, Historywarehouse } = require("../models/warehouse");


// اضافة الطلبات امر الشغل
router.post('/add', async (req, res) => {
  try {
    console.log('Received data:', req.body); // طباعة البيانات الواردة للتصحيح
    const newOrder = new JobOrder(req.body);
    await newOrder.save();

    res.status(201).json({ message: 'Job order added successfully' });
  } catch (err) {
    console.error('Error saving job order:', err);
    res.status(500).json({ error: 'Failed to save job order' });
  }
});


// حذف طلب تشغيل عند إصدار فاتورة
router.delete('/bills-byid/:id', async (req, res) => {
  try {
    // البحث عن الطلب باستخدام المعرف
    const jobOrder = await JobOrder.findById(req.params.id);
    if (!jobOrder) {
      return res.status(404).json({ message: 'Job order not found' });
    }

    // تحقق مسبق من وجود كل الأجزاء
    const missingParts = [];
    for (const part of jobOrder.parts) {
      const product = await Product.findOne({ code: part.code });
      if (!product) {
        missingParts.push(part.code); // أضف الكود إلى قائمة الأجزاء المفقودة
      }
    }

    // إذا كانت هناك أجزاء مفقودة، أعد استجابة بخطأ
    if (missingParts.length > 0) {
      return res.status(404).json({
        error: 'بعض الأجزاء غير موجودة في المخزن',
        missingParts, // قائمة الأكواد المفقودة
      });
    }
    const lastBill = await Bill.findOne().sort({ Jobid: -1 });
    let newJobid = lastBill ? lastBill.Jobid + 1 : 1;
    // إنشاء فاتورة جديدة في مجموعة bills
    const newBill = new Bill({
      Jobid: newJobid,
      clientName: jobOrder.clientName,
      clientPhone: jobOrder.clientPhone,
      carModel: jobOrder.carModel,
      carColor: jobOrder.carColor,
      carKm: jobOrder.carKm,
      parts: jobOrder.parts,
      newparts: jobOrder.newparts,
      jobs: jobOrder.jobs,
      outjob: jobOrder.outjob,
      other: jobOrder.other,
      payment: jobOrder.payment,
      invoice: jobOrder.invoice,
      discount: jobOrder.discount,
      total: jobOrder.total,
      createdAt: jobOrder.createdAt,
    });
    await newBill.save(); // حفظ الفاتورة في مجموعة bills

    // تحديث المخزن وسحب القطع من الكمية المتاحة
    const outgoRecords = [];
    for (const part of jobOrder.parts) {
      const product = await Product.findOne({ code: part.code });

      // تحديث الكمية في المخزن
      product.quantity -= part.quantity;
      product.outgo = (product.outgo || 0) + part.quantity;
      await product.save();

      // إضافة سجل في جدول Outgo
      const outgo = new Outgo({
        code: product.code,
        billnumber: newJobid || 0,
        category: product.category,
        brand: product.brand,
        quantity: part.quantity,
        qtyoutgo: part.quantity,
        price: part.pricesell,
        total: part.quantity * part.pricesell,
        buyer: jobOrder.clientName || 'غير محدد',
        buyerphone: jobOrder.clientPhone || 'غير محدد',
      });
      await outgo.save();
      outgoRecords.push(outgo);
    }

    // إضافة الأموال إلى السيف
    const AddtoDeposit = new Deposit({
      typeSafe: jobOrder.payment,
      amountDeposit: jobOrder.total,
      reasonDeposit: `حساب فاتورة رقم ${newJobid || 0}`,
    });
    await AddtoDeposit.save();

    const AddtoSafe = await Safe.findOneAndUpdate(
      { typeSafe: jobOrder.payment }, // البحث حسب نوع السيف
      { $inc: { amountSafe: jobOrder.total } }, // زيادة المبلغ الحالي
      { new: true, upsert: true } // إنشاء مستند جديد إذا لم يكن موجودًا
    );

    
    // ====== 🔥 إضافة بيانات التاجر (Dealer) 🔥 ======
    for (const job of jobOrder.outjob) {
      let dealer = await Dealer.findOne({ dealerName: job.dealerName });

      if (!dealer) {
        // إذا لم يكن التاجر موجودًا، نقوم بإنشائه
        dealer = new Dealer({
          dealerName: job.dealerName,
          delaerPhone: jobOrder.clientPhone, // لو عندك رقم التاجر ضيفه هنا
          service: 'أعمال خارجية',
          typeService: [],
        });
      }

      // إضافة الخدمة إلى `typeService`
      dealer.typeService.push({
        type: job.jobName,
        count: job.quantity,
        servicePriceBuy: job.jobPriceBuy,
        servicePriceSell: job.jobPriceSell,
        billNumber: newJobid,
      });

      await dealer.save(); // حفظ التاجر بعد التحديث
    }

    for (const part of jobOrder.newparts) {
      let dealer = await Dealer.findOne({ dealerName: part.dealerName });

      if (!dealer) {
        // إذا لم يكن التاجر موجودًا، نقوم بإنشائه
        dealer = new Dealer({
          dealerName: part.dealerName,
          delaerPhone: jobOrder.clientPhone, // لو عندك رقم التاجر ضيفه هنا
          service: 'قطع استيراد',
          typeService: [],
        });
      }

      // إضافة القطعة إلى `typeService`
      dealer.typeService.push({
        type: part.category,
        count: part.quantity,
        servicePriceBuy: part.pricebuy,
        servicePriceSell: part.pricesell,
        billNumber: newJobid,
      });

      await dealer.save(); // حفظ التاجر بعد التحديث
    }
    // ====== 🔥 نهاية إضافة بيانات التاجر 🔥 ======


    // حذف الطلب من مجموعة joborders
    await jobOrder.deleteOne();

    res.status(200).json({
      message: 'تم إنشاء الفاتورة وحذف الطلب بنجاح',
      bill: newBill,
      outgoRecords,
      safe: AddtoSafe,
    });
  } catch (err) {
    console.error('Error processing job order:', err);
    res.status(500).json({ message: 'Error processing job order', error: err.message });
  }
});



// الحصول على جميع الطلبات المؤقتة
router.get('/temporary', async (req, res) => {
  try {
    const orders = await JobOrder.find();
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching job orders', error: err.message });
  }
});


router.get('/job-byid/:id', async (req, res) => {
  try {
    const orders = await JobOrder.findById(req.params.id);
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching job orders', error: err.message });
  }
});


router.put('/update-byid/:id', async (req, res) => {
  try {
    // 1. Find the job order by ID and update it
    const updatedOrder = await JobOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Job order not found' });
    }

    // 2. Calculate the total manually (same logic as in the pre-save middleware)
    const partsTotal = updatedOrder.parts.reduce((sum, part) => sum + (part.quantity * part.price || 0), 0);
    const newPartsTotal = updatedOrder.newparts.reduce((sum, part) => sum + (part.quantity * part.pricesell || 0), 0);
    const outjobTotal = updatedOrder.outjob.reduce((sum, job) => sum + (job.jobPriceSell || 0), 0);
    const otherTotal = updatedOrder.other.reduce((sum, item) => sum + (item.otherPrice || 0), 0);

    // 3. Update the total field
    updatedOrder.total = partsTotal + newPartsTotal + outjobTotal + otherTotal + updatedOrder.invoice - (updatedOrder.discount || 0);

    // 4. Save the updated order with the new total
    await updatedOrder.save();

    res.status(200).json({ message: 'Job order updated successfully', updatedOrder });
  } catch (err) {
    res.status(500).json({ message: 'Error updating job order', error: err.message });
  }
});


// حذف طلب تشغيل عند إصدار فاتورة
router.delete('/delete-byid/:id', async (req, res) => {
  try {
    const deletedOrder = await JobOrder.findByIdAndDelete(req.params.id);
    if (!deletedOrder) {
      return res.status(404).json({ message: 'Job order not found' });
    }
    res.status(200).json({ message: 'Job order deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting job order', error: err.message });
  }
});

module.exports = router;
