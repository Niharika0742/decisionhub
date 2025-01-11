import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createError } from "../error.js";
import * as dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.log("MongoDB connection error:", error));

const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  googleAuth: Boolean,
  rules: [{ type: mongoose.Schema.Types.ObjectId, ref: "Rule" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}));

const Rule = mongoose.model("Rule", new mongoose.Schema({
  title: String,
  description: String,
  inputAttributes: Array,
  outputAttributes: Array,
  condition: String,
  tested: Boolean,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}));

export const findUserByEmail = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return next(createError(404, "User does not exist"));
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
};

export const getRecentActivity = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    const rules = await Rule.find({ _id: { $in: user.rules } })
      .sort({ updatedAt: -1 })
      .limit(10);
    const totalRules = rules.length;
    const testedRules = rules.filter(rule => rule.tested === true).length;

    return res.status(200).json({ rules, total: totalRules, tested: testedRules });
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

export const getUserRules = async (req, res, next) => {
  const userId = req.user.id;
  const filter = req.query.f;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    let rules;
    if (filter === "createdAt") {
      rules = await Rule.find({ _id: { $in: user.rules } })
        .sort({ createdAt: -1 })
        .limit(10);
    } else {
      rules = await Rule.find({ _id: { $in: user.rules } })
        .sort({ updatedAt: -1 })
        .limit(10);
    }
    return res.status(200).json(rules);
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

export const updateProfile = async (req, res, next) => {
  const userId = req.user.id;
  const { name, email, password } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return next(createError(404, "User not found"));
    }
    if (!user.googleAuth) {
      user.name = name;
      user.email = email;
      user.password = password;
      await user.save();
      return res.status(200).json(user);
    }
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};

export const getTablesList = async (req, res, next) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const excludedCollections = ['users', 'rules', 'versions'];

    const collectionDetails = await Promise.all(
      collections
        .filter((collection) => !excludedCollections.includes(collection.name))
        .map(async (collection) => {
          const collectionName = collection.name;
          const columns = await mongoose.connection.db
            .collection(collectionName)
            .findOne();
          const columnNames = columns ? Object.keys(columns) : [];
          return { table: collectionName, columns: columnNames };
        })
    );

    return res.json(collectionDetails);
  } catch (error) {
    return next(createError(error.status, error.message));
  }
};
