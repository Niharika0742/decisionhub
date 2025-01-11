import mongoose from "mongoose";

// Define the schema
const ruleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    inputAttributes: { type: Array },
    outputAttributes: { type: Array },
    condition: { type: String },
    tested: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Check if the model already exists, if not, define it
const Rule = mongoose.models.Rule || mongoose.model("Rule", ruleSchema);

export default Rule;
