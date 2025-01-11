import mongoose from "mongoose";

const bankUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    age: { type: Number, required: true },
    account_number: { type: String, required: true, unique: true },
    date_of_birth: { type: Date, required: true },
    employment_status: { type: String, required: true },
    annual_income: { type: Number, required: true },
    credit_score: { type: Number, required: true },
  },
  { timestamps: true }
);
const BankUser = mongoose.model("BankUser", bankUserSchema);
export default BankUser;