const express = require('express');
const router = express.Router();
const { Safe, Withdraw, } = require("../models/transaction.js")
const { Dealer, } = require("../models/dealer");
const Bill = require('../models/bills');
const upload = require("../middlewares/uploads")
const fs = require('fs');   
const path = require('path');

// اضافة الطلبات امر الشغل
router.post('/add-dealer', async (req, res) => {
  try {
    console.log('Received data:', req.body);
    
    // البحث عن التاجر باستخدام معرّف أو خاصية فريدة (مثل dealerName أو أي خاصية مميزة)
    let dealer = await Dealer.findOne({ dealerName: req.body.dealerName });
    
    if (dealer) {
      // إذا كان التاجر موجودًا، نضيف الـ typeService فقط
      dealer.typeService.push(...req.body.typeService);  // أضف الـ typeService المرسل
      await dealer.save();  // حفظ التحديثات
      
      res.status(200).json({ message: 'تم إضافة خدمة التاجر بنجاح' });
    } else {
      // إذا لم يكن التاجر موجودًا، نقوم بإنشاء تاجر جديد مع الـ typeService
      const dealerService = new Dealer(req.body);
      await dealerService.save();  // حفظ التاجر الجديد مع الـ typeService المرسل

      res.status(201).json({ message: 'تم حفظ التاجر والطلب بنجاح' });
    }
  } catch (err) {
    console.error('يوجد خطاء في حفظ الطلب:', err);
    res.status(500).json({ error: 'يوجد خطاء في حفظ الطلب' });
  }
});

// تحديث المدفوعات لي التجار
router.put("/payed-dealer/:id", async (req, res) => {
  try {
    const { payed, typeSafe } = req.body; // جلب المبلغ ونوع الخزنة من الطلب

    // التحقق من صحة المبلغ المدفوع
    if (!payed || payed <= 0) {
      return res.status(400).json({ error: "يجب إدخال مبلغ صحيح" });
    }

    // البحث عن التاجر
    let dealer = await Dealer.findById(req.params.id);
    if (!dealer) {
      return res.status(404).json({ error: "التاجر غير موجود" });
    }

    // التأكد من أن المبلغ المدفوع لا يتجاوز المتبقي في حساب التاجر
    if (dealer.theRest < payed) {
      return res.status(400).json({ error: "المبلغ المدفوع أكبر من المتبقي" });
    }

    // التأكد من وجود رصيد كافٍ في الخزنة
    const safe = await Safe.findOne({ typeSafe });
    if (!safe) {
      return res.status(400).json({ error: "الخزنة غير موجودة" });
    }

    if (safe.amountSafe < payed) {
      return res.status(400).json({ error: "رصيد غير كافٍ في الخزنة" });
    }

    // تحديث المبلغ المدفوع والمتبقي في `Dealer`
    dealer.payed += payed;
    dealer.theRest = dealer.totalPriceBuy - dealer.payed;

    // إضافة سجل السحب في `Withdraw`
    const withdrawRecord = new Withdraw({
      typeSafe,
      amountWithdraw: payed,
      typeWithdraw: dealer.service,
      payee: dealer.dealerName,
      reasonWithdraw: 'تم سداد مبلغ'
    });

    // تحديث الخزنة
    const updatedSafe = await Safe.findOneAndUpdate(
      { typeSafe },
      { $inc: { amountSafe: -payed } },
      { new: true, upsert: true }
    );

    // حفظ جميع التحديثات
    await dealer.save();
    await withdrawRecord.save();

    // إرجاع النتيجة
    res.status(200).json({
      message: "تم تحديث الدفع وتسجيل العملية في الخزنة",
      dealer,
      withdrawRecord,
      updatedSafe
    });

  } catch (error) {
    console.error("خطأ أثناء تحديث الدفع:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تحديث الدفع" });
  }
});

// تحديث بيانات التاجر بناءً على الـ itemId
router.put("/edit-dealer/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { dealerName, dealerPhone, service } = req.body; // البيانات التي ستتحدث (مثل اسم التاجر، رقم التاجر، نوع الخدمة)

    // البحث عن التاجر باستخدام الـ ID
    const dealer = await Dealer.findById(id);
    if (!dealer) {
      return res.status(404).json({ error: "التاجر غير موجود" });
    }

    // تحديث بيانات التاجر
    if (dealerName) dealer.dealerName = dealerName;
    if (dealerPhone) dealer.dealerPhone = dealerPhone;
    if (service) dealer.service = service;

    // حفظ التحديثات في قاعدة البيانات
    await dealer.save();

    res.status(200).json({ message: "تم تحديث بيانات التاجر بنجاح", dealer });
  } catch (error) {
    console.error("خطأ أثناء تحديث التاجر:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تحديث التاجر" });
  }
});

