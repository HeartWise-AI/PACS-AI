import {
  csvSafeCell,
  enrichPredictionsCSV,
  MAX_EXPORT_RESULT_LOOKUPS,
  parseCSV,
  serializeCSV,
} from './csvExport';

const HEADER = [
  'Run time',
  'Study Instance UID',
  'Accession number',
  'MRN',
  'Patient name',
  'Modality',
  'Model',
  'Model version',
  'Trigger',
  'Launched by',
  'Status',
  'Duration (s)',
  'Key result',
  'Failure or skip reason',
  'Run ID',
  'Execution ID',
];

function line(study: string, modelName: string, status: string, execution: string): string[] {
  return [
    '2026-11-16T09:00:00Z',
    study,
    'SYN-ACC',
    'SYN-MRN',
    '',
    'XA',
    modelName,
    '1.0.0',
    'Automatic',
    'Automatic',
    status,
    '12.0',
    '',
    '',
    'run-1',
    execution,
  ];
}

describe('CSV export', () => {
  test('parses quoted fields, CRLF and the byte order mark, and serialises them back', () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""","line\nbreak"\r\n';
    const rows = parseCSV(text);
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line\nbreak'],
    ]);
    expect(serializeCSV(rows)).toBe(text);
  });

  test('neutralises formulas like the gateway', () => {
    expect(['=1+1', '+33', '-2', '@SUM(A1)', '\tx', 'Dr A', ''].map(csvSafeCell)).toEqual([
      "'=1+1",
      "'+33",
      "'-2",
      "'@SUM(A1)",
      "'\tx",
      'Dr A',
      '',
    ]);
  });

  test('fills patient names and the key results of completed main-model runs', async () => {
    const rows = [
      HEADER,
      line('1.1', 'DeepCORO-SYNTAX', 'completed', 'ex-1'),
      line('1.1', 'EchoPrime', 'completed', 'ex-2'),
      line('1.2', 'DeepCORO-SYNTAX', 'failed', 'ex-3'),
    ];
    const keyResult = jest.fn(async () => '=SYNTAX 12');
    const patientName = jest.fn(async (uid: string) =>
      uid === '1.1' ? 'SYNTHETIC PATIENT' : null
    );
    const summary = await enrichPredictionsCSV(rows, {
      patientName,
      keyResult,
      hasKeyResult: name => name === 'DeepCORO-SYNTAX',
    });
    expect(summary).toEqual({ namesSkipped: 0, resultsSkipped: 0 });
    expect(patientName).toHaveBeenCalledTimes(2);
    expect(keyResult).toHaveBeenCalledTimes(1);
    expect(keyResult).toHaveBeenCalledWith({
      runId: 'run-1',
      executionId: 'ex-1',
      modelName: 'DeepCORO-SYNTAX',
    });
    expect(rows[1][4]).toBe('SYNTHETIC PATIENT');
    expect(rows[1][12]).toBe("'=SYNTAX 12");
    expect(rows[2][12]).toBe('');
    expect(rows[3][4]).toBe('');
  });

  test('bounds the result lookups and reports what was left out', async () => {
    const rows = [
      HEADER,
      ...Array.from({ length: MAX_EXPORT_RESULT_LOOKUPS + 5 }, (_value, index) =>
        line('1.1', 'DeepCORO-SYNTAX', 'completed', `ex-${index}`)
      ),
    ];
    const keyResult = jest.fn(async () => 'SYNTAX 1');
    const summary = await enrichPredictionsCSV(rows, {
      patientName: async () => null,
      keyResult,
      hasKeyResult: () => true,
    });
    expect(keyResult).toHaveBeenCalledTimes(MAX_EXPORT_RESULT_LOOKUPS);
    expect(summary.resultsSkipped).toBe(5);
  });
});
