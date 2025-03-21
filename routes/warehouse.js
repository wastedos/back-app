const express = require("express");
const { Product, Income, Outgo, ReturnIncome, ReturnOutgo, Historywarehouse } = require("../models/warehouse");
const { Dealer } = require("../models/dealer")
const mongoose = require('mongoose');
const router = express.Router();

/* ===================================== POST ===================================== */
// Add income
router.post("/add-income", async (req, res) => {
  const { code, codeCategory, billnumber, carModel, category, brand, quantity, price, dealerName } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction(); // 🟢 نبدأ المعاملة

  try {
    const existingProduct = await Product.findOne({ code }).session(session);

    // إضافة سجل الدخل
    const income = new Income({
      code,
      codeCategory,
      billnumber,
      carModel,
      category,
      brand,
      quantity,
      price,
      total: quantity * price,
      dealerName,
    });
    await income.save({ session });

    // البحث عن التاجر
    const dealer = await Dealer.findOne({ dealerName }).session(session);
    if (!dealer) {
      throw new Error("Dealer not found!");
    }

    // تحديث بيانات التاجر
    dealer.typeService.push({
      type: category,
      count: quantity,
      servicePriceBuy: price,
      servicePriceSell: 0,
      code: code,
      billNumber: income.billnumber,
    });
    await dealer.save({ session });

    // تحديث المنتج أو إنشاؤه
    if (existingProduct) {
      existingProduct.quantity += Number(quantity);
      existingProduct.income += Number(quantity);
      existingProduct.price = price;
      existingProduct.total = existingProduct.quantity * price;
      await existingProduct.save({ session });
    } else {
      const newProduct = new Product({
        code,
        codeCategory,
        category,
        carModel,
        brand,
        income: quantity,
        outgo: 0,
        returnin: 0,
        returnout: 0,
        quantity,
        price,
        total: quantity * price,
        return: 0,
      });
      await newProduct.save({ session });
    }

    await session.commitTransaction(); // ✅ تأكيد العملية
    session.endSession();

    res.status(201).json({ message: "Income and product processed successfully." });

  } catch (error) {
    await session.abortTransaction(); // ❌ إلغاء العملية إذا حدث خطأ
    session.endSession();
    console.error("Transaction failed:", error.message);
    res.status(500).json({ error: "Transaction failed: " + error.message });
  }
});


// Add Return Income
router.post("/add-returnIncome", async (req, res) => {
  const { code, quantity, billnumber } = req.body;
  console.log(req.body);

  try {
    const existingIncome = await Income.findOne({ billnumber });
    if (!existingIncome) {
      return res.status(404).json({ message: "Income not found." });
    }

    const existingProduct = await Product.findOne({ code });
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    // تحقق إذا كانت الكمية المطلوبة تتجاوز الكمية المتاحة
    if (existingProduct.quantity < quantity) {
      return res.status(400).json({ message: "Requested quantity exceeds available quantity." });
    }

    // إنشاء سجل العائد
    const returnincome = new ReturnIncome({
      code,
      carModel: existingProduct.carModel,
      category: existingProduct.category,
      brand: existingProduct.brand,
      quantity,
      price: existingProduct.price,
      total: Number(quantity) * Number(existingProduct.price),
      billnumber: existingIncome.billnumber,
      dealerName: existingIncome.dealerName,
    });
    await returnincome.save();

    // تحديث المنتج
    existingProduct.quantity -= Number(quantity);
    existingProduct.income -= Number(quantity);
    existingProduct.returnin += Number(quantity);
    existingProduct.total = existingProduct.quantity * existingProduct.price;
    await existingProduct.save();

    // تحديث التجار
    const dealer = await Dealer.findOne({ dealerName: existingIncome.dealerName });
    if (dealer) {
      // البحث عن النوع الموجود في typeService بناءً على billnumber
      const existingTypeService = dealer.typeService.find(service => service.billNumber == existingIncome.billnumber);
      if (existingTypeService) {
        existingTypeService.count -= quantity; // تعديل الكمية عند الإرجاع
        await dealer.save();
      } else {
        return res.status(404).json({ message: "TypeService not found for this bill number." });
      }
    } else {
      return res.status(404).json({ message: "Dealer not found." });
    }

    res.status(200).json({ message: "Income was returned to warehouse." });
  } catch (error) {
    console.error("Error in /add-returnIncome:", error.message);
    res.status(500).json({ error: error.message });
  }
});