/*
router.put("/edit-service/:dealerId/:serviceId", async (req, res) => {
  try {
    const { dealerId, serviceId } = req.params;
    const updatedServiceData = req.body;

    // تجهيز كائن التحديث فقط بالقيم غير الفارغة
    let updateFields = {};
    Object.keys(updatedServiceData).forEach((key) => {
      if (updatedServiceData[key] !== undefined && updatedServiceData[key] !== "") {
        updateFields[`typeService.$.${key}`] = updatedServiceData[key];
      }
    });

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "لم يتم إرسال بيانات لتحديثها" });
    }

    // تحديث القيم المحددة فقط داخل typeService
    let dealer = await Dealer.findOneAndUpdate(
      { _id: dealerId, "typeService._id": serviceId },
      { $set: updateFields },
      { new: true }
    );

    if (!dealer) {
      return res.status(404).json({ error: "التاجر أو الخدمة غير موجودة" });
    }

    // إعادة حساب totalPriceBuy و totalPriceSell بعد التعديل
    dealer.totalPriceBuy = dealer.typeService.reduce(
      (acc, item) => acc + ((item.servicePriceBuy || 0) * (item.count || 1)), 0
    );
    dealer.totalPriceSell = dealer.typeService.reduce(
      (acc, item) => acc + ((item.servicePriceSell || 0) * (item.count || 1)), 0
    );
    dealer.theRest = dealer.totalPriceBuy - dealer.payed;

    // حفظ التعديلات بعد الحسابات الجديدة
    await dealer.save();

    res.status(200).json({ message: "تم تعديل الخدمة بنجاح", dealer });
  } catch (error) {
    console.error("خطأ أثناء تعديل الخدمة:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تعديل الخدمة" });
  }
});
*/

// تحديث الخدمة مع إمكانية تغيير الصورة
router.put("/edit-service/:dealerId/:serviceId", upload.single("serviceImage"), async (req, res) => {
  try {
    const { dealerId, serviceId } = req.params;
    const updatedServiceData = req.body;
    let updateFields = {};

    // تجهيز البيانات التي سيتم تحديثها
    Object.keys(updatedServiceData).forEach((key) => {
      if (updatedServiceData[key] !== undefined && updatedServiceData[key] !== "") {
        updateFields[`typeService.$.${key}`] = updatedServiceData[key];
      }
    });

    // التحقق مما إذا كان هناك صورة جديدة مرفوعة
    if (req.file) {
      // العثور على التاجر لمعرفة الصورة القديمة
      const dealer = await Dealer.findOne({ _id: dealerId, "typeService._id": serviceId });

      if (!dealer) {
        return res.status(404).json({ error: "التاجر أو الخدمة غير موجودة" });
      }

      // البحث عن الخدمة المطلوبة
      const serviceIndex = dealer.typeService.findIndex((s) => s._id.toString() === serviceId);
      if (serviceIndex === -1) {
        return res.status(404).json({ error: "الخدمة غير موجودة" });
      }

      // حذف الصورة القديمة إذا وجدت
      const service = dealer.typeService[serviceIndex];
      if (service.imageName) {
        const oldImagePath = path.join(__dirname, "../images", service.imageName);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // تحديث الصورة الجديدة
      updateFields[`typeService.${serviceIndex}.serviceImage`] = req.file.path; // تحديث المسار للصورة الجديدة
      updateFields[`typeService.${serviceIndex}.imageName`] = req.file.filename; // تحديث اسم الصورة
    }

    // التأكد من وجود بيانات للتحديث
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "لم يتم إرسال بيانات لتحديثها" });
    }

    // تحديث القيم المحددة داخل typeService
    let dealer = await Dealer.findOneAndUpdate(
      { _id: dealerId, "typeService._id": serviceId },
      { $set: updateFields },
      { new: true }
    );

    if (!dealer) {
      return res.status(404).json({ error: "التاجر أو الخدمة غير موجودة" });
    }

    // إعادة حساب totalPriceBuy و totalPriceSell بعد التعديل
    dealer.totalPriceBuy = dealer.typeService.reduce(
      (acc, item) => acc + ((item.servicePriceBuy || 0) * (item.count || 1)), 0
    );
    dealer.totalPriceSell = dealer.typeService.reduce(
      (acc, item) => acc + ((item.servicePriceSell || 0) * (item.count || 1)), 0
    );
    dealer.theRest = dealer.totalPriceBuy - dealer.payed;

    // حفظ التعديلات بعد الحسابات الجديدة
    await dealer.save();


    // =============== تحديث الفاتورة بناءً على billNumber ===============
    const services = dealer.typeService.find((s) => s._id.toString() === serviceId);
    if (!services || !services.billNumber) {
      return res.status(404).json({ error: "لم يتم العثور على رقم الفاتورة المرتبط بالخدمة" });
    }
    // البحث عن الفاتورة المرتبطة بالخدمة
    let bills = await Bill.findOne({ Jobid: services.billNumber });
    if (!bills) {
      return res.status(404).json({ error: "لم يتم العثور على الفاتورة المرتبطة بالخدمة" });
    }

    bills.newparts = bills.newparts.map((p) => {
      if (p.dealerName.trim() === dealer.dealerName.trim()) {
        return { ...p, pricebuy: services.servicePriceBuy || 0, quantity: services.count || 1 };
      }
      return p;
    });
    
    bills.outjob = bills.outjob.map((j) => {
      if (j.dealerName.trim() === dealer.dealerName.trim()) {
        return { ...j, jobPriceBuy: services.servicePriceBuy || 0 };
      }
      return j;
    });
    
    bills.markModified("newparts");
    bills.markModified("outjob");
    await bills.save();


    res.status(200).json({ message: "تم تعديل الخدمة بنجاح", dealer, bills });
  } catch (error) {
    console.error("خطأ أثناء تعديل الخدمة:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تعديل الخدمة" });
  }
});



