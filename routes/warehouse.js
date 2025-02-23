const express = require("express");
const { Product, Income, Outgo, ReturnIncome, ReturnOutgo, Historywarehouse } = require("../models/warehouse");
const { Dealer } = require("../models/dealer")
const router = express.Router();

/* ===================================== POST ===================================== */
// Add income
router.post("/add-income", async (req, res) => {
  const { code, category, brand, quantity, price, dealerName, } = req.body;

  const lastBill = await Income.findOne().sort({ billnumber: -1 });
  let newBill = lastBill ? Number(lastBill.billnumber) + 1 : 1;

  try {
    // إضافة سجل الدخل
    const income = new Income({
      code,
      billnumber: newBill,
      category,
      brand,
      quantity,
      price,
      total: quantity * price,
      dealerName,
    });
    await income.save();

    const dealer = await Dealer.findOne({ dealerName });
    dealer.typeService.push({
      type: category,
      count: quantity,
      servicePriceBuy: price,
      servicePriceSell: 0,
      billNumber: income.billnumber,
    });
    await dealer.save();

    // فحص إذا كان المنتج موجودًا
    const existingProduct = await Product.findOne({ code });
    if (existingProduct) {
      // إذا كان المنتج موجودًا، نقوم بتحديث الكمية والدخل
      existingProduct.quantity += Number(quantity);
      existingProduct.income += Number(quantity);
      existingProduct.price = price;
      existingProduct.total = existingProduct.quantity * price; // تحديث الإجمالي
      await existingProduct.save();
      
      res.status(200).json({ message: "Product updated and income record added." });
    } else {
      // إذا لم يكن المنتج موجودًا، نضيف منتجًا جديدًا
      const newProduct = new Product({
        code,
        category,
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
      await newProduct.save();
      res.status(201).json({ message: "New product created and income record added." });
    }
  } catch (error) {
    console.error("Error in /add-income:", error.message);
    res.status(500).json({ error: error.message });
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

/*
//Update income by id
router.put("/update-income/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);
    console.log("Request Body:", req.body);

    const income = await Income.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!income) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    res.status(200).json(income);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

//Update income by id
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
*/


/* ===================================== DELETE ===================================== */
//Delete income by id
router.delete("/delete-income/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);

    const income = await Income.findByIdAndDelete(req.params.id);
    if (!income) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
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




//exports
module.exports = router;