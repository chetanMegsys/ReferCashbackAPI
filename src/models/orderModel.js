const mongoose = require("mongoose");
const Counter = require("./counterModel"); // import counter model

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "businesses",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    orderId: {
      type: String,
      unique: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Completed", "Cancelled"],
      default: "Pending",
    },
    isWalletSelected: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    let unique = false;
    let newId;

    while (!unique) {
      // Generate 6-character alphanumeric
      newId = [...Array(6)]
        .map(
          () =>
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
              Math.floor(Math.random() * 36)
            ]
        )
        .join("");

      // Check if it already exists
      const existing = await this.constructor.findOne({ orderId: newId });
      if (!existing) unique = true;
    }

    this.orderId = newId;
  }
  next();
});

const Orders = mongoose.model("orders", orderSchema);
module.exports = Orders;
