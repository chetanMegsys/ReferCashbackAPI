const mongoose = require("mongoose");
const walletBalanceModel = require("../models/walletBalanceModel");
const userModel = require("./../models/userModel");
const transactionModel = require("./../models/transactionModel");

const withdrawRequest = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId) {
      return res.status(400).json({ msg: "UserId is required" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: "Valid amount is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid userId format" });
    }

    const userExists = await userModel.findOne({
      _id: userId,
      status: "active",
    });
    if (!userExists) {
      return res.status(404).json({ msg: "User does not exist" });
    }

    const existingRequest = await walletBalanceModel.findOne({
      userId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({ msg: "Withdraw request already pending" });
    }

    const newWithdrawRequest = await walletBalanceModel.create({
      userId,
      amount,
    });

    return res.status(201).json({
      msg: "Withdraw request created successfully",
      data: newWithdrawRequest,
    });
  } catch (error) {
    console.error("❌ Withdraw Request Error:", error);
    return res.status(500).json({
      msg: "Internal server error",
    });
  }
};

const addWalletBalance = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId) {
      return res.status(400).json({ msg: "UserId is required" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: "Valid amount is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid userId format" });
    }

    const userExists = await userModel
      .findOne({
        _id: userId,
        status: "active",
      })
      .select("-password -refreshToken");
    if (!userExists) {
      return res.status(404).json({ msg: "User does not exist" });
    }

    userExists.walletDetails.balance += Number(amount);
    await userExists.save();

    const newTrans = await transactionModel.create({
      userId,
      transactionType: "credit",
      orderId: null,
      amount,
      category: "adminCredit",
      narration: "Amount credited by admin",
    });

    if (!newTrans) {
      return res
        .status(500)
        .json({ msg: "Failed to create transaction record" });
    }

    return res.status(200).json({
      msg: "Wallet balance updated successfully",
      data: userExists.walletDetails.balance,
    });
  } catch (error) {
    return res.status(500).json({
      msg: "Internal server error",
      error: error.message,
    });
  }
};
module.exports = {
  withdrawRequest,
  addWalletBalance,
};
