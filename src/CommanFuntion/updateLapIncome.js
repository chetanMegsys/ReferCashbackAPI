const mongoose = require("mongoose");
const userModel = require("../models/userModel"); // adjust path

/**
 * Update user's lapIncome
 * @param {String} userId - MongoDB ObjectId of the user
 * @param {Number} amount - Amount to add (use negative to deduct)
 */
const updateLapIncome = async (userId, amount) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid userId");
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
