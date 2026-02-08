import React from "react";

const Table = ({ columns, data }) => (
  <div className="card overflow-auto">
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase text-slate-400">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="py-3 pr-4">{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id || row._id} className="border-t border-slate-800">
            {columns.map((col) => (
              <td key={col.key} className="py-3 pr-4 text-slate-200">
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
