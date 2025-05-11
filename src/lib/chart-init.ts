/**
 * This file initializes and exports chart libraries to prevent circular dependencies
 * and initialization order issues in production builds.
 */

// Check if we're in safe mode (for production builds)
const isSafeMode = import.meta.env.VITE_CHARTS_SAFE_MODE === 'true';

// Helper function for safer initialization
function safeInitialize<T>(initFn: () => T, fallback: T): T {
  if (isSafeMode) {
    try {
      return initFn();
    } catch (error) {
      console.warn('[Charts] Error initializing chart library:', error);
      return fallback;
    }
  } else {
    return initFn();
  }
}

// Import and register Chart.js components
import {
  Chart as ChartJSOriginal,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale,
  ScatterController,
  TimeScale,
  TimeSeriesScale
} from 'chart.js';

// Create a safe wrapper for ChartJS
const ChartJS = safeInitialize(() => {
  // Register all Chart.js components
  const chart = ChartJSOriginal;
  chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    ChartTooltip,
    Legend,
    Filler,
    ArcElement,
    RadialLinearScale,
    ScatterController,
    TimeScale,
    TimeSeriesScale
  );
  return chart;
}, {} as typeof ChartJSOriginal);

// Export the registered Chart instance
export { ChartJS };

// Import recharts components
import {
  Area as AreaOriginal,
  AreaChart as AreaChartOriginal,
  Bar as BarOriginal,
  BarChart as BarChartOriginal,
  CartesianGrid as CartesianGridOriginal,
  Cell as CellOriginal,
  ComposedChart as ComposedChartOriginal,
  Legend as RechartsLegendOriginal,
  Line as LineOriginal,
  LineChart as LineChartOriginal,
  Pie as PieOriginal,
  PieChart as PieChartOriginal,
  ResponsiveContainer as ResponsiveContainerOriginal,
  Scatter as ScatterOriginal,
  ScatterChart as ScatterChartOriginal,
  Tooltip as TooltipOriginal,
  XAxis as XAxisOriginal,
  YAxis as YAxisOriginal,
  ZAxis as ZAxisOriginal
} from 'recharts';

// Create safe wrappers for recharts components
export const Area = safeInitialize(() => AreaOriginal, AreaOriginal);
export const AreaChart = safeInitialize(() => AreaChartOriginal, AreaChartOriginal);
export const Bar = safeInitialize(() => BarOriginal, BarOriginal);
export const BarChart = safeInitialize(() => BarChartOriginal, BarChartOriginal);
export const CartesianGrid = safeInitialize(() => CartesianGridOriginal, CartesianGridOriginal);
export const Cell = safeInitialize(() => CellOriginal, CellOriginal);
export const ComposedChart = safeInitialize(() => ComposedChartOriginal, ComposedChartOriginal);
export const RechartsLegend = safeInitialize(() => RechartsLegendOriginal, RechartsLegendOriginal);
export const Line = safeInitialize(() => LineOriginal, LineOriginal);
export const LineChart = safeInitialize(() => LineChartOriginal, LineChartOriginal);
export const Pie = safeInitialize(() => PieOriginal, PieOriginal);
export const PieChart = safeInitialize(() => PieChartOriginal, PieChartOriginal);
export const ResponsiveContainer = safeInitialize(() => ResponsiveContainerOriginal, ResponsiveContainerOriginal);
export const Scatter = safeInitialize(() => ScatterOriginal, ScatterOriginal);
export const ScatterChart = safeInitialize(() => ScatterChartOriginal, ScatterChartOriginal);
export const Tooltip = safeInitialize(() => TooltipOriginal, TooltipOriginal);
export const XAxis = safeInitialize(() => XAxisOriginal, XAxisOriginal);
export const YAxis = safeInitialize(() => YAxisOriginal, YAxisOriginal);
export const ZAxis = safeInitialize(() => ZAxisOriginal, ZAxisOriginal);

// Export Chart.js components for reuse
export {
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale,
  ScatterController,
  TimeScale,
  TimeSeriesScale
};

// Import react-chartjs-2 components
import {
  Line as ChartJSLineOriginal,
  Bar as ChartJSBarOriginal,
  Pie as ChartJSPieOriginal
} from 'react-chartjs-2';

// Create safe wrappers for react-chartjs-2 components
export const ChartJSLine = safeInitialize(() => ChartJSLineOriginal, ChartJSLineOriginal);
export const ChartJSBar = safeInitialize(() => ChartJSBarOriginal, ChartJSBarOriginal);
export const ChartJSPie = safeInitialize(() => ChartJSPieOriginal, ChartJSPieOriginal);
