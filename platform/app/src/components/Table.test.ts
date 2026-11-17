import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
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
    const renderer = TestRenderer.create(renderTable(rows));

    expect(renderer.root.findAllByType('span').map(node => node.children.join(''))).toEqual([
      'member-a:1',
      'member-b:2',
    ]);

    act(() => renderer.update(renderTable([...rows].reverse())));

    expect(renderer.root.findAllByType('span').map(node => node.children.join(''))).toEqual([
      'member-b:2',
      'member-a:1',
    ]);
  });
});
