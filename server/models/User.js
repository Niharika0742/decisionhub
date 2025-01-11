import mongoose from "mongoose";

// Define the schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    img: { type: String },
    googleAuth: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Check if the model already exists, if not, define it
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
