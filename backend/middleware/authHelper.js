import mongoose from 'mongoose';
import User from '../models/User.js';

export const getAuthUser = async (req) => {
  const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId;
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  return await User.findById(userId);
};
