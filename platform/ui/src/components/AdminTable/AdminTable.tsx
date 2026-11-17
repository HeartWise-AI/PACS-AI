import React, { useState } from 'react';
import { Typography } from '@ohif/ui';
import { useTranslation } from 'react-i18next';

const AdminTable = ({ headers, data }) => {
  return (
    <table className="w-full text-left text-sm rtl:text-right">
      <thead className="bg-transparent text-sm font-light text-white text-opacity-50">
        <tr>
          {headers.map((header, index) => (
            <th
              key={index}
              scope="col"
              className="px-6 py-3"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, rowIndex) => (
          <tr
            key={rowIndex}
            className={`bg-transparent text-base text-white`}
          >
            {item.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className="px-6 py-4"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AdminTable;
