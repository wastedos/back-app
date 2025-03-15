require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require("path");

//--------------- import Path for Router ---------------
const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protected');
const usersRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const jobordersRoutes = require('./routes/joborder')
const warehouseRoutes = require('./routes/warehouse');
const transactionRoutes = require('./routes/transaction');
const billsRoutes = require('./routes/bills');
const dealerRoutes = require('./routes/dealer');
const bookingRoutes = require('./routes/booking');

const imagesRoutes = require('./routes/image');


const app = express();

const corsOptions = {
  origin: ['http://localhost:3000', 'https://go-gac.com'], // السماح فقط للأصل (Frontend) بالوصول
  credentials: true,              // السماح بإرسال ملفات تعريف الارتباط (Cookies)
}

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());

//--------------- Connect with DB ---------------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));


//--------------- Static ---------------
app.use("/api/images", express.static(path.join(__dirname, "./images")));


//--------------- Locations ---------------
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/joborders', jobordersRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/dealer', dealerRoutes);
app.use('/api/booking', bookingRoutes);

app.use('/api/images', imagesRoutes);

//--------------- Start Server ---------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
