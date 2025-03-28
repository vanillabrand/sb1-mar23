interface ExposureBreakdownProps {
  data: {
    asset: string;
    exposure: number;
    change: number;
  }[];
}

export function ExposureBreakdownChart({ data }: ExposureBreakdownProps) {
  return (
    <div className="bg-gunmetal-900/50 rounded-xl p-6">
      <h3 className="text-xl font-bold gradient-text mb-6">Exposure Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151" 
              vertical={false} 
            />
            <XAxis 
              dataKey="asset" 
              tick={{ fill: '#9CA3AF' }}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis 
              tick={{ fill: '#9CA3AF' }}
              axisLine={{ stroke: '#374151' }}
              unit="%" 
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-gunmetal-800 p-2 rounded-lg shadow-xl">
                      <p className="text-gray-300">{label}</p>
                      <p className="text-neon-turquoise font-bold">
                        {payload[0].value}%
                      </p>
                      <p className={`text-sm ${
                        payload[0].payload.change > 0 
                          ? 'text-green-400' 
                          : 'text-red-400'
                      }`}>
                        {payload[0].payload.change > 0 ? '+' : ''}
                        {payload[0].payload.change}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="exposure" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}