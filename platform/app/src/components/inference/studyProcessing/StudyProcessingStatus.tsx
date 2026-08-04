import React from 'react';
import { StudyProcessingStatusCell } from './StudyProcessingStatusCell';
import { useStudyProcessing } from './StudyProcessingProvider';

export interface StudyProcessingStatusProps {
  studyInstanceUID: string;
}

export function StudyProcessingStatus({ studyInstanceUID }: StudyProcessingStatusProps) {
  const { getStudySummary } = useStudyProcessing();
  const summary = getStudySummary(studyInstanceUID);

  if (!summary) {
    return <span className="text-xs text-white/50">Loading status…</span>;
  }

  return <StudyProcessingStatusCell summary={summary} />;
}

export default StudyProcessingStatus;
