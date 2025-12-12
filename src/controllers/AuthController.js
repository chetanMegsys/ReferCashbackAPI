const userModel = require("../models/userModel");
const otpModel = require("../models/otpModel");
const { createOrUpdateBusiness } = require("../services/businessService");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const businessModel = require("../models/businessModel");

const registerUser = async (req, res) => {
  try {
    const {
      mobile,
      password,
      businessName,
      BusinessAddress,
      lat,
      long,
      role,
      referalMobileNumber,
      firstName,
      middleName,
      lastName,
      email,
      categories,
      currentAddress,
      permanentAddress,
      panCardNumber,
      aadhaarCardNumber,
      rationCardNumber,
    } = req.body;
    console.log(req.body);

    // 1️⃣ Basic validation
    if (!mobile || !password) {
      return res
        .status(400)
        .send({ msg: "Please enter mobile number and password" });
    }

    // 2️⃣ Check if user already exists
    const existingUser = await userModel.findOne({ mobile });
    if (existingUser) {
      return res.status(400).send({ msg: "User already registered" });
    }
    // 3️⃣ Check if ration card already registered
    if (rationCardNumber) {
      const existingRation = await userModel.findOne({ rationCardNumber });
      if (existingRation) {
        return res
          .status(400)
          .send({ msg: "Ration card number already registered" });
      }
    }
    // 3️⃣ Check referral exists
    const referralUser = await userModel.findOne({
      mobile: referalMobileNumber,
    });
    if (!referralUser) {
      return res.status(400).json({ msg: "Referral user does not exist." });
    }

    // 4️⃣ Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5️⃣ BFS: find next available parent under referral tree
    const findNextAvailableParent = async (rootUser) => {
      const queue = [rootUser];

      while (queue.length) {
        const current = queue.shift();

        // Get children of current user
        const children = await userModel.find({ parentId: current._id });

        if (children.length < 3) {
          return current; // Found a parent with available slot
        }

        // Add children to queue for BFS
        queue.push(...children);
      }

      return rootUser; // fallback (should not happen)
    };

    const parentUser = await findNextAvailableParent(referralUser);

    // 6️⃣ Prepare new user data
    const newUserData = {
      firstName,
      middleName,
      lastName,
      email,
      mobile,
      password: hashedPassword,
      role,
      referalUser: referralUser._id, // direct referrer
      parentId: parentUser._id, // tree parent
      levelId: parentUser.levelId + 1, // depth in tree
      currentAddress: currentAddress,
      permanentAddress,
      panCardNumber,
      aadhaarCardNumber,
      rationCardNumber,
      status: "active",
    };

    // 7️⃣ Save new user
    const newUser = new userModel(newUserData);

    // 8️⃣ If shopkeeper, create business
    if (role === "shopkeeper" && businessName) {
      const newBusiness = new businessModel({
        businessName,
        address: BusinessAddress,
        categories: categories,
        shopkeeperId: newUser._id,
        location: {
          type: "Point",
          coordinates: [Number(long), Number(lat)],
        },
      });
      await newBusiness.save();
    }
    await newUser.save();
    // ✅ Respond
    res.status(200).send({
      msg: "User registered successfully",
      data: newUser,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send({ msg: error.message, data: null });
  }
};

const login = async (req, res) => {
  try {
    console.log("dkccdcwc bnch ");

    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res
        .status(400)
        .send({ msg: "Please Enter Mobile Number and Password" });
    }

    const user = await userModel.findOne({ mobile });

    if (!user) {
      return res.status(400).send({ msg: "User does not exist" });
    }

    //Password Validation
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ msg: "Incorrect password" });
    }

    //Token generation
    const accessToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "1d",
    });

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // saving refresh Token in database
    user.refreshToken = refreshToken;
    await user.save();

    if (user) {
      user.password = undefined;
    }
    return res.status(200).send({
      msg: "Login successful",
      data: { user, accessToken },
    });
  } catch (error) {
    return res.status(500).send({ msg: error.message, data: null });
  }
};

// const verifyToken = async (req, res, next) => {
//   try {
//     let token = req.headers["authorization"]; // Bearer <token>

//     if (!token) {
//       return res
//         .status(401)
//         .json({ status: false, msg: "Access Denied. No Token Provided." });
//     }

//     token = token.split(" ")[1];

