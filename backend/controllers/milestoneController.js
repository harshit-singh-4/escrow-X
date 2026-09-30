import mongoose from 'mongoose';
import Milestone from '../models/Milestone.js';
import Project from '../models/Project.js';
import Transaction from '../models/Transaction.js';
import { fundMilestone as blockchainFund, approveMilestone as blockchainApprove, releasePayment as blockchainRelease } from '../services/blockchainService.js';

export const getMilestones = async (req, res) => {
  try {
    const { projectId, status } = req.query;
    const query = {};
    if (projectId && mongoose.isValidObjectId(projectId)) query.projectId = projectId;
    if (status && status !== 'ALL') query.status = status;

    const milestones = await Milestone.find(query).populate('projectId', 'title').sort({ createdAt: -1 });
    res.json({ success: true, milestones });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMilestoneById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid milestone ID' });
    }
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found' });
    res.json({ success: true, milestone });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const fundMilestone = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid milestone ID' });
    }

    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    const project = await Project.findById(milestone.projectId);
    const amount = milestone.amount || 0;
    const clientWallet = project?.clientWallet || '';

    const bcResult = await blockchainFund(milestone._id, amount, clientWallet);

    milestone.status = 'FUNDED';
    milestone.fundedAt = new Date();
    await milestone.save();

    await Transaction.create({
      projectId: milestone.projectId,
      projectTitle: project?.title || 'Project',
      milestoneId: milestone._id,
      milestoneTitle: milestone.title,
      type: 'DEPOSIT',
      amount,
      from: clientWallet || 'Client',
      to: 'Escrow Vault',
      txHash: bcResult.txHash || '',
      status: 'CONFIRMED'
    });

    res.json({
      success: true,
      message: `Milestone funded. ${amount} USDC deposited into Escrow Vault.`,
      milestone,
      txHash: bcResult.txHash
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitWork = async (req, res) => {
  try {
    const { proof } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid milestone ID' });
    }

    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    milestone.status = 'SUBMITTED';
    milestone.proof = proof ? proof.trim() : 'Deliverables submitted for review.';
    milestone.submittedAt = new Date();
    milestone.autoReleaseDeadline = new Date(Date.now() + 72 * 3600000);
    await milestone.save();

    res.json({
      success: true,
      message: 'Deliverables submitted. Client has 72 hours to review.',
      milestone
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveMilestone = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid milestone ID' });
    }

    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    const project = await Project.findById(milestone.projectId);
    const amount = milestone.amount || 0;
    const freelancerWallet = project?.freelancerWallet || '';

    await blockchainApprove(milestone._id);
    const releaseRes = await blockchainRelease(milestone._id, amount, freelancerWallet);

    milestone.status = 'RELEASED';
    milestone.releasedAt = new Date();
    await milestone.save();

    await Transaction.create({
      projectId: milestone.projectId,
      projectTitle: project?.title || 'Project',
      milestoneId: milestone._id,
      milestoneTitle: milestone.title,
      type: 'RELEASE',
      amount,
      from: 'Escrow Vault',
      to: freelancerWallet || 'Freelancer',
      txHash: releaseRes.txHash || '',
      status: 'CONFIRMED'
    });

    res.json({
      success: true,
      message: `Milestone approved and ${amount} USDC released to freelancer.`,
      milestone,
      txHash: releaseRes.txHash
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelMilestone = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid milestone ID' });
    }
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found' });

    milestone.status = 'CANCELLED';
    await milestone.save();

    res.json({ success: true, message: 'Milestone cancelled.', milestone });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const claimAfterTimeout = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid milestone ID' });
    }

    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    if (milestone.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: `Cannot claim timeout on milestone with status '${milestone.status}'. Milestone must be in 'SUBMITTED' status.`
      });
    }

    if (!milestone.autoReleaseDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Milestone does not have an active auto-release deadline.'
      });
    }

    const now = new Date();
    const deadline = new Date(milestone.autoReleaseDeadline);
    if (now < deadline) {
      return res.status(400).json({
        success: false,
        message: `Auto-release review window is still active until ${deadline.toISOString()}. Timeout cannot be claimed yet.`
      });
    }

    const project = await Project.findById(milestone.projectId);
    const amount = milestone.amount || 0;
    const freelancerWallet = project?.freelancerWallet || '';

    const releaseRes = await blockchainRelease(milestone._id, amount, freelancerWallet);

    milestone.status = 'RELEASED';
    milestone.releasedAt = new Date();
    await milestone.save();

    await Transaction.create({
      projectId: milestone.projectId,
      projectTitle: project?.title || 'Project',
      milestoneId: milestone._id,
      milestoneTitle: milestone.title,
      type: 'RELEASE',
      amount,
      from: 'Escrow Vault',
      to: freelancerWallet || 'Freelancer',
      txHash: releaseRes.txHash || '',
      status: 'CONFIRMED'
    });

    res.json({
      success: true,
      message: `Timeout elapsed. Released ${amount} USDC to freelancer.`,
      milestone,
      txHash: releaseRes.txHash
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
