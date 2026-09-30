import mongoose from 'mongoose';
import Dispute from '../models/Dispute.js';
import Milestone from '../models/Milestone.js';
import Project from '../models/Project.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { analyzeDispute } from '../services/aiService.js';
import { releasePayment } from '../services/blockchainService.js';

export const getDisputes = async (req, res) => {
  try {
    const { status, projectId } = req.query;
    const query = {};

    if (projectId && mongoose.isValidObjectId(projectId)) query.projectId = projectId;

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        query.status = { $in: ['ACTIVE', 'EVIDENCE_RECEIVED'] };
      } else if (status === 'UNDER_AI_REVIEW') {
        query.status = { $in: ['UNDER_AI_REVIEW', 'RULING_GENERATED'] };
      } else if (status === 'APPEALS') {
        query.status = 'APPEAL_PERIOD';
      } else if (status === 'RESOLVED') {
        query.status = 'FINALIZED';
      } else {
        query.status = status;
      }
    }

    const disputes = await Dispute.find(query).sort({ createdAt: -1 });
    res.json({ success: true, disputes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDisputeById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid dispute ID' });
    }
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found' });
    res.json({ success: true, dispute });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDispute = async (req, res) => {
  try {
    const { milestoneId, clientClaim = '', freelancerClaim = '', openedBy, openedByName, openedByRole = 'client' } = req.body;

    if (!mongoose.isValidObjectId(milestoneId)) {
      return res.status(400).json({ success: false, message: 'Valid milestone ID is required.' });
    }

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found.' });
    }

    const project = await Project.findById(milestone.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Associated project not found.' });
    }

    let openerUser = null;
    if (openedBy && mongoose.isValidObjectId(openedBy)) {
      openerUser = await User.findById(openedBy);
    }

    const dispute = await Dispute.create({
      projectId: project._id,
      projectTitle: project.title,
      milestoneId: milestone._id,
      milestoneTitle: milestone.title,
      amount: milestone.amount || 0,
      openedBy: openerUser?._id || project.client,
      openedByName: openerUser?.name || openedByName || (openedByRole === 'client' ? project.clientName : project.freelancerName),
      openedByRole,
      clientClaim: clientClaim.trim(),
      freelancerClaim: freelancerClaim.trim(),
      acceptanceCriteria: milestone.acceptanceCriteria || 'Deliverables verified and accepted.',
      status: 'ACTIVE',
      evidence: []
    });

    milestone.status = 'DISPUTED';
    await milestone.save();

    res.status(201).json({
      success: true,
      message: 'Dispute initialized. Milestone locked in escrow pending arbitration.',
      dispute
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addEvidence = async (req, res) => {
  try {
    const { submittedBy, name, description } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid dispute ID' });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    dispute.evidence.push({
      submittedBy: submittedBy || 'client',
      name: name || 'evidence_file.pdf',
      description: description || 'Evidence documentation',
      date: new Date()
    });
    dispute.status = 'EVIDENCE_RECEIVED';
    await dispute.save();

    res.json({
      success: true,
      message: 'Evidence added to case dossier.',
      dispute
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const runAIRuling = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid dispute ID' });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    const project = await Project.findById(dispute.projectId);
    const milestone = await Milestone.findById(dispute.milestoneId);

    const aiResult = await analyzeDispute({
      projectTitle: project?.title || dispute.projectTitle,
      projectDescription: project?.description || '',
      milestoneTitle: milestone?.title || dispute.milestoneTitle,
      milestoneDescription: milestone?.description || '',
      acceptanceCriteria: dispute.acceptanceCriteria || milestone?.acceptanceCriteria || 'Acceptance criteria verification',
      clientClaim: dispute.clientClaim || 'Deliverables did not meet specification.',
      freelancerClaim: dispute.freelancerClaim || 'Delivered work according to scope.',
      evidence: dispute.evidence || []
    });

    dispute.status = 'RULING_GENERATED';
    dispute.aiWinner = aiResult.winner;
    dispute.aiConfidence = aiResult.confidence;
    dispute.aiReasoning = aiResult.reasoning;
    dispute.appealPeriodExpires = new Date(Date.now() + 48 * 3600000);
    await dispute.save();

    res.json({
      success: true,
      message: 'AI Arbitration analysis completed! Ruling rendered.',
      dispute,
      ruling: aiResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const appealRuling = async (req, res) => {
  try {
    const { reason, appealedBy } = req.body;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid dispute ID' });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    dispute.status = 'APPEAL_PERIOD';
    dispute.aiReasoning = (dispute.aiReasoning || '') + `\n\n[Appeal Logged by ${appealedBy || 'Party'}]: ${reason || 'Additional explanation submitted.'}`;
    await dispute.save();

    res.json({
      success: true,
      message: 'Appeal recorded. Case status updated.',
      dispute
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const finalizeRuling = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Invalid dispute ID' });
    }

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    const project = await Project.findById(dispute.projectId);
    const winner = dispute.aiWinner || 'freelancer';
    const amount = dispute.amount || 0;
    const recipientWallet = winner === 'client'
      ? (project?.clientWallet || '')
      : (project?.freelancerWallet || '');

    const releaseRes = await releasePayment(dispute._id, amount, recipientWallet);

    dispute.status = 'FINALIZED';
    await dispute.save();

    await Milestone.findByIdAndUpdate(dispute.milestoneId, {
      status: winner === 'client' ? 'REFUNDED' : 'RELEASED'
    });

    await Transaction.create({
      projectId: dispute.projectId,
      projectTitle: dispute.projectTitle,
      milestoneId: dispute.milestoneId,
      milestoneTitle: dispute.milestoneTitle,
      type: winner === 'client' ? 'REFUND' : 'DISPUTE_PAYOUT',
      amount,
      from: 'Escrow Vault',
      to: recipientWallet || (winner === 'client' ? 'Client' : 'Freelancer'),
      txHash: releaseRes.txHash || '',
      status: 'CONFIRMED'
    });

    res.json({
      success: true,
      message: `Dispute finalized. Released ${amount} USDC to ${winner}.`,
      dispute,
      txHash: releaseRes.txHash
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
