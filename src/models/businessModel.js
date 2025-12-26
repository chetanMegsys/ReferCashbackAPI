const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      // required: true,
    },
    businessId: {
      type: String,
    },
    categories: {
      // type: [String],
      type: [mongoose.Schema.Types.ObjectId],
      ref: "categories",
      // required: true,
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    address: {
      type: String,
      // required: true,
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100, // discount should not exceed 100%
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    Pincode: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"], // GeoJSON type
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        //   required: true,
      },
    },
  },
  { timestamps: true }
);

businessSchema.index({ location: "2dsphere" });

// Helper function to generate random 5-character alphanumeric ID
function generateBusinessId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Pre-save hook to auto-generate unique businessId
businessSchema.pre("save", async function (next) {
  if (this.businessId) return next(); // already set

  let unique = false;
  while (!unique) {
    const newId = generateBusinessId();
    const existing = await mongoose.models.businesses.findOne({
      businessId: newId,
    });
    if (!existing) {
      this.businessId = newId;
      unique = true;
    }
  }

  next();
});

module.exports = mongoose.model("businesses", businessSchema);
