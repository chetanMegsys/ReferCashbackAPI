const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  transactionId: {
    type: String,
    unique: true,
    required: true,
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

// 🔹 Generate a unique transaction ID before saving
transactionSchema.pre("validate", async function (next) {
  if (this.transactionId) return next(); // Skip if already set

  const date = new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);

  let uniqueId;
  let isUnique = false;

  while (!isUnique) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    uniqueId = `RCT${dd}${mm}${yy}${randomNum}`;
    const exists = await mongoose.models.transactions.findOne({
      transactionId: uniqueId,
    });
    if (!exists) isUnique = true;
  }

  this.transactionId = uniqueId;
  next();
});

const transactions = mongoose.model("transactions", transactionSchema);

module.exports = transactions;
