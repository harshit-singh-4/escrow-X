import mongoose from 'mongoose';
import Message from '../models/Message.js';

export const getMessagesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.isValidObjectId(projectId)) {
      return res.json({ success: true, messages: [] });
    }
    const messages = await Message.find({ projectId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sender, senderName, senderRole, text } = req.body;

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required.' });
    }

    if (!sender || !mongoose.isValidObjectId(sender)) {
      return res.status(401).json({ success: false, message: 'Authentication required. A valid user ID is required to send messages.' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }

    const message = await Message.create({
      projectId,
      sender,
      senderName: senderName || 'User',
      senderRole: senderRole || 'client',
      text: text.trim(),
      createdAt: new Date()
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
