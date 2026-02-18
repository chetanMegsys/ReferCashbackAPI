const mongoose = require("mongoose");
const userModel = require("../models/userModel"); // adjust path

/**
 * Update user's lapIncome
 * @param {String} userId - MongoDB ObjectId of the user
 * @param {Number} amount - Amount to add (use negative to deduct)
 */
const updateLapIncome = async (userId, amount) => {
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId) || amount <= 0) {
      return null;
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { $inc: { "walletDetails.lapIncome": amount } },
      { new: true, select: "walletDetails.lapIncome" }, // return only lapIncome
    );

    return updatedUser;
  } catch (error) {
    console.error("Error updating lapIncome:", error);
    throw error;
  }
};

module.exports = updateLapIncome;