// عرض جميع التجار
router.get('/read-dealer', async (req, res) => {
    try {
      const dealers = await Dealer.find(); // جلب كل التجار من قاعدة البيانات
      console.log("✅ بيانات التجار:", dealers);
      res.status(200).json(dealers); // إرسال التجار كـ response
    } catch (err) {
      console.error('يوجد خطاء في جلب التجار:', err);
      res.status(500).json({ error: 'يوجد خطاء في جلب التجار' });
    }
});

router.get("/read-dealer/:itemId", async (req, res) => {
    const { itemId } = req.params;
    console.log(itemId)
    try {
      const dealer = await Dealer.findById(itemId);
      if (!dealer) {
        return res.status(404).json({ message: "Dealer not found" });
      }
      res.json(dealer); // إرجاع الـ dealer المطلوب
    } catch (error) {
      console.error("Error fetching dealer:", error);
      res.status(500).json({ message: "Error fetching dealer" });
    }
});


router.get('/total-report', async (req, res) => {
  try {
    const result = await Dealer.aggregate([
      {
        $group: {
          _id: null,
          totalPriceBuy: { $sum: '$totalPriceBuy' },
          totalPriceSell: { $sum: '$totalPriceSell' },
          payed: { $sum: '$payed' },
          theRest: { $sum: '$theRest' },
        }
      }
    ]);

    // إرسال القيم الافتراضية إذا لم يكن هناك بيانات
    const data = result[0] || { totalPriceBuy: 0, totalPriceSell: 0, payed: 0, theRest: 0 };

    res.status(200).json(data);
  } catch (err) {
    console.error('خطأ في حساب البيانات:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب البيانات' });
  }
});

router.delete("/delete-dealer/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;  // استلام السبب من الطلب

    // البحث عن التاجر باستخدام الـ ID
    const dealer = await Dealer.findByIdAndDelete(id);
    if (!dealer) {
      return res.status(404).json({ error: "التاجر غير موجود" });
    }

    res.status(200).json({ message: "تم حذف التاجر بنجاح", reason });
  } catch (error) {
    console.error("خطأ أثناء حذف التاجر:", error);
    res.status(500).json({ error: "حدث خطأ أثناء حذف التاجر" });
  }
});

router.delete("/delete-service/:dealerId/:serviceId", async (req, res) => {
  try {
    const { dealerId, serviceId } = req.params;

    // جلب بيانات الـ dealer
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) return res.status(404).json({ message: "Dealer not found" });

    // البحث عن الخدمة المطلوبة داخل typeService
    const serviceIndex = dealer.typeService.findIndex(item => item._id.toString() === serviceId);
    if (serviceIndex === -1) {
      return res.status(404).json({ message: "Service not found" });
    }

    // حذف الخدمة المحددة
    dealer.typeService.splice(serviceIndex, 1);

    // تحديث الحسابات
    dealer.totalPriceBuy = dealer.typeService.reduce((acc, item) => acc + ((item.servicePriceBuy || 0) * (item.count || 1)), 0);
    dealer.totalPriceSell = dealer.typeService.reduce((acc, item) => acc + ((item.servicePriceSell || 0) * (item.count || 1)), 0);
    dealer.theRest = dealer.totalPriceBuy - dealer.payed;

    // حفظ التعديلات في قاعدة البيانات
    await dealer.save();

    res.status(200).json({ message: "Service deleted and totals updated successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





module.exports = router;
