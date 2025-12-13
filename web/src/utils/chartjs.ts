import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js'

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title)

export { ChartJS }

