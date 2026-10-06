/*
 * Preliminary ESP32 + DHT22 cold-chain monitor.
 *
 * Dependencies (Arduino Library Manager):
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 *   - ArduinoJson
 *
 * Copy config.example.h to config.h and provide local settings before upload.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

#include "config.h"

#ifndef WIFI_SSID
#error "Set WIFI_SSID in config.h"
#endif
#ifndef WIFI_PASSWORD
#error "Set WIFI_PASSWORD in config.h"
#endif
#ifndef BACKEND_BASE_URL
#error "Set BACKEND_BASE_URL in config.h"
#endif
#ifndef DEVICE_ID
#error "Set DEVICE_ID in config.h"
#endif
#ifndef BATCH_ID
#error "Set BATCH_ID in config.h"
#endif
#ifndef DHT_PIN
#define DHT_PIN 4
#endif
#ifndef DHT_TYPE
#define DHT_TYPE DHT22
#endif
#ifndef SAMPLE_INTERVAL_MS
#define SAMPLE_INTERVAL_MS 60000UL
#endif

static constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 20000;
static constexpr uint32_t HTTP_TIMEOUT_MS = 10000;

DHT dht(DHT_PIN, DHT_TYPE);
uint32_t lastSampleAt = 0;

String sensorEndpoint() {
  String baseUrl = BACKEND_BASE_URL;
  while (baseUrl.endsWith("/")) {
    baseUrl.remove(baseUrl.length() - 1);
  }
  return baseUrl + "/api/sensor-data";
}

bool connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         static_cast<uint32_t>(millis() - startedAt) < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi unavailable; this reading will be skipped.");
    return false;
  }

  Serial.print("Connected; IP address: ");
  Serial.println(WiFi.localIP());
  return true;
}

bool postReading(float temperature, float humidity) {
  if (!connectToWiFi()) {
    return false;
  }

  JsonDocument document;
  document["device_id"] = DEVICE_ID;
  document["batch_id"] = BATCH_ID;
  document["temperature"] = temperature;
  document["humidity"] = humidity;

  String payload;
  serializeJson(document, payload);

  WiFiClient wifiClient;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  const String endpoint = sensorEndpoint();
  if (!http.begin(wifiClient, endpoint)) {
    Serial.println("Could not initialize the HTTP connection.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  const int statusCode = http.POST(payload);
  const String response = statusCode > 0 ? http.getString() : http.errorToString(statusCode);
  http.end();

  Serial.printf("POST %s -> HTTP %d\n", endpoint.c_str(), statusCode);
  if (response.length() > 0) {
    Serial.println(response);
  }
  return statusCode >= 200 && statusCode < 300;
}

void collectAndSendReading() {
  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();

  if (!isfinite(temperature) || !isfinite(humidity)) {
    Serial.println("DHT22 returned an invalid reading; skipping transmission.");
    return;
  }

  Serial.printf("Temperature: %.1f C | Humidity: %.1f %%\n", temperature, humidity);
  if (!postReading(temperature, humidity)) {
    Serial.println("Reading was not accepted by the backend.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  dht.begin();
  Serial.println("Cold-chain ESP32 monitor starting.");
  Serial.printf("Device: %s | Batch: %s\n", DEVICE_ID, BATCH_ID);

  // DHT22 needs a short settling time after power-up.
  delay(2000);
  collectAndSendReading();
  lastSampleAt = millis();
}

void loop() {
  if (static_cast<uint32_t>(millis() - lastSampleAt) >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = millis();
    collectAndSendReading();
  }
  delay(50);
}
