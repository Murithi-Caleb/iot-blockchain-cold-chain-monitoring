import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { DEFAULT_THRESHOLDS } from '../lib/telemetry';

// Dual-axis temperature/humidity chart. Pure presentation: it only needs `data`
// points of shape { time, temperature, humidity }, so any data source (simulated,
// recorded, or live ESP32 data later) can drive it unchanged.
// Temperature is a solid line and humidity a dashed line so they stay distinguishable
// without relying on colour.
export default function TelemetryChart({ data, thresholds = DEFAULT_THRESHOLDS }) {
  const temp = thresholds.temperature;
  const hum = thresholds.humidity;

  return (
    <div
      className="chart-box"
      role="img"
      aria-label={`Line chart of temperature and humidity over the last ${data.length} readings. Latest values are listed above the chart.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6dfda" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            domain={([dataMin, dataMax]) => [
              Math.floor(Math.min(dataMin, temp.min) - 1),
              Math.ceil(Math.max(dataMax, temp.max) + 1)
            ]}
            label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            domain={([dataMin, dataMax]) => [
              Math.floor(Math.min(dataMin, hum.min) - 2),
              Math.min(100, Math.ceil(Math.max(dataMax, hum.max) + 2))
            ]}
            label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
          />
          <Tooltip />
          <Legend />
          {/* Acceptable temperature range (placeholder values, see lib/telemetry.js) */}
          <ReferenceLine
            yAxisId="left"
            y={temp.max}
            stroke="#8a6d1d"
            strokeDasharray="2 4"
            label={{ value: `Max ${temp.max} °C`, position: 'insideTopLeft', fontSize: 11 }}
          />
          <ReferenceLine
            yAxisId="left"
            y={temp.min}
            stroke="#8a6d1d"
            strokeDasharray="2 4"
            label={{ value: `Min ${temp.min} °C`, position: 'insideBottomLeft', fontSize: 11 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="temperature"
            name="Temperature °C"
            stroke="#c2410c"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="humidity"
            name="Humidity %"
            stroke="#1d5fa8"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
