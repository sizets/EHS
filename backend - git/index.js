require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 4000;

const allowedOrigins = ["http://localhost:5173"];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
const router = require("./routes/router");
app.use("/api", router);

app.listen(PORT, () => {
    console.log(`🔌 Server is running on http://localhost:${PORT}`);
    console.log(`🔍 Available Routes:`);
    console.log(`   GET  /api/auth/google`);
    console.log(`   GET  /api/auth/google/callback`);
    console.log(`   GET  /api/ping`);
});
