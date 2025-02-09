const express = require("express");
const router = express.Router();

const User = require('../models/User');
const { Product, Income, Outgo, ReturnIncome, ReturnOutgo, Historywarehouse } = require("../models/warehouse");



/* ===================================== POST ===================================== */

/* ===================================== GET ===================================== */

//Read all transaction in warehouse
router.get('/warehousechart', async (req, res) => {
    try {
      // استخدام aggregate لحساب المجاميع فقط للحقول المطلوبة
      const data = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalIncome: { $sum: "$income" },
            totalOutgo: { $sum: "$outgo" },
            totalReturnIn: { $sum: "$returnin" },
            totalReturnOut: { $sum: "$returnout" },
          },
        },
      ]);
  
      if (data.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No data found",
        });
      }
  
      // إرسال البيانات كاستجابة
      res.status(200).json({
        success: true,
        data: {
          income: data[0].totalIncome,
          outgo: data[0].totalOutgo,
          returnin: data[0].totalReturnIn,
          returnout: data[0].totalReturnOut,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Something went wrong",
        error: error.message,
      });
    }
  });

/* ===================================== UPDATE ===================================== */



/* ===================================== DELETE ===================================== */



//exports
module.exports = router;