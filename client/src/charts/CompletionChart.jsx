import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const CompletionChart = ({ completed = 0, total = 0 }) => {
  const data = {
    labels: ["Completed", "Remaining"],
    datasets: [
      {
        data: [completed, Math.max(total - completed, 0)],
        backgroundColor: ["#3b82f6", "#1f2937"],
        borderWidth: 0
      }
    ]
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">Completion Rate</h3>
      <div className="mt-4 h-40">
        <Doughnut data={data} options={{ cutout: "70%" }} />
      </div>
    </div>
  );
};

export default CompletionChart;
