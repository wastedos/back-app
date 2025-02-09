const express = require("express");
const Booking = require("../models/booking");
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const router = express.Router();



// إنشاء عنصر جديد (Create)
router.post("/add-booking", authenticate, async (req, res) => {
    try {
      // الحصول على userId من التوكن المصدق
      const id = req.user.id;
      
      // إضافة الـ userId في الـ body الخاص بالحجز
      const booking = new Booking({
        ...req.body,
        userid: id,  // إضافة userId إلى الحجز
        state: "active", // تحديد الحالة الافتراضية عند الإنشاء
        createdAt: new Date(), // تخزين وقت الإنشاء
    });
  
      // حفظ الحجز في قاعدة البيانات
      const savedBooking = await booking.save();
      res.status(201).json(savedBooking);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
});

router.get("/read-booking", async (req, res) => {
  try {
    const bookings = await Booking.find();

    // تحديث حالة الحجز إذا مر أكثر من 24 ساعة على تاريخ الزيارة
    for (const booking of bookings) {
      const currentDate = new Date();
      const visitDate = new Date(booking.datevisit);

      const timeDifference = currentDate - visitDate;
      const daysDifference = timeDifference / (1000 * 3600 * 24);  // الفرق بالأيام

      if (daysDifference >= 1) {
        booking.state = "idle";  // إذا مر يوم أو أكثر، تغيير الحالة إلى "idle"
        await booking.save();  // حفظ التحديث
      }
    }

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// عرض الحجوزات الخاصة بالمستخدم المصادق عليه
router.get("/user-bookings", authenticate, async (req, res) => {
  try {
    // الحصول على userId من التوكن
    const userId = req.user.id;

    // جلب الحجوزات الخاصة بالمستخدم
    const userBookings = await Booking.find({ userid: userId });

    if (userBookings.length === 0) {
      return res.status(404).json({ message: "لا يوجد حجوزات في الوقت الحالي" });
    }

    res.status(200).json(userBookings);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// جلب عنصر معين حسب ID (Read)
router.get("/read-byid", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// تحديث عنصر محدد
router.put("/update-booking/:id", async (req, res) => {
    try {
      console.log("Request Params:", req.params);
      console.log("Request Body:", req.body);
  
      const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      res.status(200).json(booking);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
// حذف عنصر محدد
router.delete("/delete-booking/:id", async (req, res) => {
  try {
    console.log("Request Params:", req.params);

    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
