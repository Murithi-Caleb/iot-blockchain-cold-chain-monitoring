// ESP32 Hardware Simulator
const SERVER_URL = 'http://localhost:5000/api/sensor-data';

// Replace this with the actual Traceability ID you generated in Postman
const BATCH_ID = "BATCH-1791228294744"; 
const DEVICE_ID = "ESP32_SIMULATOR_01";

function generateRandomReading(min, max) {
    return (Math.random() * (max - min) + min).toFixed(2);
}

setInterval(async () => {
    // Simulate horticultural cold chain conditions (e.g., 2-6°C, 85-95% humidity)
    const temperature = parseFloat(generateRandomReading(2.0, 6.0));
    const humidity = parseFloat(generateRandomReading(85.0, 95.0));

    const payload = {
        device_id: DEVICE_ID,
        batch_id: BATCH_ID,
        temperature: temperature,
        humidity: humidity
    };

    try {
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log(`[SIMULATOR] Sent -> Temp: ${temperature}°C, Hum: ${humidity}%`);
        } else {
            console.error(`[SIMULATOR] Failed to send data. Status: ${response.status}`);
        }
    } catch (error) {
        console.error(`[SIMULATOR] Connection error: ${error.message}`);
    }
}, 10000); // Sends data every 10 seconds

console.log("ESP32 Simulator started. Press Ctrl+C to stop.")