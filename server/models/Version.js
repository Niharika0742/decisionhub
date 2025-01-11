import mongoose from "mongoose";

const versionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    inputAttributes: { type: [String], default: [] },
    outputAttributes: { type: [String], default: [] },
    condition: { type: Object, default: { nodes: [], edges: [] } },
    version: { type: Number, default: 1.0 },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "Rule" },
  },
  { timestamps: true }
);

const Version = mongoose.model("Version", versionSchema);
export default Version;