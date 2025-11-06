const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // optional but helps avoid duplicates
    },
    minDiscount: {
      type: Number,
      required: true, // make true if you want it mandatory
      min: 0, // minimum allowed value
      max: 100, // optional, ensures discount <= 100%
      default: 0, // optional default
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("categories", categorySchema);
