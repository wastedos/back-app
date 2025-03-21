const express = require('express');
const router = express.Router();
const JobOrder = require('../models/joborder');
const Bill = require('../models/bills');
const { Safe, Deposit, } = require("../models/transaction");
const { Dealer, } = require("../models/dealer");
const { Product, Income, Outgo, ReturnIncome, ReturnOutgo, Historywarehouse } = require("../models/warehouse");
const upload = require("../middlewares/uploads")
const fs = require('fs');   
const path = require('path');

// اضافة الطلبات أمر الشغل
const mongoose = require("mongoose");

router.post("/add", upload.fields([{ name: 'newpartsImage', maxCount: 20 }, { name: 'outjobImage', maxCount: 20 }]), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const newOrderData = {
      clientName: req.body.clientName,
      clientPhone: req.body.clientPhone,
      carModel: req.body.carModel,
      carColor: req.body.carColor,
      carKm: req.body.carKm,
      chassis: req.body.chassis,
      discount: req.body.discount || 0,
      payment: req.body.payment || "",
      jobs: req.body.jobs ? JSON.parse(req.body.jobs) : [],
      parts: req.body.parts ? JSON.parse(req.body.parts) : [],
      outjob: req.body.outjob ? JSON.parse(req.body.outjob) : [],
      other: req.body.other ? JSON.parse(req.body.other) : [],
      payed: req.body.payed ? JSON.parse(req.body.payed) : [],
      invoice: req.body.invoice ? JSON.parse(req.body.invoice) : [],
      newparts: req.body.newparts ? JSON.parse(req.body.newparts) : [],
    };

    // ربط الصور بالأجزاء والوظائف الخارجية
    if (req.files['newpartsImage']) {
      newOrderData.newparts.forEach((part, index) => {
        part.imageName = req.files['newpartsImage'][index]?.filename;
      });
    }

    if (req.files['outjobImage']) {
      newOrderData.outjob.forEach((out, index) => {
        out.imageName = req.files['outjobImage'][index]?.filename;
      });
    }

    // حساب إجمالي الفاتورة بعد الخصم
    const totalAfterDiscount = newOrderData.parts.reduce((sum, part) => sum + (part.quantity * part.pricesell || 0), 0) +
                               newOrderData.newparts.reduce((sum, part) => sum + (part.quantity * part.pricesell || 0), 0) +
                               newOrderData.outjob.reduce((sum, job) => sum + (job.jobPriceSell || 0), 0) +
                               newOrderData.other.reduce((sum, item) => sum + (item.otherPrice || 0), 0) +
                               newOrderData.invoice.reduce((sum, item) => sum + (item.invoicePrice || 0), 0) -
                               (newOrderData.discount || 0);

    // حساب إجمالي المدفوعات
    const payedTotal = newOrderData.payed.reduce((sum, item) => sum + (item.payedPrice || 0), 0);

    // حساب المبلغ المتبقي
    const remainingAmount = totalAfterDiscount - payedTotal;

    // التحقق من أن المدفوع لا يتجاوز المتبقي
    if (payedTotal > totalAfterDiscount) {
      return res.status(400).json({
        message: "❌ Error: Payment amount exceeds the remaining balance!",
        totalInvoice: totalAfterDiscount,
        attemptedPayment: payedTotal,
        remainingAmount: remainingAmount
      });
    }

    // إنشاء الطلب الجديد داخل الـ transaction
    const newOrder = new JobOrder({ ...newOrderData, total: totalAfterDiscount, theRest: remainingAmount, pay: payedTotal });
    await newOrder.save({ session });

    // إضافة المدفوعات إلى Deposit وتحديث Safe داخل الـ transaction
    if (newOrder.payed.length > 0) {
      for (const payed of newOrder.payed) {
        const payedAmount = parseFloat(payed.payedPrice) || 0;

        const AddtoDeposit = new Deposit({
          typeSafe: payed.payment,
          amountDeposit: payedAmount,
          reasonDeposit: `دفعة من أمر شغل بي اسم - (${req.body.clientName})`,
        });

        await AddtoDeposit.save({ session });

        await Safe.findOneAndUpdate(
          { typeSafe: payed.payment },
          { $inc: { amountSafe: payedAmount } },
          { new: true, upsert: true, session }
        );
      }
    }

    // **إذا وصلنا هنا، كل العمليات تمت بنجاح، نقوم بتثبيت الـ transaction**
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: "✅ Job order added successfully", newOrder });

  } catch (err) {
    // **في حالة الخطأ، يتم التراجع عن كل العمليات وعدم إنشاء أمر الشغل**
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Error saving job order:", err);
    res.status(500).json({ error: "Failed to save job order" });
  }
});


