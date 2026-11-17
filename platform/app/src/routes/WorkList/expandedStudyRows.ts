export type ExpandedStudyRows = Record<string, true>;

export function toggleExpandedStudyRow(
  expandedStudyRows: ExpandedStudyRows,
  studyInstanceUID: string
): ExpandedStudyRows {
  if (!expandedStudyRows[studyInstanceUID]) {
    return {
      ...expandedStudyRows,
      [studyInstanceUID]: true,
    };
  }

  const nextExpandedStudyRows = { ...expandedStudyRows };
  delete nextExpandedStudyRows[studyInstanceUID];
  return nextExpandedStudyRows;
}
