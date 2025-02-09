// Notification Schema
const notificationSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model("Notification", notificationSchema);

// API Routes
app.post("/notifications", async (req, res) => {
  try {
      const notification = new Notification({ message: req.body.message });
      await notification.save();
      io.emit("new_notification", notification); // إرسال الإشعار للمستخدمين
      res.status(201).json(notification);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

app.get("/notifications", async (req, res) => {
  try {
      const notifications = await Notification.find().sort({ createdAt: -1 });
      res.json(notifications);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


/*
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);
  socket.on("disconnect", () => {
      console.log("User disconnected: " + socket.id);
  });
});
*/