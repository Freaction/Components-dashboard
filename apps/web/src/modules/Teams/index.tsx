import React from 'react';
import { TeamsView as View } from './TeamsView';
import { TeamsProvider } from './TeamsContext';

export const TeamsView: React.FC = () => (
  <TeamsProvider>
    <View />
  </TeamsProvider>
);

export * from './TeamsContext';
export * from './components/types';
