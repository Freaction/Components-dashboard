import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TreeNode } from '../types';
import { fetchVersions, fetchTokens } from '../services/api';

interface TokenContextType {
  versions: string[];
  selectedVersion: string;
  setSelectedVersion: (version: string) => void;
  tokensData: Record<string, Record<string, TreeNode>> | null;
  previousTokensData: Record<string, Record<string, TreeNode>> | null;
  loading: boolean;
  error: string | null;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export const TokenProvider = ({ children }: { children: ReactNode }) => {
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  
  useEffect(() => {
    fetchVersions().then(vers => {
      setVersions(vers);
      if (vers.length > 0) setSelectedVersion(vers[0]);
    });
  }, []);

  const { data: tokensData, isLoading, error } = useQuery({
    queryKey: ['tokens', selectedVersion],
    queryFn: () => fetchTokens(selectedVersion),
    enabled: !!selectedVersion,
  });

  const previousVersion = useMemo(() => {
    if (!selectedVersion || versions.length < 2) return null;
    const currentIndex = versions.indexOf(selectedVersion);
    if (currentIndex === -1 || currentIndex === versions.length - 1) return null;
    return versions[currentIndex + 1];
  }, [selectedVersion, versions]);

  const { data: previousTokensData, isLoading: isLoadingPrev } = useQuery({
    queryKey: ['tokens', previousVersion],
    queryFn: () => fetchTokens(previousVersion!),
    enabled: !!previousVersion,
  });

  return (
    <TokenContext.Provider value={{ 
      versions, 
      selectedVersion, 
      setSelectedVersion, 
      tokensData: tokensData || null, 
      previousTokensData: previousTokensData || null,
      loading: isLoading || isLoadingPrev, 
      error: error ? error.message : null 
    }}>
      {children}
    </TokenContext.Provider>
  );
};

export const useTokens = () => {
  const context = useContext(TokenContext);
  if (!context) throw new Error('useTokens must be used within a TokenProvider');
  return context;
};
