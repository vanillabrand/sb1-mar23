interface RiskDistributionProps {
  data: {
    riskLevel: string;
    percentage: number;
    value: number;
  }[];
}

export function RiskDistributionChart({ data }: RiskDistributionProps) {
  const COLORS = {
    'Low': '#10B981',
    'Medium': '#F59E0B',
    'High': '#F97316',
    'Critical': '#FF1493'
  };

  return (
    <div className="bg-gunmetal-900/50 rounded-xl p-6">
      <h3 className="text-xl font-bold gradient-text mb-6">Risk Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.riskLevel as keyof typeof COLORS]} 
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gunmetal-800 p-2 rounded-lg shadow-xl">
                      <p className="text-gray-300">{data.riskLevel}</p>
                      <p className="text-neon-turquoise font-bold">
                        {data.percentage.toFixed(2)}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => (
                <span className="text-gray-400">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}