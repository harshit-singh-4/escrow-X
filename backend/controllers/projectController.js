import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Milestone from '../models/Milestone.js';
import User from '../models/User.js';

export const getProjects = async (req, res) => {
  try {
    const { status, client, freelancer, search } = req.query;
    const query = {};

    if (status && status !== 'ALL') query.status = status;
    if (client && mongoose.isValidObjectId(client)) query.client = client;
    if (freelancer && mongoose.isValidObjectId(freelancer)) query.freelancer = freelancer;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { freelancerName: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(query).sort({ createdAt: -1 }).populate('milestones');
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAvailableProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      status: 'OPEN',
      $or: [{ freelancer: null }, { freelancer: { $exists: false } }]
    })
      .sort({ createdAt: -1 })
      .populate('milestones');

    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid project ID' });
    }
    const project = await Project.findById(req.params.id).populate('milestones');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      client,
      freelancer,
      freelancerName,
      freelancerWallet,
      milestones = []
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    let clientUser = null;
    if (client && mongoose.isValidObjectId(client)) {
      clientUser = await User.findById(client);
    }

    if (!clientUser) {
      return res.status(400).json({ success: false, message: 'Valid client user account is required to create a project.' });
    }

    let freelancerUser = null;
    if (freelancer && mongoose.isValidObjectId(freelancer)) {
      freelancerUser = await User.findById(freelancer);
    } else if (freelancerWallet) {
      freelancerUser = await User.findOne({ walletAddress: freelancerWallet.trim() });
    }

    const totalAmount = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const project = new Project({
      title: title.trim(),
      description: description.trim(),
      client: clientUser._id,
      clientName: clientUser.name,
      clientWallet: clientUser.walletAddress || '',
      freelancer: freelancerUser?._id || null,
      freelancerName: freelancerUser?.name || freelancerName || 'Unassigned Freelancer',
      freelancerWallet: freelancerWallet || freelancerUser?.walletAddress || '',
      totalAmount: totalAmount || 0,
      status: freelancerUser ? 'ACTIVE' : 'OPEN'
    });

    await project.save();

    const createdMilestones = [];
    for (const m of milestones) {
      const ms = await Milestone.create({
        projectId: project._id,
        title: m.title ? m.title.trim() : 'Milestone',
        description: m.description ? m.description.trim() : '',
        amount: Number(m.amount) || 0,
        dueDate: m.dueDate || '',
        acceptanceCriteria: m.acceptanceCriteria ? m.acceptanceCriteria.trim() : 'Deliverables approved by client.',
        status: 'PENDING'
      });
      createdMilestones.push(ms._id);
    }

    project.milestones = createdMilestones;
    await project.save();

    const populated = await Project.findById(project._id).populate('milestones');

    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      project: populated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid project ID' });
    }
    const updated = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('milestones');
    if (!updated) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, project: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid project ID' });
    }
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    await Milestone.deleteMany({ projectId: req.params.id });
    res.json({ success: true, message: 'Project removed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadProjectFile = async (req, res) => {
  try {
    const { name, size, uploadedBy } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid project ID' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const newFile = {
      name: name || 'file.pdf',
      size: size || '1.0 MB',
      uploadedBy: uploadedBy || 'User',
      uploadedAt: new Date(),
      url: '#'
    };

    project.files.push(newFile);
    await project.save();

    res.json({ success: true, file: newFile, message: 'File uploaded successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
