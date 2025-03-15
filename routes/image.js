const express = require('express');
const router = express.Router();
const { Image } = require('../models/image');
const upload = require("../middlewares/uploads");
const fs = require("fs"); // لحذف الملفات القديمة
const path = require("path");



router.post("/add-image", upload.array("images", 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "❌ لم يتم تحميل أي صور" });
        }

        console.log("📸 الملفات المستلمة:", req.files);
        console.log("📝 البيانات الأخرى:", req.body);

        const newImages = req.files.map(file => ({
            imageType: req.body.imageType || "",
            imageTitle: req.body.imageTitle || "",
            image: file.filename,
        }));

        const savedImages = await Image.insertMany(newImages);

        res.status(201).json({ message: "✅ الصور تم رفعها بنجاح", images: savedImages });
    } catch (error) {
        console.error("❌ خطأ في رفع الصور:", error);
        res.status(500).json({ message: "❌ خطأ في السيرفر", error });
    }
});



// Endpoint لجلب جميع الصور
router.get('/get-images', async (req, res) => {
    try {
        const images = await Image.find(); // جلب جميع الصور
        res.status(200).json(images);
    } catch (error) {
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الصور', error });
    }
});


// تحديث صورة معينة
router.put("/update-image/:id", upload.single("image"), async (req, res) => {
    try {
        const { id } = req.params;
        const { imageTitle, imageType } = req.body;
        const newImage = req.file ? req.file.filename : null;

        // جلب الصورة القديمة
        const oldImage = await Image.findById(id);
        if (!oldImage) {
            return res.status(404).json({ message: "الصورة غير موجودة" });
        }

        // حذف الصورة القديمة من السيرفر إذا تم رفع صورة جديدة
        if (newImage && oldImage.image) {
            const oldImagePath = path.join(__dirname, "../images", oldImage.image);  // استخدام مجلد images هنا
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath); // حذف الصورة القديمة
            }
        }

        // تحديث البيانات في قاعدة البيانات
        const updatedImage = await Image.findByIdAndUpdate(
            id,
            { imageTitle, imageType, image: newImage || oldImage.image },
            { new: true }
        );

        res.status(200).json({ message: "تم تحديث الصورة بنجاح", image: updatedImage });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ message: "حدث خطأ أثناء تحديث الصورة", error });
    }
});



router.delete("/delete-image/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // جلب الصورة من قاعدة البيانات
        const image = await Image.findById(id);
        if (!image) {
            return res.status(404).json({ message: "الصورة غير موجودة" });
        }

        // حذف الصورة من السيرفر
        const imagePath = path.join(__dirname, "../images", image.image);  // استخدام مجلد images هنا
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath); // حذف الصورة نهائيًا
        }

        // حذف من قاعدة البيانات
        await Image.findByIdAndDelete(id);

        res.status(200).json({ message: "تم حذف الصورة بنجاح" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: "حدث خطأ أثناء حذف الصورة", error });
    }
});

module.exports = router;
