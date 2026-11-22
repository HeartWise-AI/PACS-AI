import React, { useState } from 'react';
import { render } from '@testing-library/react';
import Table, { type TableProps } from './Table';

interface TestRow {
  id: string;
  name: string;
}

const TypedTable = Table as React.ComponentType<TableProps<TestRow>>;

let nextInstance = 0;

function StatefulCell({ rowId }: { rowId: string }) {
  const [instance] = useState(() => ++nextInstance);
  return React.createElement('span', null, `${rowId}:${instance}`);
}

const headers = [{ text: 'Name', value: 'name', align: 'left' }];
const rows = [
  { id: 'member-a', name: 'Member A' },
  { id: 'member-b', name: 'Member B' },
];
const renderTable = (data: TestRow[]) =>
  React.createElement(TypedTable, { headers, data }, (_cell, _header, row) =>
    React.createElement(StatefulCell, { rowId: row.id })
  );

describe('Table stable row identity', () => {
  test('keeps row-local controls attached to the same member after reordering', () => {
    nextInstance = 0;
    const { container, rerender } = render(renderTable(rows));
    const spanTexts = () =>
      Array.from(container.querySelectorAll('span')).map(node => node.textContent);

    expect(spanTexts()).toEqual(['member-a:1', 'member-b:2']);

    rerender(renderTable([...rows].reverse()));

    expect(spanTexts()).toEqual(['member-b:2', 'member-a:1']);
  });
});
