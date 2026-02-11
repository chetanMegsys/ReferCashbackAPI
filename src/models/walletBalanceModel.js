const mongoose = require("mongoose");

const walletBalanceModel = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    utrNo: {
      type: String,
      default: null,
    },
    rejectResponse: { type: String, default: null },
    history: {
      type: [
        {
          amount: {
            type: Number,
            required: true,
          },
          requestedOn: {
            type: Date,
            default: Date.now,
          },
        },
        { _id: true },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "withdrawWalletBalanceRequest",
  walletBalanceModel,
);
