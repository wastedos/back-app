const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

// التحقق من وجود التوكن وصلاحيته
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // إضافة بيانات المستخدم للطلب
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// التحقق من دور المستخدم
const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

module.exports = { authenticate, authorize };
