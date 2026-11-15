// Line icons (lucide, ISC licence) mapped to the app's data keys — no emoji in the UI.
import {
  AlertTriangle, Bean, CheckCircle2, CloudRain, Coins, Droplet, Droplets, Flower2, FlaskConical, Leaf,
  Carrot, Snowflake, Sprout, Square, Sun, Thermometer, Wheat, Wind, CloudLightning, Timer, Bug, Mountain,
  CloudSun, TrendingDown,
} from 'lucide-react';

const MAP = {
  // crop families
  legume: Bean, cereal: Wheat, oilseed: Flower2, forage: Leaf, root: Carrot, fallow: Square,
  // priorities
  water: Droplets, soil: Sprout, yield: Wheat,
  // rotation tags
  restoresN: Sprout, afterHeavyFeeder: CheckCircle2, lowWater: Droplet, drought: Sun, highProfit: Coins, highN: AlertTriangle,
  // climate & metrics
  rain: CloudRain, temp: Thermometer, hot: Sun, frost: Snowflake, extreme: CloudLightning, dry: Timer, trend: TrendingDown,
  et: Wind, nitrogen: FlaskConical, fertilizer: FlaskConical, income: Coins, stability: Wheat, health: Leaf,
  // avoid rows
  climate: CloudSun, disease: Bug, soilProblem: Mountain,
};

export default function Icon({ name, size = 16, ...rest }) {
  const C = MAP[name];
  return C ? <C size={size} aria-hidden="true" {...rest} /> : null;
}
