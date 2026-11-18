import { utils } from '@ohif/core';

/**
 * OHIF compatibility adapter (PLAN.md 6.4): DICOM date and patient-name
 * formatting as OHIF shows them.
 */
export function formatDICOMDate(date: string | undefined, format?: string): string {
  return utils.formatDate(date, format);
}

export function formatPatientName(name: unknown): string {
  return utils.formatPN(name) ?? '';
}
