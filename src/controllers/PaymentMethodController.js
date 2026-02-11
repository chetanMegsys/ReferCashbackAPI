const PaymentMethodModel = require("../models/PaymentMethodModel");

const addPaymentMethod = async (req, res) => {
  try {
    const { name } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Payment method name is required",
      });
    }

    // Check if already exists
    const existingMethod = await PaymentMethodModel.findOne({
      name: name.trim(),
    });

    if (existingMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method already exists",
      });
    }

    // Create
    const newPaymentMethod = new PaymentMethodModel({
      name: name.trim(),
    });

    await newPaymentMethod.save();

    return res.status(201).json({
      success: true,
      message: "Payment method created successfully",
      data: newPaymentMethod,
    });
  } catch (error) {
    console.error("Create Payment Method Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethodModel.find().sort({
      createdAt: -1,
    });
    return res.status(201).json({
      success: true,
      message: "Payment methods fetched successfully",
      data: paymentMethods,
    });
  } catch (error) {
    console.error("Get Payment Methods Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server error",
    });
  }
};

module.exports = { addPaymentMethod, getPaymentMethods };
