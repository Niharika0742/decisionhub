// index.js
import express from "express";
import * as dotenv from "dotenv";
import userRoutes from "./routes/User.js";
import authRoutes from "./routes/Auth.js";
import ruleRoutes from "./routes/Rule.js";
import bankUserRoutes from "./routes/BankUser.js";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

/** Middlewares */
app.use(express.json()); // Parse JSON bodies
app.use(morgan("tiny")); // Log HTTP requests
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:3000"], // Add allowed origins
  })
);

/** MongoDB Connection */
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully."))
  .catch((err) => console.error("MongoDB connection error:", err));

/** Routes */
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/rule", ruleRoutes);
app.use("/api/bankUser", bankUserRoutes);

/** Error Handling Middleware */
app.use((err, req, res, next) => {
  console.error("Error:", err); // Log the error for debugging
  const status = err.status || 500;
  const message = err.message || "Something went wrong";
  res.status(status).json({
    success: false,
    status,
    message,
  });
});

/** Start the Server */
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));