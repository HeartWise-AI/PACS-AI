import React from 'react';

export interface TableHeader {
  text: React.ReactNode;
  value: string;
  align?: string;
}

// Dynamic columns intentionally defer cell-value narrowing to each render callback.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableCellValue = any;

export interface TableProps<T extends object> {
  headers: TableHeader[];
  data: T[];
  children?: (cell: TableCellValue, header: TableHeader, row: T) => React.ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
}

const Table = <T extends object>({
  headers,
  data,
  children,
  className = '',
  onRowClick,
}: TableProps<T>) => {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full text-left text-sm rtl:text-right">
        <thead className="bg-transparent text-sm font-light text-white text-opacity-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                scope="col"
                className={`px-2 py-2 text-${header.align}`}
              >
                {header.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, rowIndex) => (
            <tr
              key={((item as Record<string, unknown>).id as React.Key) ?? rowIndex}
              className={`bg-transparent text-base text-white ${
                onRowClick ? 'cursor-pointer' : ''
              } hover:bg-white hover:bg-opacity-10`}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {headers.map((header, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`break-words px-2 py-2 text-${header.align} ${className}`}
                >
                  {children?.((item as Record<string, unknown>)[header.value], header, item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
