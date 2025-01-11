import mongoose from "mongoose";

const loanSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    duration: { type: Number, required: true },
    type: { type: String, required: true },
    bankUserId: { type: mongoose.Schema.Types.ObjectId, ref: "BankUser" },
  },
  { timestamps: true }
);

const Loan = mongoose.model("Loan", loanSchema);
export default Loan;