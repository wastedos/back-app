const multer = require("multer");
const path = require("path");

// إعداد التخزين للملفات
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null,path.join(__dirname, "../images"));
  },
  filename: function (req, file, cb) {
    //cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
    const randomNumber = Math.floor(Math.random() * 1E9);  // Generates a random number
    cb(null, file.fieldname + "-" + randomNumber + path.extname(file.originalname));
  },
});

// التحقق من نوع الملف المسموح به
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only images (JPEG, PNG, JPG) are allowed"), false);
  }
};

// إنشاء ميدل وير Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // الحد الأقصى 5MB
});

module.exports = upload;
