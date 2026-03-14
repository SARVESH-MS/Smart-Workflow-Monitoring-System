import React from "react";

const Table = ({ columns, data }) => (
  <div className="card overflow-x-auto">
    <table className="min-w-[640px] w-full text-left text-xs sm:text-sm">
      <thead className="text-[11px] uppercase text-slate-400 sm:text-xs">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="py-2 pr-3 sm:py-3 sm:pr-4">{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id || row._id} className="border-t border-slate-800">
            {columns.map((col) => (
              <td key={col.key} className="py-2 pr-3 text-slate-200 sm:py-3 sm:pr-4">
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Table;
