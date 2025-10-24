require('dotenv').config();
const express = require("express");
const connectDB = require('./mongo');
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 8081; // Use 4000 for backend if frontend is on 3000

const allowedOrigins = ["http://localhost:5173"];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// 📦 Routes
const router = require("./routes/router");
app.use("/api", router);



// 🔗 Connect to MongoDB, then start server
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🔌 Server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    });
