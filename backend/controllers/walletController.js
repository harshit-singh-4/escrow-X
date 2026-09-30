import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Milestone from '../models/Milestone.js';
import Project from '../models/Project.js';

export const getWalletInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    let user = null;

    if (mongoose.isValidObjectId(userId)) {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.json({
        success: true,
        wallet: {
          address: '',
          balanceUSDC: 0,
          lockedEscrowUSDC: 0,
          network: 'Not Connected',
          currency: 'USDC'
        }
      });
    }

    const walletAddress = user.walletAddress || '';

    // Calculate real locked escrow from actual milestones in MongoDB
    let lockedEscrowUSDC = 0;
    if (user.role === 'client') {
      const clientProjects = await Project.find({ client: user._id });
      const projectIds = clientProjects.map(p => p._id);
      const lockedMilestones = await Milestone.find({
        projectId: { $in: projectIds },
        status: { $in: ['FUNDED', 'SUBMITTED', 'DISPUTED'] }
      });
      lockedEscrowUSDC = lockedMilestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    } else {
      const freelancerProjects = await Project.find({ freelancer: user._id });
      const projectIds = freelancerProjects.map(p => p._id);
      const lockedMilestones = await Milestone.find({
        projectId: { $in: projectIds },
        status: { $in: ['FUNDED', 'SUBMITTED', 'DISPUTED'] }
      });
      lockedEscrowUSDC = lockedMilestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    }

    res.json({
      success: true,
      wallet: {
        address: walletAddress,
        balanceUSDC: 0,
        lockedEscrowUSDC,
        network: walletAddress ? 'Sepolia Testnet' : 'Not Connected',
        currency: 'USDC'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    let transactions = [];

    if (mongoose.isValidObjectId(userId)) {
      const user = await User.findById(userId);
      if (user?.walletAddress) {
        transactions = await Transaction.find({
          $or: [{ from: user.walletAddress }, { to: user.walletAddress }]
        }).sort({ createdAt: -1 });
      }
    }

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