// update joborder byid
router.put('/update-byid/:id', upload.fields([{ name: 'newpartsImage', maxCount: 5 }, { name: 'outjobImage', maxCount: 5 }]), async (req, res) => {
  try {
    
    // 1. البحث عن الطلب القديم
    const existingOrder = await JobOrder.findById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Job order not found' });
    }

    // 2. حذف الصور القديمة لو تم رفع صور جديدة
    const deleteOldImages = (oldImages = [], newImages = []) => {
      if (!Array.isArray(oldImages) || !Array.isArray(newImages)) {
        console.error("❌ Error: oldImages or newImages is not an array.");
        return;
      }
    
      if (newImages.length > 0 && oldImages.length > 0) {
        oldImages.forEach(image => {
          if (!image?.imageName) {
            console.warn("⚠️ Warning: imageName is undefined or null for image:", image);
            return;
          }
    
          const oldImagePath = path.join(__dirname, '../images/', image.imageName);
          if (fs.existsSync(oldImagePath)) {
            try {
              fs.unlinkSync(oldImagePath);
              console.log(`✅ Deleted old image: ${oldImagePath}`);
            } catch (err) {
              console.error("❌ Error deleting image:", err);
            }
          } else {
            console.warn(`⚠️ Image not found: ${oldImagePath}`);
          }
        });
      }
    };

    if (req.files['newpartsImage']) {
      deleteOldImages(existingOrder.newparts, req.files['newpartsImage']);
    }

    if (req.files['outjobImage']) {
      deleteOldImages(existingOrder.outjob, req.files['outjobImage']);
    }

    // 3. تحديث البيانات
    const updatedData = {
      clientName: req.body.clientName,
      clientPhone: req.body.clientPhone,
      carModel: req.body.carModel,
      carColor: req.body.carColor,
      carKm: req.body.carKm,
      chassis: req.body.chassis,
      discount: req.body.discount || "",
      payment: req.body.payment || "",
      jobs: req.body.jobs ? JSON.parse(req.body.jobs) : existingOrder.jobs,
      parts: req.body.parts ? JSON.parse(req.body.parts) : existingOrder.parts,
      outjob: req.body.outjob ? JSON.parse(req.body.outjob) : existingOrder.outjob,
      other: req.body.other ? JSON.parse(req.body.other) : existingOrder.other,
      payed: req.body.payed ? JSON.parse(req.body.payed) : existingOrder.payed,
      invoice: req.body.invoice ? JSON.parse(req.body.invoice) : existingOrder.invoice,
      newparts: req.body.newparts ? JSON.parse(req.body.newparts) : existingOrder.newparts,
    };

    // 4. تحديث الصور لو فيه صور جديدة
    if (req.files['newpartsImage']) {
      updatedData.newparts.forEach((part, index) => {
        part.imageName = req.files['newpartsImage'][index]?.filename || part.imageName;
      });
    }

    if (req.files['outjobImage']) {
      updatedData.outjob.forEach((out, index) => {
        out.imageName = req.files['outjobImage'][index]?.filename || out.imageName;
      });
    }

    // 5. تحديث الطلب في قاعدة البيانات
    const updatedOrder = await JobOrder.findByIdAndUpdate(req.params.id, updatedData, { new: true });

    // 6. إعادة حساب الإجمالي
    const calculateTotal = (arr, key, multiplier = 1) => arr.reduce((sum, item) => sum + ((item[key] || 0) * (item[multiplier] || 1)), 0);
    const partsTotal = calculateTotal(updatedOrder.parts, "price", "quantity");
    const newPartsTotal = calculateTotal(updatedOrder.newparts, "pricesell", "quantity");
    const outjobTotal = calculateTotal(updatedOrder.outjob, "jobPriceSell");
    const otherTotal = calculateTotal(updatedOrder.other, "otherPrice");
    const payedTotal = calculateTotal(updatedOrder.payed, "payedPrice");
    const invoiceTotal = calculateTotal(updatedOrder.invoice, "invoicePrice");

    updatedOrder.total = partsTotal + newPartsTotal + outjobTotal + otherTotal + invoiceTotal - (updatedOrder.discount || 0);
    updatedOrder.theRest = updatedOrder.total - payedTotal
    updatedOrder.pay = payedTotal
    // 7. حفظ التعديلات
    await updatedOrder.save();

    // 8. إضافة آخر دفعة فقط إلى `Deposit` وتحديث `Safe`
    const oldPayedCount = existingOrder.payed.length;
    const newPayedCount = updatedOrder.payed.length;

    if (newPayedCount > oldPayedCount) {
      const latestPayed = updatedOrder.payed[newPayedCount - 1]; // آخر دفعة مضافة فقط

      if (latestPayed) {
        const payedAmount = parseFloat(latestPayed.payedPrice) || 0;

        // ✅ إضافة الدفع إلى Deposit
        const AddtoDeposit = new Deposit({
          typeSafe: latestPayed.payment,
          amountDeposit: payedAmount,
          reasonDeposit: ` دفعة من أمر الشغل باسم - (${req.body.clientName})`,
        });

        await AddtoDeposit.save();

        // ✅ تحديث `Safe` فقط بهذه الدفعة
        await Safe.findOneAndUpdate(
          { typeSafe: latestPayed.payment },  
          { $inc: { amountSafe: payedAmount } }, 
          { new: true, upsert: true }
        );
      }
    }

    res.status(200).json({ message: '✅ Job order updated successfully', updatedOrder });
  } catch (err) {
    console.error("❌ Error updating job order:", err);
    res.status(500).json({ message: 'Error updating job order', error: err.message });
  }
});


