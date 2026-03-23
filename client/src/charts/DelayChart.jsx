import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const DelayChart = ({ delayed = 0, onTime = 0 }) => {
  const data = {
    labels: ["On Time", "Delayed"],
    datasets: [
      {
        label: "Tasks",
        data: [onTime, delayed],
        backgroundColor: ["#22c55e", "#f97316"]
      }
    ]
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold">Delay Overview</h3>
      <div className="mt-4 h-32 sm:h-40">
        <Bar data={data} options={{ plugins: { legend: { display: false } } }} />
      </div>
    </div>
  );
};

export default DelayChart;
