const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const userModel = require("./../models/userModel");

const getUser = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id || id === "") {
      const users = await userModel.find();
      if (!users) {
        return res.status(404).send({ msg: "No users present", data: null });
      }
      return res
        .status(200)
        .send({ msg: "Users fetched successfully", data: users });
    } else {
      const user = await userModel.findById(id);
      if (!user) {
        return res.status(404).send({ msg: "User not found", data: null });
      }
      return res
        .status(200)
        .send({ msg: "User fetched successfully", data: user });
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

module.exports = {
  updateUser: updateUser,
  getUser: getUser,
};
