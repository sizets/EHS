require('dotenv').config();
const express = require("express");
const connectDB = require('./mongo');
const cors = require("cors");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 4000; // Use 4000 for backend if frontend is on 3000

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
app.use(
    session({
        secret: "qwra324ewq!@#", // 🔐 Change in production
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false }, // Set true only if using HTTPS
    })
);

// Optional locals (can be removed if not using templating)
app.use((req, res, next) => {
    res.locals.errorMessage = null;
    res.locals.successMessage = null;
    next();
});

// 📦 Routes
const router = require("./routes/router");
app.use("/api", router);

function listEndpoints(app) {
    try {
        const routes = [];
        if (app._router && app._router.stack) {
            app._router.stack.forEach(middleware => {
                if (middleware.route) {
                    // Route middleware
                    routes.push(middleware.route);
                } else if (middleware.name === 'router') {
                    // Router middleware
                    middleware.handle.stack.forEach(handler => {
                        const route = handler.route;
                        route && routes.push(route);
                    });
                }
            });

            console.log("🔍 Available Routes:");
            routes.forEach(route => {
                const methods = Object.keys(route.methods).join(', ').toUpperCase();
                console.log(`${methods} ${route.path}`);
            });
        }
    } catch (error) {
        console.log("🔍 Routes loaded successfully");
    }
}

// Call after routes are set up
setTimeout(() => listEndpoints(app), 100);


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
