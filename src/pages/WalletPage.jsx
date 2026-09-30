import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  History,
  AlertCircle
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Toast from '../components/common/Toast.jsx';
import Loading from '../components/common/Loading.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWallet } from '../context/WalletContext.jsx';
import { getTransactionsApi } from '../services/api.js';
import { shortenAddress, getEtherscanTxUrl } from '../services/blockchain.js';

export default function WalletPage() {
  const { user } = useAuth();
  const { address, balance, lockedInEscrow, network, connected, connectWallet, error: walletError } = useWallet();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [user, address]);

  const loadTransactions = async () => {
    if (!user?._id && !user?.id) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getTransactionsApi(user._id || user.id);
      if (res.data?.success) {
        setTransactions(res.data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout title="Wallet & Escrow Vault">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

      {walletError && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{walletError}</span>
        </div>
      )}

      {/* Top Wallet Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Main Wallet Card */}
        <Card className="md:col-span-2 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">
                Web3 Wallet Status
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                connected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'
              }`}>
                {connected ? network : 'Disconnected'}
              </span>
            </div>

            {connected && address ? (
              <div className="flex items-center gap-2 mb-6">
                <span className="font-mono text-sm sm:text-base font-bold text-slate-200 truncate">
                  {address}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                  title="Copy Address"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <div className="mb-6 py-2">
                <p className="text-lg font-bold text-slate-200">Connect your wallet</p>
                <p className="text-xs text-indigo-300 mt-0.5">
                  Link MetaMask or any browser Web3 wallet to manage escrow funds.
                </p>
                <div className="mt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Wallet}
                    onClick={connectWallet}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold"
                  >
                    Connect Wallet
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-indigo-800/80">
              <div>
                <span className="text-xs text-indigo-300">Available Balance</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold mt-1 text-white">
                  ${balance.toLocaleString()} <span className="text-sm font-semibold text-indigo-300">USDC</span>
                </h3>
              </div>
              <div>
                <span className="text-xs text-indigo-300">Locked in Active Escrow</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold mt-1 text-indigo-200">
                  ${lockedInEscrow.toLocaleString()} <span className="text-sm font-semibold text-indigo-300">USDC</span>
                </h3>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-indigo-800/60 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              onClick={loadTransactions}
            >
              Sync Ledger
            </Button>
          </div>
        </Card>

        {/* Smart Contract Card */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">EscrowX Architecture</h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Autonomous milestone vault with escrow state stored in MongoDB and verified on-chain.
            </p>
            
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Network Target</span>
                <p className="font-bold text-slate-800">Ethereum Sepolia Testnet</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Supported Currency</span>
                <p className="font-bold text-slate-800">ERC-20 USDC</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <a
              href="https://sepolia.etherscan.io"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-between"
            >
              <span>View On Sepolia Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </Card>

      </div>

      {/* Transaction History Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Escrow Transaction History</h3>
            <p className="text-xs text-slate-500">Deposits, milestone releases, and dispute settlements from MongoDB</p>
          </div>
        </div>

        {loading ? (
          <Loading message="Syncing ledger..." />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet."
            description="No transactions exist for this account yet. Transactions will appear here when you fund or release milestones."
            icon={History}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Project / Milestone</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Transaction Reference</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isDeposit = tx.type === 'DEPOSIT';

                    return (
                      <tr key={tx._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md ${
                            isDeposit ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {isDeposit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-bold text-slate-800">{tx.projectTitle}</p>
                          <p className="text-[11px] text-slate-400">{tx.milestoneTitle || 'Escrow action'}</p>
                        </td>
                        <td className="py-4 px-4 font-extrabold text-slate-900">
                          {isDeposit ? '+' : '-'}${tx.amount} USDC
                        </td>
                        <td className="py-4 px-4">
                          {tx.txHash ? (
                            <a
                              href={getEtherscanTxUrl(tx.txHash)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                            >
                              {shortenAddress(tx.txHash, 6)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">Ledger Recorded</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-400">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
