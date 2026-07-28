import React from 'react';
import { resolveTokenValue, getPreviewStyles, getDisplayColor } from '../../utils/tokens';
import { Token } from '../../types';

interface TokenCardProps {
    t: Token;
    path: string;
    viewMode: string;
    allTokensData: any;
    isError: boolean | string | null;
    errorReason: string | null;
    depClass: string;
    diffInfo: any;
    topTokenRank: number | null;
}

export const TokenCard = React.memo(({
    t, path, viewMode, allTokensData, isError, errorReason, depClass, diffInfo, topTokenRank
}: TokenCardProps) => {
    const isAlias = typeof t.value === 'string' && (t.value.includes('{') || t.value.includes('$'));

    // Handling robust token value displays (including numbers and complex objects)
    let displayValue = typeof t.value === 'object'
        ? JSON.stringify(t.value, null, 1).replace(/\n/g, ' ')
        : String(t.value).replace(/['"]/g, '');

    if (displayValue.trim() === '') displayValue = '?';

    if (isAlias) {
        displayValue = `Path: ${displayValue.replace(/[{}$]/g, '')}`;
    }

    const resolvedValue = resolveTokenValue(t.value, allTokensData);
    const previewStyles = getPreviewStyles(t.type, resolvedValue);
    const isNumber = t.type === 'FLOAT' || t.type === 'NUMBER' || !isNaN(Number(t.value));

    return (
        <div className={`token-card ${viewMode === 'redundant' ? 'token-card--redundant' : ''} ${isError ? 'token-card--bad' : ''} ${depClass} ${diffInfo ? `diff-${diffInfo.status}` : ''}`}>
            <div className="token-path" style={{ color: isError ? 'var(--color-danger)' : 'inherit' }}>
                {path.split('/').pop()}
                {topTokenRank && (
                    <span className="token-rank-badge">
                        #{topTokenRank}
                    </span>
                )}
                {diffInfo && <span className={`token-diff-badge token-diff-badge--${diffInfo.status}`}>{diffInfo.status}</span>}
            </div>

            {t.description && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '-4px', marginBottom: '8px' }}>
                    {t.description}
                </div>
            )}

            <div className="token-value">
                {previewStyles && (
                    <div className="color-chip">
                        <div className="color-chip-inner" style={previewStyles as any} />
                    </div>
                )}

                {/* Make numbers visible easily */}
                {!previewStyles && isNumber && (
                    <div className="color-chip number-chip" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '9px', fontWeight: 'bold' }}>#</div>
                    </div>
                )}

                <code title={displayValue} className={isAlias ? "token-value-alias-path" : ""}>{displayValue}</code>
                {isAlias && <span className="token-alias-badge">alias</span>}
            </div>

            {diffInfo && (diffInfo.status === 'modified' || diffInfo.status === 'removed') && (
                <div className="token-diff-comparison">
                    <div className="diff-old">
                        was: <code>{typeof diffInfo.oldValue === 'object'
                            ? JSON.stringify(diffInfo.oldValue, null, 1).replace(/\n/g, ' ')
                            : String(diffInfo.oldValue).replace(/['"]/g, '')}</code>
                    </div>
                    {diffInfo.status === 'modified' && (
                        <>
                            <div className="diff-arrow">→</div>
                            <div className="diff-new">
                                is: <code>{typeof t.value === 'object'
                                    ? JSON.stringify(t.value, null, 1).replace(/\n/g, ' ')
                                    : String(t.value).replace(/['"]/g, '')}</code>
                            </div>
                        </>
                    )}
                </div>
            )}

            {isError && <div className="token-hint token-hint--danger">{errorReason}</div>}
            {viewMode === 'static' && <div className="token-hint token-hint--info">static value (same in all modes)</div>}
            {viewMode === 'hardcoded' && <div className="token-hint token-hint--warn">uses raw value instead of alias</div>}
            {viewMode === 'unused' && <div className="token-hint token-hint--info">unused primitive (no references)</div>}
            {viewMode === 'orphans' && <div className="token-hint token-hint--info">missing in some modes</div>}
            {viewMode === 'brokens' && <div className="token-hint token-hint--danger">❌ fatal: broken reference</div>}

            {(viewMode === 'top20' || viewMode === 'team-usage' || viewMode === 'zero-usage' || viewMode === 'ghosts') && t.usageCount !== undefined && (
                <div className="token-usage-stat">
                    <span className="usage-label">Used:</span>
                    <span className="usage-count">{t.usageCount}</span>
                    <span className="usage-suffix">times</span>
                </div>
            )}
        </div>
    );
});