//     jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {
//       if (err)
//         return res
//           .status(500)
//           .send({ auth: false, message: "Failed to authenticate token." });
//       // if everything good, save to request for use in other routes
//       req.userId = decoded.id;
//       next();
//     });
//   } catch (error) {
//     return res.status(401).send({ msg: error.message });
//   }
// };
const verifyToken = async (req, res, next) => {
  try {
    let token = req.headers["authorization"]; // Bearer <token>

    if (!token) {
      return res.status(401).json({
        status: false,
        msg: "Access Denied. No Token Provided.",
      });
    }
    // Extract token from: Bearer <token>
    token = token.split(" ")[1];

    // Decode + verify
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    // Attach userId
    req.userId = decoded.id;

    // Fetch full user details (IMPORTANT)
    const user = await userModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ msg: "Invalid token or user not found" });
    }

    // Attach full user object to request
    req.user = user;

    // Continue
    next();
  } catch (error) {
    console.log("TOKEN ERROR:", error);
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};

const verifyRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(401)
        .send({ status: false, msg: "Refresh token required" });
    }
    // Verify refresh token validity
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Find user in DB
    const user = await userModel.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res
        .status(400)
        .json({ status: false, msg: "Invalid refresh token" });
    }
    // Generate new tokens
    const newAccessToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "45m",
    });

    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );
    // Save new refresh token in DB (replace old one)
    user.refreshToken = newRefreshToken;
    await user.save();
    const data = { accessToken: newAccessToken, refreshToken: newRefreshToken };
    return res.status(200).send({
      msg: "Access token refreshed successfully",
      data,
    });
  } catch (error) {
    return res
      .status(401)
      .send({ msg: "Token expired or invalid", error: error.message });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { mobile, customer } = req.body;

    if (!mobile) {
      return res.status(400).send({ msg: "Please Enter Mobile Number" });
    }

    const isMobileRegister = await userModel.findOne({ mobile });

    if (!isMobileRegister) {
      return res
        .status(400)
        .send({ msg: "You are not registered, Please Register first." });
    }

    // Generate random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Build the 2Factor SMS API URL
    const apiKey = "9d49164b-c436-11ef-8b17-0200cd936042";
    const templateName = "SMSOTPTemplate"; // must match the one on your 2Factor account
    const senderId = "FITMYC";

    // Prepare customer name for template variable
    const custName = customer?.split(" ")[0] || "";
    const smsUrl = `https://2factor.in/API/R1/?module=TRANS_SMS&apikey=${apiKey}&to=${mobile}&from=${senderId}&templatename=${templateName}&var1=${custName}&var2=${otp}`;

    // Send SMS via fetch (GET request)
    const response = await fetch(smsUrl);
    const result = await response.json();

    if (result.Status === "Success") {
      await otpModel.create({
        mobile,
        otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      return res.status(200).send({
        status: true,
        msg: "OTP sent successfully.",
      });
    } else {
      return res.status(500).send({
        status: false,
        msg: "Failed to send OTP via SMS.",
        data: result,
      });
    }
  } catch (error) {
    return res.status(500).send({ msg: error.message, data: null });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const otpEntry = await otpModel
      .findOne({ mobile, otp, status: "active" })
      .sort({ createdAt: -1 });

    if (!otpEntry) {
      return res.status(400).send({ msg: "Invalid or expired OTP" });
    }

    // Check expiry
    if (otpEntry.expiresAt < Date.now()) {
      otpEntry.status = "expired";
      await otpEntry.save();
      return res.status(400).send({ msg: "OTP expired" });
    }

    // Mark as used
    otpEntry.status = "used";
    await otpEntry.save();

    return res.status(200).send({ msg: "OTP verified successfully" });
  } catch (error) {
    return res.status(500).send({ msg: error.message, data: null });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { mobile, newPassword } = req.body;

    if (!mobile || !newPassword) {
      return res.status(400).send({ msg: "Please Enter the password" });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await userModel.findOneAndUpdate({ mobile }, { password: hashedPassword });

    return res.status(200).send({ msg: "Password reset successful" });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

module.exports = {
  registerUser: registerUser,
  login: login,
  sendOtp: sendOtp,
  verifyOtp: verifyOtp,
  resetPassword: resetPassword,
  verifyToken: verifyToken,
  verifyRefreshToken: verifyRefreshToken,
};
