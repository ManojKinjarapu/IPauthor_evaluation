
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Text } from 'recharts';

interface ScoreGaugeProps {
  score: number;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ];

  const getColor = (s: number) => {
    if (s >= 85) return '#22c55e'; // green-500
    if (s >= 70) return '#eab308'; // yellow-500
    if (s >= 50) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="w-full h-48 relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={0}
            dataKey="value"
          >
            <Cell fill={getColor(score)} />
            <Cell fill="#e2e8f0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[-10px] text-center">
        <span className="text-4xl font-bold block" style={{ color: getColor(score) }}>{score}</span>
        <span className="text-xs text-gray-500 font-medium uppercase tracking-widest">Efficiency Score</span>
      </div>
    </div>
  );
};

export default ScoreGauge;
