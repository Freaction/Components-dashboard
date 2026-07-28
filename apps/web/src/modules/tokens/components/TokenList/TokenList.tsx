import React, { useMemo } from 'react';
import '../TokenList.css';
import { Token, TreeNode } from '../../types';
import { buildSnapshot } from '../../utils/metrics/snapshot';
import { getTokenErrorReason } from '../../utils/metrics/reasons';
import { TokenCard } from './TokenCard';

interface TokenListProps {
    tokens: Token[];
    selectedPath: string;
    viewMode: string;
    allTokensData: Record<string, Record<string, TreeNode>> | null;
    topTokens?: Token[];
    diffMap?: any;
    searchTerm?: string;
}

export const TokenList: React.FC<TokenListProps> = ({
    tokens, viewMode, allTokensData, topTokens, diffMap
}) => {
    const snapshot = useMemo(() => {
        if (!allTokensData) return null;
        return buildSnapshot(allTokensData);
    }, [allTokensData]);

    const topTokensMap = useMemo(() => {
        if (!topTokens) return null;
        const map = new Map<string, number>();
        topTokens.forEach((t, i) => map.set(t.path || '', i + 1));
        return map;
    }, [topTokens]);

    const groupedTokens = useMemo(() => {
        const map: Record<string, Token[]> = {};
        if (!tokens) return map;

        tokens.forEach(t => {
            const path = t.path || 'Root';
            const parts = path.split('/');
            const groupKey = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
            if (!map[groupKey]) map[groupKey] = [];
            map[groupKey].push(t);
        });

        Object.keys(map).forEach(key => {
            map[key].sort((a, b) => (a.path || '').localeCompare(b.path || ''));
        });

        return map;
    }, [tokens]);

    const sortedGroupKeys = useMemo(() =>
        Object.keys(groupedTokens).sort((a, b) => a.localeCompare(b))
        , [groupedTokens]);

    if (!tokens || tokens.length === 0) {
        return (
            <div className="token-list-empty">
                No tokens found in this category or mode.
            </div>
        );
    }

    return (
        <div className="token-list-wrapper">
            <div className="token-list-container">
                {sortedGroupKeys.map(groupKey => (
                    <div key={groupKey} className="token-group">
                        <h3 className="group-title">{groupKey}</h3>
                        <div className="token-grid">
                            {groupedTokens[groupKey].map((t, i) => {
                                const path = t.path || `token-${i}`;

                                // FIXED KEY: Include figmaKey if available, and group name, to ensure true uniqueness
                                // Previously, multiple 'ghosts/Deleted Token' without IDs produced duplicate keys
                                const uniqueKey = `${viewMode}/${groupKey}/${path}/${t.figmaKey || 'no-id'}/${i}`;

                                const errorReason = snapshot ? getTokenErrorReason(t, path, snapshot) : null;
                                const isError = (viewMode === 'errors' || viewMode === 'brokens') && errorReason;
                                const diffInfo = diffMap?.tokenDiffs ? diffMap.tokenDiffs[path] || null : null;
                                const topTokenRank = topTokensMap ? topTokensMap.get(path) : null;

                                return (
                                    <TokenCard
                                        key={uniqueKey}
                                        t={t}
                                        path={path}
                                        viewMode={viewMode}
                                        allTokensData={allTokensData}
                                        isError={isError}
                                        errorReason={errorReason}
                                        depClass=""
                                        diffInfo={diffInfo}
                                        topTokenRank={topTokenRank}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
