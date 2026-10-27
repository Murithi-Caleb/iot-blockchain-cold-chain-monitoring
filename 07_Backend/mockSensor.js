// ESP32 Hardware Simulator
//
// Usage:
//   node mockSensor.js <BATCH-ID> [--spike] [--interval=<seconds>] [--temp=<min,max>] [--humidity=<min,max>]
//
//   <BATCH-ID>          the traceability ID of a registered batch (default: BATCH-123456789)
//   --spike             periodically push readings OUT of range to trigger cold-chain
//                       events: 4 readings too warm, later 2 readings too dry, repeating
//   --interval=N        seconds between readings (default 10; use 3 for a quick demo)
//   --temp=MIN,MAX      the "normal" temperature band in °C (default 2,6)
//   --humidity=MIN,MAX  the "normal" humidity band in % (default 85,95)
//
// Set --temp/--humidity to the batch's threshold profile so normal readings stay in range
// and --spike goes outside it. Example for a profile of 4-8 °C and 88-95 %:
//   node mockSensor.js BATCH-1790981450938 --spike --interval=3 --temp=4.5,7.5 --humidity=89,94
//
// Set SENSOR_API_URL to target a backend that is not on localhost:5000.

const SERVER_URL = process.env.SENSOR_API_URL || 'http://localhost:5000/api/sensor-data';
const DEVICE_ID = 'ESP32_SIMULATOR_01';

function fail(message) {
  console.error(`[SIMULATOR] ${message}`);
  process.exit(1);
}

function parseBand(flag, fallback) {
  const raw = process.argv.slice(2).find((arg) => arg.startsWith(`--${flag}=`));
  if (!raw) return fallback;
  const [min, max] = raw.split('=')[1].split(',').map(Number);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    fail(`--${flag} must look like --${flag}=MIN,MAX with MIN lower than MAX.`);
  }
  return { min, max };
}

const args = process.argv.slice(2);
const BATCH_ID = args.find((arg) => !arg.startsWith('--')) || 'BATCH-123456789';
const SPIKE = args.includes('--spike');
const intervalArg = args.find((arg) => arg.startsWith('--interval='));
const INTERVAL_SECONDS = intervalArg ? Number(intervalArg.split('=')[1]) : 10;
if (!Number.isFinite(INTERVAL_SECONDS) || INTERVAL_SECONDS < 1) {
  fail('--interval must be a number of seconds, 1 or more.');
}
const TEMP = parseBand('temp', { min: 2, max: 6 });
const HUMIDITY = parseBand('humidity', { min: 85, max: 95 });

function generateRandomReading(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

// One 20-reading cycle: normal, 4 too-warm readings, normal, 2 too-dry readings, normal.
function phaseFor(tick) {
  const position = tick % 20;
  if (position >= 6 && position <= 9) return 'warm';
  if (position >= 16 && position <= 17) return 'dry';
  return 'normal';
}

let tick = 0;

setInterval(async () => {
  const phase = SPIKE ? phaseFor(tick) : 'normal';
  tick += 1;

  let temperature = parseFloat(generateRandomReading(TEMP.min, TEMP.max));
  let humidity = parseFloat(generateRandomReading(HUMIDITY.min, HUMIDITY.max));
  if (phase === 'warm') {
    temperature = parseFloat(generateRandomReading(TEMP.max + 1, TEMP.max + 4));
  } else if (phase === 'dry') {
    humidity = parseFloat(generateRandomReading(HUMIDITY.min - 20, HUMIDITY.min - 8));
  }

  const payload = {
    device_id: DEVICE_ID,
    batch_id: BATCH_ID,
    temperature,
    humidity
  };

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const tag = phase === 'normal' ? '' : ` [SPIKE: ${phase}]`;
    if (response.ok) {
      console.log(`[SIMULATOR] ${BATCH_ID} -> Temp: ${temperature}°C, Hum: ${humidity}%${tag}`);
    } else {
      console.error(`[SIMULATOR] Failed to send data. Status: ${response.status}`);
    }
  } catch (error) {
    console.error(`[SIMULATOR] Connection error: ${error.message}`);
  }
}, INTERVAL_SECONDS * 1000); 

console.log(
  `ESP32 Simulator started for ${BATCH_ID}: every ${INTERVAL_SECONDS}s, `
  + `normal ${TEMP.min}-${TEMP.max} °C / ${HUMIDITY.min}-${HUMIDITY.max} %`
  + `${SPIKE ? ', spikes ON' : ''}. Press Ctrl+C to stop.`
);