// =============================> حذف طلب تشغيل عند إصدار فاتورة <=============================
let processingJobs = new Set(); 
router.delete('/bills-byid/:id', async (req, res) => {
  const jobOrderId = req.params.id;
  
  // تحقق من إذا كان الطلب قد تم معالجته مسبقًا
  if (processingJobs.has(jobOrderId)) {
    return res.status(400).json({ message: 'هذا الطلب قيد المعالجة بالفعل' });
  }

  try {
    processingJobs.add(jobOrderId);

    // البحث عن الطلب باستخدام المعرف
    const jobOrder = await JobOrder.findById(req.params.id);
    if (!jobOrder) {
      return res.status(404).json({ message: 'Job order not found' });
    }

    // تحقق من توفر الأجزاء والكمية المطلوبة
    const insufficientParts = [];

    for (const part of jobOrder.parts) {
      const product = await Product.findOne({ code: part.code });

      if (!product) {
        insufficientParts.push({ code: part.code, issue: 'غير موجود في المخزن' });
      } else if (product.quantity < part.quantity) {
        insufficientParts.push({ 
          code: part.code, 
          issue: `الكمية غير كافية، المتاح: ${product.quantity}, المطلوب: ${part.quantity}` 
        });
      }
    }

    // إذا كانت هناك أجزاء غير متوفرة أو كميتها غير كافية، أعد استجابة بخطأ
    if (insufficientParts.length > 0) {
      return res.status(400).json({
        error: 'بعض الأجزاء غير متوفرة أو كميتها غير كافية',
        details: insufficientParts, // تفاصيل الأجزاء التي بها مشكلة
      });
    }

    console.log('Job Order Data:', jobOrder);

    const lastBill = await Bill.findOne().sort({ Jobid: -1 });
    let newJobid = lastBill ? lastBill.Jobid + 1 : 1;
    // إنشاء فاتورة جديدة في مجموعة bills
    const newBill = new Bill({
      Jobid: newJobid,
      clientName: jobOrder.clientName,
      clientPhone: jobOrder.clientPhone,
      carModel: jobOrder.carModel,
      carColor: jobOrder.carColor,
      chassis: jobOrder.chassis,
      carKm: jobOrder.carKm,
      parts: jobOrder.parts,
      newparts: jobOrder.newparts,
      jobs: jobOrder.jobs,
      outjob: jobOrder.outjob,
      other: jobOrder.other,
      payment: jobOrder.payment,
      payed: jobOrder.payed,
      invoice: jobOrder.invoice,
      discount: jobOrder.discount,
      total: jobOrder.total,
      pay: jobOrder.pay,
      theRest: jobOrder.theRest,
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
        codeCategory: product.codeCategory,
        billnumber: newJobid || 0,
        carModel: product.carModel,
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

    let AddtoSafe = null;
    // سداد باقي الفاتورة أثناء الحذف
    if (jobOrder.payment) {
      // تحقق من أن مصفوفة `payed` موجودة
      if (!Array.isArray(newBill.payed)) {
        newBill.payed = [];
      }

      // إضافة الدفع إلى الفاتورة
      newBill.payed.push({
        payment: jobOrder.payment,
        payedPrice: jobOrder.theRest,
      });

      // تحديث المبالغ المدفوعة والمتبقية
      newBill.pay += jobOrder.theRest;
      newBill.theRest = 0; // دفع كامل من المبلغ المتبقي

      await newBill.save();

      // إضافة الأموال إلى السيف
      const AddtoDeposit = new Deposit({
        typeSafe: jobOrder.payment,
        amountDeposit: jobOrder.theRest,
        reasonDeposit: `حساب فاتورة رقم ${newJobid || 0}`,
      });
      await AddtoDeposit.save();

      const AddtoSafe = await Safe.findOneAndUpdate(
        { typeSafe: jobOrder.payment }, // البحث حسب نوع السيف
        { $inc: { amountSafe: jobOrder.theRest } }, // زيادة المبلغ الحالي
        { new: true, upsert: true } // إنشاء مستند جديد إذا لم يكن موجودًا
      );
      // إرجاع قيمة `AddtoSafe` إذا تم إضافتها بنجاح
    }



    // ====== 🔥 إضافة بيانات التاجر (Dealer) 🔥 ======
    for (const job of jobOrder.outjob) {
      let dealer = await Dealer.findOne({ dealerName: job.dealerName });

      /*
      if (!dealer) {
        // إذا لم يكن التاجر موجودًا، نقوم بإنشائه
        dealer = new Dealer({
          dealerName: job.dealerName,
          delaerPhone: jobOrder.clientPhone, // لو عندك رقم التاجر ضيفه هنا
          service: 'أعمال خارجية',
          typeService: [],
        });
      }*/

      // إضافة الخدمة إلى `typeService`
      dealer.typeService.push({
        type: job.jobName,
        count: job.quantity,
        servicePriceBuy: job.jobPriceBuy,
        servicePriceSell: job.jobPriceSell,
        billNumber: newJobid,
        imageName: job.imageName,
      });

      await dealer.save(); // حفظ التاجر بعد التحديث
    }

    for (const part of jobOrder.newparts) {
      let dealer = await Dealer.findOne({ dealerName: part.dealerName });

      /*
      if (!dealer) {
        // إذا لم يكن التاجر موجودًا، نقوم بإنشائه
        dealer = new Dealer({
          dealerName: part.dealerName,
          delaerPhone: jobOrder.clientPhone, // لو عندك رقم التاجر ضيفه هنا
          service: 'قطع استيراد',
          typeService: [],
        });
      }*/

      // إضافة القطعة إلى `typeService`
      dealer.typeService.push({
        type: part.category,
        count: part.quantity,
        servicePriceBuy: part.pricebuy,
        servicePriceSell: part.pricesell,
        billNumber: newJobid,
        imageName: part.imageName,
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
  } finally {
    // ✅ إزالة الطلب من قائمة المعالجة بعد الانتهاء
    processingJobs.delete(jobOrderId);
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
