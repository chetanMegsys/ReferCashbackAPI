const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const userModel = require("./../models/userModel");
const businessModel = require("../models/businessModel");
const { json } = require("body-parser");

const getUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || id === "") {
      const userModel = await userModel.find();
      if (!userModel) {
        return res
          .status(404)
          .send({ msg: "No userModel present", data: null });
      }
      return res
        .status(200)
        .send({ msg: "userModel fetched successfully", data: userModel });
    } else {
      const user = await userModel.findById(id);

      if (!user) {
        return res.status(404).send({ msg: "User not found", data: null });
      }
      let userData = user;
      if (user.role === "shopkeeper") {
        const business = await businessModel
          .findOne({ shopkeeperId: user._id })
          .populate("categories");
        // ✅ convert to plain JS object for easy modification

        if (business && business.location && business.location.coordinates) {
          business.location = {
            latitude: business.location.coordinates[1],
            longitude: business.location.coordinates[0],
          };
        }

        userData = { ...user.toObject(), business };
      }

      return res
        .status(200)
        .send({ msg: "User fetched successfully", data: userData });
    }
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).send({ msg: "Please enter Id" });
    }

    let updateData = req.body;
    let oldImagePath = null;

    // handle image upload
    if (req.files && req.files.image) {
      let imageFile = req.files.image;

      // ensure /public/images folder exists
      const imagesDir = path.join("public", "images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      // unique filename
      let fileName = Date.now() + "_" + imageFile.name;
      let uploadPath = path.join(imagesDir, fileName);

      // move uploaded file
      await imageFile.mv(uploadPath);

      const currentUser = await userModel.findById(id);
      if (currentUser && currentUser.imageUrl) {
        oldImagePath = path.join("public", currentUser.imageUrl); // stored relative earlier
      }

      // save relative path (accessible via express.static)
      updateData.imageUrl = `/images/${fileName}`;
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(400).send({
        msg: "User not found",
      });
    }
    // Unlinking old image in folder
    if (oldImagePath && fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }

    return res.status(200).send({
      msg: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const updateProfilePic = async (req, res) => {
  try {
    // ✅ Check file
    if (!req.files || !req.files.image) {
      return res.status(400).send({
        status: false,
        msg: "No image uploaded",
      });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({
        status: false,
        msg: "User ID is required",
      });
    }

    const file = req.files.image;

    // ✅ Validate file type (only images)
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".heif", ".heic"];
    const fileExt = path.extname(file.name).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      return res.status(400).send({
        status: false,
        msg: `Invalid file type. Allowed formats: ${allowedExtensions.join(
          ", "
        )}`,
      });
    }

    // ✅ Validate file size (<= 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return res.status(400).send({
        status: false,
        msg: "File size exceeds 5 MB limit",
      });
    }

    // ✅ Prepare upload directory
    const uploadDir = "./public/images/userProfile/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ✅ Fetch old user data (to remove old image)
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).send({
        status: false,
        msg: "User not found",
      });
    }

    // ✅ Generate new file name & path
    const fileName = `${userId}-${Date.now()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    const imageUrl = `/images/userProfile/${fileName}`;

    // ✅ Move new file to destination
    await file.mv(filePath);

    // ✅ Delete old image if exists
    if (user.imageUrl) {
      const oldImagePath = path.join("./public", user.imageUrl);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // ✅ Update new image in DB
    await userModel.updateOne({ _id: userId }, { $set: { imageUrl } });

    // ✅ Success response
    res.status(200).send({
      status: true,
      msg: "Profile image updated successfully",
      data: { imageUrl },
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).send({
      status: false,
      msg: "Server error while uploading image",
      error: error.message,
    });
  }
};

module.exports = {
  updateUser: updateUser,
  getUser: getUser,
  updateProfilePic: updateProfilePic,
};
