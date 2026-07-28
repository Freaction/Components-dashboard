import React from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Node } from './useNodeGraph';

interface NodeNavigatorHUDProps {
  selectedPath: string;
  neighbors: { incoming: Node[], outgoing: Node[] };
  colors: any;
  onSelectPath: (path: string) => void;
  onCenter: (path: string) => void;
}

const NodeNavigatorHUD: React.FC<NodeNavigatorHUDProps> = ({ 
  selectedPath, neighbors, colors, onSelectPath, onCenter 
}) => {
  if (!selectedPath || (neighbors.incoming.length === 0 && neighbors.outgoing.length === 0)) return null;

  return (
    <div className="node-navigator-hud">
      {neighbors.outgoing.length > 0 && (
        <div className="hud-section">
          <span className="hud-label">
            <ArrowRight size={14} color={colors.REFS} strokeWidth={3} /> References:
          </span>
          <div className="hud-pills">
            {neighbors.outgoing.map(n => (
              <div 
                key={n.id} 
                className="hud-pill hud-pill--outgoing" 
                onClick={() => { onCenter(n.path); onSelectPath(n.path); }}
              >
                {n.label}
              </div>
            ))}
          </div>
        </div>
      )}
      {neighbors.incoming.length > 0 && (
        <div className="hud-section">
          <span className="hud-label">
            <ArrowLeft size={14} color={colors.DEPENDENTS} strokeWidth={3} /> Dependents:
          </span>
          <div className="hud-pills">
            {neighbors.incoming.map(n => (
              <div 
                key={n.id} 
                className="hud-pill hud-pill--incoming" 
                onClick={() => { onCenter(n.path); onSelectPath(n.path); }}
              >
                {n.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeNavigatorHUD;