// Add outgo
router.post("/add-outgo", async (req, res) => {
  const { code, quantity, price, billnumber, buyer, buyerphone } = req.body;

  try {
    // البحث عن المنتج باستخدام الكود
    const existingProduct = await Product.findOne({ code });

    if (existingProduct) {
      // التأكد من أن الكمية الموجودة كافية للبيع
      if (existingProduct.quantity >= quantity) {
        // إضافة سجل outgo مع تفاصيله
        const outgo = new Outgo({
          code,
          codeCategory: existingProduct.codeCategory,
          carModel: existingProduct.carModel,
          category: existingProduct.category,
          brand: existingProduct.brand,
          quantity,
          qtyoutgo: quantity,
          price,
          total: quantity * price,
          billnumber,
          buyer,
          buyerphone
        });
        await outgo.save();

        // تحديث الكمية في المنتج الحالي بدون تعديل الكمية في قاعدة بيانات المنتج
        existingProduct.quantity -=  Number(quantity);
        existingProduct.outgo +=  Number(quantity);
        existingProduct.total = existingProduct.quantity * existingProduct.price;
        await existingProduct.save();

        res.status(200).json({ message: "Outgo record added successfully and product updated." });
      } else {
        res.status(400).json({ message: "Insufficient stock for this operation." });
      }
    } else {
      res.status(404).json({ message: "Product not found in inventory." });
    }
  } catch (error) {
    console.error("Error in /add-outgo:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add Return Outgo
router.post("/add-returnoutgo", async (req, res) => {
  console.log("Received Request Body:", req.body); // ✅ تحقق من أن البيانات تصل بشكل صحيح

  const { code, quantity, billnumber, reason } = req.body;

  if (!code || !quantity || !billnumber || !reason) {
    return res.status(400).json({ message: "جميع الحقول مطلوبة." });
  }

  try {
    const existingOutgo = await Outgo.findOne({ billnumber });
    if (!existingOutgo) {
      console.log("Outgo not found");
      return res.status(404).json({ message: "Outgo not found." });
    }

    if (existingOutgo.qtyoutgo >= Number(quantity)){
      existingOutgo.qtyoutgo = existingOutgo.qtyoutgo - Number(quantity);
    }else{
      return res.status(400).json({ message: "عدد القطع غير متوافق"})
    }
    await existingOutgo.save();

    const existingProduct = await Product.findOne({ code });
    if (!existingProduct) {
      console.log("Product not found");
      return res.status(404).json({ message: "المنتج لم يتم العثور علية في المخزن" });
    }

    const returnoutgo = new ReturnOutgo({
      code,
      codeCategory: existingProduct.codeCategory,
      carModel: existingProduct.carModel,
      category: existingProduct.category,
      brand: existingProduct.brand,
      quantity,
      price: existingOutgo.price,
      total: Number(quantity) * Number(existingOutgo.price),
      billnumber: existingOutgo.billnumber,
      buyer: existingOutgo.buyer,
      buyerphone: existingOutgo.buyerphone,
      reason,
    });

    await returnoutgo.save();
    console.log("ReturnOutgo Saved:", returnoutgo);

    existingProduct.quantity += Number(quantity);
    existingProduct.outgo -= Number(quantity);
    existingProduct.returnout += Number(quantity);
    existingProduct.total = existingProduct.quantity * existingProduct.price;

    await existingProduct.save();
    console.log("Product Updated:", existingProduct);

    res.status(200).json({ message: "Outgo was returned to warehouse." });
  } catch (error) {
    console.error("❌ Error in /add-returnoutgo:", error);
    res.status(500).json({ error: error.message });
  }
});



/* ===================================== GET ===================================== */
// Read all product
router.get("/read-product", async (req, res) => {
  try {

    const product = await Product.find();
    const totalSum = product.reduce((sum, product) => sum + (product.price || 0) * (product.quantity || 0), 0);
    
    res.status(200).json({product, totalSum});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/read-product/:code", async (req, res) => {
  try {
    const product = await Product.findOne({ code: req.params.code});
    if (!product) {
      return res.status(404).json({ message: "لم يتم العثور على المنتج" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/read-product-by-codeCategory/:codeCategory", async (req, res) => {
  try {
    const product = await Product.findOne({ codeCategory: req.params.codeCategory });
    if (!product) {
      return res.status(404).json({ message: "لم يتم العثور على المنتج" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Read all income
router.get("/read-income", async (req, res) => {
  try {
    const income = await Income.find().sort({ createdAt: -1 });
    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Read income by id
router.get("/read-income/:id", async (req, res) => {
  try {
    const income = await Income.findById(req.params.id);
    if (!income) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(income);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Read all income
router.get("/read-returnincome", async (req, res) => {
  try {
    const returnincome = await ReturnIncome.find().sort({ createdAt: -1 });
    res.status(200).json(returnincome);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Read all outgo
router.get("/read-outgo", async (req, res) => {
  try {
    const outgo = await Outgo.find().sort({ createdAt: -1 });
    res.status(200).json(outgo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Read all return outgo
router.get("/read-returnoutgo", async (req, res) => {
  try {
    const returnout = await ReturnOutgo.find().sort({ createdAt: -1 });
    res.status(200).json(returnout);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Read count all transaction from warehouse
router.get('/warehousechart', async (req, res) => {
    try {
      // الحصول على عدد المستخدمين بناءً على الدور
      const incomeCount = await Product.countDocuments({ income });
      const outgoCount = await Product.countDocuments({ outgo });
      const returnincomeCount = await Product.countDocuments({ returnin });
      const returnoutgoCount = await Product.countDocuments({ returnout });
  
      res.status(200).json({
        success: true,
        data: {
          income: incomeCount,
          outgo: outgoCount,
          returnincome: returnincomeCount,
          returnoutgo: returnoutgoCount,
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

/* ===================================== UPDATE ===================================== */

//Update Product by id
router.put("/update-product/:id", async (req, res) => {
  try {
    const { code, codeCategory, carModel, category, brand, } = req.body;  // استخراج الحقول اللي جاية في الـ body

    // لو ما فيش أي قيم اتبعتت للتحديث، اعمل تحقق
    if (!code && !codeCategory && !carModel && !category && !brand) {
      return res.status(400).json({ message: "يجب إرسال قيمة واحدة على الأقل للتحديث" });
    }

    // انشاء كائن للتحديث بناءً على الحقول الموجودة في الـ body
    const updateData = {};
    if (code) updateData.code = code;
    if (codeCategory) updateData.codeCategory = codeCategory;
    if (carModel) updateData.carModel = carModel;
    if (category) updateData.category = category;
    if (brand) updateData.brand = brand;

    // تحديث المنتج بناءً على الـ id والـ updateData المرسل
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData }, // فقط الحقول المرسلة سيتم تحديثها
      { new: true }
    );

    // لو المنتج مش موجود، ارجع برسالة خطأ
    if (!product) {
      return res.status(404).json({ message: "المنتج غير متوفر في المخزن" });
    }

    // إرجاع المنتج بعد التحديث
    res.status(200).json(product);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update income by id
router.put("/update-income/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { brand, category, carModel, quantity } = req.body;

    // جلب بيانات الدخل القديمة
    const income = await Income.findById(id);
    if (!income) {
      return res.status(404).json({ message: "Item not found" });
    }

    // جلب بيانات المنتج المرتبط بنفس الكود
    const product = await Product.findOne({ code: income.code });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // حساب الفرق بين الكمية القديمة والجديدة
    const oldQuantity = income.quantity || 0;
    const newQuantity = quantity !== undefined ? quantity : oldQuantity;
    const quantityDiff = newQuantity - oldQuantity;

    // تحديث بيانات الدخل
    if (brand !== undefined && brand !== "") income.brand = brand;
    if (category !== undefined && category !== "") income.category = category;
    if (carModel !== undefined && carModel !== "") income.carModel = carModel;

    // حفظ التحديثات في قاعدة البيانات
    await income.save();

    // تحديث بيانات المنتج (طرح القديم وإضافة الجديد)
    const updatedProduct = await Product.findOneAndUpdate(
      { code: income.code },
      {
        $inc: { stock: quantityDiff }, // تعديل المخزون بناءً على الفرق
        ...(brand !== undefined && brand !== "" && { $set: { brand } }),
        ...(category !== undefined && category !== "" && { $set: { category } }),
        ...(carModel !== undefined && carModel !== "" && { $set: { carModel } }),
      },
      { new: true }
    );

    // جلب بيانات الـ dealer بناءً على اسم التاجر
    const dealer = await Dealer.findOne({ dealerName: income.dealerName });
    if (!dealer) {
      return res.status(404).json({ message: "Dealer not found" });
    }

    // Log the dealer's typeService array
    console.log("Dealer's typeService array:", dealer.typeService);

    // مقارنة بين billNumber و code فقط (تحويل الـ code إلى نص إذا لزم الأمر)
    const updateService = dealer.typeService.find(service =>
      String(service.billNumber) === String(income.billnumber) &&
      String(service.code) === String(income.code)
    );

    console.log('Income:', income);
    console.log("Service to update:", updateService);

    if (updateService) {
      // تحديث الـ type بناءً على الـ billNumber و code
      dealer.typeService = dealer.typeService.map(service => {
        if (String(service.billNumber) === String(income.billnumber) && String(service.code) === String(income.code)) {
          service.type = income.category; // تحديث الـ type ليكون متوافقًا مع الـ category
        }
        return service;
      });

      // حفظ التحديثات في الـ dealer
      await dealer.save();
    } else {
      console.log("No matching service found in the dealer's typeService array.");
    }

    res.status(200).json({ message: "تم تحديث بيانات الدخل والمخزون بنجاح", income, updatedProduct, dealer });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث الدخل والمخزون" });
  }
});


//Update outgo by id
router.put("/update-outgo/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);
    console.log("Request Body:", req.body);   

    const outgo = await Outgo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!outgo) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(outgo);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

//Update returnIncome by id
router.put("/update-returnIncome/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);
    console.log("Request Body:", req.body);

    const returnIncome = await ReturnIncome.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!returnIncome) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    res.status(200).json(returnIncome);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

//Update returnOutgo by id
router.put("/update-returnOutgo/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);
    console.log("Request Body:", req.body);

    const returnOutgo = await ReturnOutgo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!returnOutgo) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(returnOutgo);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});



/* ===================================== DELETE ===================================== */
// Delete income by id
router.delete("/delete-income/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);

    // البحث عن سجل الدخل قبل الحذف
    const income = await Income.findById(req.params.id);
    if (!income) {
      return res.status(404).json({ message: "Item not found" });
    }

    // تحديث الكمية في المنتج
    const existingProduct = await Product.findOne({ code: income.code });
    if (existingProduct) {
      existingProduct.quantity -= income.quantity; // خصم الكمية المحذوفة
      existingProduct.income -= income.quantity;
      existingProduct.total = existingProduct.quantity * existingProduct.price; // تحديث الإجمالي

      await existingProduct.save()
    }

    // تحديث dealer (إزالة الخدمة المرتبطة بالفاتورة)
    const dealer = await Dealer.findOne({ dealerName: income.dealerName });
    if (dealer) {
      console.log("Dealer before update:", dealer.typeService);

      // هنا نحتاج لتحديد الخدمة المحددة التي نريد حذفها
      const serviceToRemove = dealer.typeService.find(service => service.billNumber === income.billnumber && service.type === income.category && service.count === income.quantity && service.date === income.date);
      
      if (serviceToRemove) {
        dealer.typeService = dealer.typeService.filter(service => service !== serviceToRemove);
        await dealer.save();
        console.log("Updated dealer typeService:", dealer.typeService);
      } else {
        console.log(`Service not found for billNumber ${income.billnumber} and category ${income.category}.`);
      }
    } else {
      console.log(`Dealer with name ${income.dealerName} not found.`);
    }

    // حذف سجل الدخل بعد التحديثات
    await Income.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Income deleted and product updated successfully." });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});


//Delete outgo by id
router.delete("/delete-outgo/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);

    const outgo = await Outgo.findByIdAndDelete(req.params.id);
    if (!outgo) {
      return res.status(404).json({ message: "Item not found" });
    }

    // تحديث الكمية في المنتج
    const existingProduct = await Product.findOne({ code: outgo.code });
    if (existingProduct) {
      existingProduct.quantity += outgo.quantity; // خصم الكمية المحذوفة
      existingProduct.outgo -= outgo.quantity;
      existingProduct.total = existingProduct.quantity * existingProduct.price; // تحديث الإجمالي

      await existingProduct.save()
    }


    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
}); 

//Delete return income by id
router.delete("/delete-returnIncome/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);

    const returnincome = await ReturnIncome.findByIdAndDelete(req.params.id);
    if (!returnincome) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
}); 

//Delete return outgo by id
router.delete("/delete-returnOutgo/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);

    const returnoutgo = await ReturnOutgo.findByIdAndDelete(req.params.id);
    if (!returnoutgo) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
}); 

/* ===================================== OTHER ===================================== */

async function updateTotal() {
  try {
    // تحديث جميع المنتجات
    const products = await Product.find();

    for (let product of products) {
      if (product.total) {
        const priceTotal = product.price * product.quantity;
        product.total = priceTotal;
        await product.save();
        console.log(`Product with code ${product.code} updated with priceSell: ${priceTotal}`);
      }
    }
    console.log('All products have been updated.');
  } catch (error) {
    console.error('Error updating products:', error);
  }
}

async function updatePriceSell() {
  try {
    // تحديث جميع المنتجات
    const products = await Product.find();

    for (let product of products) {
      if (product.price) {
        const pricesell = product.price * 1.35;
        const roundedPriceSell = Math.round(pricesell / 50) * 50;
        product.priceSell = roundedPriceSell;
        await product.save();
        console.log(`Product with code ${product.code} updated with priceSell: ${pricesell}`);
      }
    }
    console.log('All products have been updated.');
  } catch (error) {
    console.error('Error updating products:', error);
  }
}
updateTotal();
updatePriceSell();

//exports
module.exports = router;