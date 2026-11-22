import { sortStudiesNewestFirst } from './sortStudies';

describe('sortStudiesNewestFirst', () => {
  it('puts the most recent study first, by date then time', () => {
    const studies = [
      { studyInstanceUID: 'a', patientName: 'ALPHA', studyDate: '20100101', studyTime: '090000' },
      { studyInstanceUID: 'b', patientName: 'BRAVO', studyDate: '20261118', studyTime: '081500' },
      { studyInstanceUID: 'c', patientName: 'CHARLIE', studyDate: '20261118', studyTime: '143000.25' },
      { studyInstanceUID: 'd', patientName: 'DELTA', studyDate: '', studyTime: '' },
      { studyInstanceUID: 'e', patientName: 'ECHO', studyDate: '20261117', studyTime: '235959' },
    ];
    expect(sortStudiesNewestFirst(studies).map(study => study.studyInstanceUID)).toEqual([
      'c',
      'b',
      'e',
      'a',
      'd',
    ]);
  });

  it('keeps name order for studies at the same time and does not change the input', () => {
    const studies = [
      { patientName: 'ZULU', studyDate: '20261118', studyTime: '100000' },
      { patientName: 'ALPHA', studyDate: '20261118', studyTime: '100000' },
    ];
    expect(sortStudiesNewestFirst(studies).map(study => study.patientName)).toEqual(['ALPHA', 'ZULU']);
    expect(studies[0].patientName).toBe('ZULU');
  });
});
