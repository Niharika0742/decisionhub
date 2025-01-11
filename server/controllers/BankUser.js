import { createError } from "../error.js";
import BankUser from "../models/BankUser.js"; // MongoDB model for BankUser
import Loan from "../models/Loan.js"; // MongoDB model for Loan

export const createBankUser = async (req, res, next) => {
    const users = req.body;
    try {
        // Insert users into MongoDB using bulk insert
        await BankUser.insertMany(users);
        
        // Fetch all bank users from MongoDB
        const userTable = await BankUser.find();
        return res.json(userTable);
    } catch (error) {
        return next(createError(error.status, error.message));
    }
};

export const createLoan = async (req, res, next) => {
    const loans = req.body.loans;
    const acc_no = req.params.id;
    try {
        // Find the bank user by account number
        const bankUser = await BankUser.findOne({
            account_number: acc_no,
        });

        if (!bankUser) {
            return next(createError(404, "Bank user not found"));
        }

        // Create loans and associate them with the bank user
        const createdLoans = await Promise.all(
            loans.map(async (loan) => {
                const newLoan = new Loan(loan);
                await newLoan.save(); // Save loan to MongoDB
                bankUser.loans.push(newLoan._id); // Add loan ID to bankUser's loans array
                await bankUser.save(); // Save the updated bank user
                return newLoan;
            })
        );

        // Fetch all loans for the response
        const loanTable = await Loan.find();
        return res.json(loanTable);
    } catch (error) {
        return next(createError(error.status, error.message));
    }
};
