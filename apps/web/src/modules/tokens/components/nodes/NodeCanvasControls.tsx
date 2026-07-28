import React from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface NodeCanvasControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const NodeCanvasControls: React.FC<NodeCanvasControlsProps> = ({ 
  zoom, onZoomIn, onZoomOut, onReset 
}) => {
  return (
    <div className="node-controls">
      <div className="node-control-btn" onClick={onZoomIn} title="Zoom In"><ZoomIn size={16} /></div>
      <div className="node-control-btn" onClick={onZoomOut} title="Zoom Out"><ZoomOut size={16} /></div>
      <div className="node-control-btn" onClick={onReset} title="Reset View"><Maximize size={16} /></div>
      <div className="node-zoom-label">{(zoom * 100).toFixed(0)}%</div>
    </div>
  );
};

export default NodeCanvasControls;
