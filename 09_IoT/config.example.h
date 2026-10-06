// Copy this file to config.h and fill in values for your local device.
// Keep config.h private; 09_IoT/.gitignore excludes it from Git.
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// Use the host machine's LAN address when the ESP32 and backend share a network.
// Example: "http://192.168.1.20:5000"
#define BACKEND_BASE_URL "http://192.168.1.20:5000"

#define DEVICE_ID "ESP32-1"
// Use an existing traceability ID returned by POST /api/batches.
#define BATCH_ID "BATCH-REPLACE_WITH_EXISTING_ID"

#define DHT_PIN 4
#define DHT_TYPE DHT22
#define SAMPLE_INTERVAL_MS 60000UL
