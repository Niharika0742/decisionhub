import { User } from "./User.js";
import * as dotenv from "dotenv";
import { Sequelize, DataTypes } from "sequelize";
import { Rule } from "./Rule.js";
import { Version } from "./Version.js";
import { BankUser } from "./BankUser.js";
import { Loan } from "./Loan.js";

dotenv.config();

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: console.log, // Enable logging for debugging (disable in production)
});

// Test Database Connection
sequelize
  .authenticate()
  .then(() => console.log("Database connected successfully."))
  .catch((err) => console.error("Database connection error:", err));

// Initialize Models
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = User(sequelize, DataTypes);
db.rule = Rule(sequelize, DataTypes);
db.version = Version(sequelize, DataTypes);
db.bankUser = BankUser(sequelize, DataTypes);
db.loan = Loan(sequelize, DataTypes);

// Define Associations
db.rule.belongsTo(db.user, { foreignKey: "userId" });
db.user.hasMany(db.rule, { foreignKey: "userId" });

db.rule.hasMany(db.version, { foreignKey: "ruleId" });
db.version.belongsTo(db.rule, { foreignKey: "ruleId" });

db.bankUser.hasMany(db.loan, { foreignKey: "bankUserId" });
db.loan.belongsTo(db.bankUser, { foreignKey: "bankUserId" });

// Export Database Object
export default db;
