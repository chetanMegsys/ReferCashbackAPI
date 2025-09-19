const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  transactionType: {
    type: String,
    enum: ["credit", "debit"],
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "orders",
  },
  category: {
    type: String,
    enum: ["order", "cashback", "refund", "credit"],
    default: "order",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  amount: {
    type: Number,
    required: true,
  },
  narration: {
    type: String,
    required: false,
  },
});

const transactions = mongoose.model("transactions", transactionSchema);

module.exports = transactions;
