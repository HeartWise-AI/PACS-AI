import React from 'react';

const Table = ({ headers, data, children, className, onRowClick }) => {
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full text-left text-sm rtl:text-right ">
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
              key={rowIndex}
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
                  {children(item[header.value], header, item)}
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
