import React, { createContext, useContext, useState, useEffect } from 'react';
import { connectBrowserWallet, shortenAddress } from '../services/blockchain.js';
import { getWalletInfoApi } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const { user, updateUser } = useAuth();
  const [connected, setConnected] = useState(Boolean(user?.walletAddress));
  const [address, setAddress] = useState(user?.walletAddress || '');
  const [balance, setBalance] = useState(0);
  const [lockedInEscrow, setLockedInEscrow] = useState(0);
  const [network, setNetwork] = useState(user?.walletAddress ? 'Sepolia Testnet' : 'Not Connected');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.walletAddress) {
      setAddress(user.walletAddress);
      setConnected(true);
      fetchWalletData(user.walletAddress);
    } else {
      setAddress('');
      setConnected(false);
      setBalance(0);
      setLockedInEscrow(0);
      setNetwork('Not Connected');
    }
  }, [user]);

  const fetchWalletData = async (targetAddress) => {
    const queryId = user?._id || user?.id || targetAddress;
    if (!queryId) return;
    try {
      const res = await getWalletInfoApi(queryId);
      if (res.data?.success && res.data.wallet) {
        setBalance(res.data.wallet.balanceUSDC || 0);
        setLockedInEscrow(res.data.wallet.lockedEscrowUSDC || 0);
        if (res.data.wallet.address) setAddress(res.data.wallet.address);
        if (res.data.wallet.network) setNetwork(res.data.wallet.network);
      }
    } catch (e) {
      // If error or empty, keep values at 0
      setBalance(0);
      setLockedInEscrow(0);
    }
  };

  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectBrowserWallet();
      if (result.success) {
        setAddress(result.address);
        setConnected(true);
        setNetwork(result.network || 'Sepolia Testnet');
        if (user && updateUser) {
          updateUser({ walletAddress: result.address });
        }
        await fetchWalletData(result.address);
        return result;
      } else {
        setError(result.error);
        return result;
      }
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setConnected(false);
    setAddress('');
    setBalance(0);
    setLockedInEscrow(0);
    setNetwork('Not Connected');
    setError(null);
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        address,
        shortAddress: shortenAddress(address),
        balance,
        lockedInEscrow,
        network,
        loading,
        error,
        connectWallet,
        disconnectWallet,
        refreshWallet: () => fetchWalletData(address)
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
