import crypto from 'crypto';
import { exec } from '../../../core/db';

export function generateFingerprint(node: any): string {
  if (!node.children || node.children.length === 0) return '';
  
  // Create a more unique string by combining type, name, and text content
  // Normalizing with lowercase and trim to be resilient to minor naming differences
  const structure = node.children.map((c: any) => {
    const type = (c.type || '').toLowerCase().trim();
    const name = (c.name || '').toLowerCase().trim();
    const text = (c.characters || '').toLowerCase().trim(); 
    return `${type}:${name}:${text}`;
  }).join('|');
  
  return crypto.createHash('md5').update(structure).digest('hex');
}

