import mongoose from 'mongoose';
import User from '../models/User.js';

export const getUserById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid user ID' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid user ID' });
    }
    const { name, bio, skills, walletAddress, links, avatar } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { name, bio, skills, walletAddress, links, avatar },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: updated, message: 'Profile updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
