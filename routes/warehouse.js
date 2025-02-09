const express = require("express");
const { Product, Income, Outgo, ReturnIncome, ReturnOutgo, Historywarehouse } = require("../models/warehouse");
const router = express.Router();

/* ===================================== POST ===================================== */
// Add income
router.post("/add-income", async (req, res) => {
  const { code, category, brand, quantity, price, billnumber, seller, sellerphone } = req.body;

  try {
    // إضافة سجل الدخل
    const income = new Income({
      code,
      category,
      brand,
      quantity,
      price,
      total: quantity * price,
      billnumber,
      seller,
      sellerphone,
    });
    await income.save();

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


// Add Return Income
router.post("/add-returnIncome", async (req, res) => {
  const { code, quantity} = req.body;

  try {
    const existingIncome = await Income.findOne({ code });
    if (!existingIncome) {
      return res.status(404).json({ message: "Outgo not found." });
    }

    const existingProduct = await Product.findOne({ code });
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    const existingReturnoutgo = await ReturnOutgo.findOne({ code });

    if (existingReturnoutgo && existingReturnoutgo.quantity <= quantity) {
      const returnincome = new ReturnIncome({
        code,
        category: existingProduct.category,
        brand: existingProduct.brand,
        quantity,
        price: existingProduct.price,
        total: Number(quantity) * Number(existingProduct.price),
        billnumber: existingIncome.billnumber,
        seller: existingIncome.seller,
        sellerphone: existingIncome.sellerphone,
      });
      await returnincome.save();
  
      // تحديث المنتج
      existingProduct.quantity -= Number(quantity);
      existingProduct.income -= Number(quantity);
      //existingProduct.returnout -= Number(quantity);
      existingProduct.returnin += Number(quantity);
      existingProduct.total = existingProduct.quantity * existingProduct.price;
      await existingProduct.save();
  
      res.status(200).json({ message: "Income was returned to warehouse." });
    }else{
      return res.status(400).json({ message: "Requested quantity exceeds available quantity in outgo." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Add Return Outgo
router.post("/add-returnoutgo", async (req, res) => {
  const { code, quantity, price, billnumber, reason } = req.body;

  try {
    console.log("Request Body:", req.body);

    const existingOutgo = await Outgo.findOne({ code });
    if (!existingOutgo) {
      console.log("Outgo not found");
      return res.status(404).json({ message: "Outgo not found." });
    }
    console.log("Existing Outgo:", existingOutgo);

    const existingProduct = await Product.findOne({ code });
    if (!existingProduct) {
      console.log("Product not found");
      return res.status(404).json({ message: "Product not found." });
    }
    console.log("Existing Product:", existingProduct);

    if (existingOutgo.quantity < quantity) {
      return res.status(400).json({ message: "Requested quantity exceeds available quantity in outgo." });
    }

    const returnoutgo = new ReturnOutgo({
      code,
      category: existingProduct.category,
      brand: existingProduct.brand,
      quantity,
      price,
      total: Number(quantity) * Number(price),
      billnumber,
      buyer: existingOutgo.buyer,
      buyerphone: existingOutgo.buyerphone,
      reason,
    });

    await returnoutgo.save();
    console.log("ReturnOutgo Saved:", returnoutgo);

    // تحديث المنتج
    existingProduct.quantity += Number(quantity);
    existingProduct.outgo -= Number(quantity);
    existingProduct.returnout += Number(quantity);
    existingProduct.total = existingProduct.quantity * existingProduct.price;

    await existingProduct.save();
    console.log("Product Updated:", existingProduct);

    res.status(200).json({ message: "Outgo was returned to warehouse." });
  } catch (error) {
    console.error("Error in /add-returnoutgo:", error.message);
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
    const income = await Income.find();
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
    const returnincome = await ReturnIncome.find();
    res.status(200).json(returnincome);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Read all outgo
router.get("/read-outgo", async (req, res) => {
  try {
    const outgo = await Outgo.find();
    res.status(200).json(outgo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Read all return outgo
router.get("/read-returnoutgo", async (req, res) => {
  try {
    const returnout = await ReturnOutgo.find();
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
router.delete("/delete-income/:id", async (req, res) => {
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
router.delete("/delete-income/:id", async (req, res) => {
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