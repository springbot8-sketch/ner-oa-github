/*
 * AI-Assisted Early Detection System for Osteoarthritis (OA) Risk Markers - North Eastern Region (NER)
 * ESP32 SINGLE-LEG Hardware Firmware  --  2 x MPU6050 IMUs + 2 x FSR Sensors per board
 *
 * You need TWO of these boards, one strapped to the LEFT leg and one to the
 * RIGHT leg. Each board only reports on the leg it's attached to. Flash the
 * exact same file to both boards -- just change LEG_SIDE below before each
 * upload.
 *
 * Hardware Layout (PER BOARD):
 *   - MPU_1 (Thigh) : I2C address 0x68  (AD0 pin tied to GND)
 *   - MPU_2 (Shank)  : I2C address 0x69  (AD0 pin tied to 3.3V)
 *     Both share the same I2C bus (SDA=21, SCL=22) -- no multiplexer needed
 *     since there are only 2 IMUs on this board.
 *   - FSR_1 (Medial / 1st Metatarsal) : Pin 34 (ADC1_CH6)
 *   - FSR_2 (Lateral / 5th Metatarsal): Pin 35 (ADC1_CH7)
 *     (Change PIN_FSR_1 / PIN_FSR_2 below if your wiring differs. Any
 *     ADC1-capable input-only pin works: 32-39.)
 *
 * Wiring an FSR: one leg of the FSR to 3.3V, the other leg to both the ESP32
 * ADC pin AND a ~10k pull-down resistor to GND. If a channel always reads 0,
 * check the pull-down resistor and that the FSR itself isn't open-circuit.
 *
 * Communication: 115200 baud, one JSON line per sample, ~50Hz.
 * Each board sends ONLY its own leg's data -- the PC/Pi side opens two
 * separate serial connections (one per board) and merges them.
 */

#include <Wire.h>
#include <ArduinoJson.h>

// ======================= SET THIS BEFORE FLASHING =======================
// Change to "right" for the board strapped to the right leg.
const char* LEG_SIDE = "left";
// ==========================================================================

// FSR Pin Definitions (this board only reads 2 channels)
const int PIN_FSR_1 = 34; // Medial (1st Metatarsal)
const int PIN_FSR_2 = 35; // Lateral (5th Metatarsal)

// MPU6050 I2C addresses (set via each board's AD0 pin)
const uint8_t MPU_THIGH_ADDR = 0x68;
const uint8_t MPU_SHANK_ADDR = 0x69;

// Complementary filter weight
const float ALPHA = 0.96;
float pitch_thigh = 0, pitch_shank = 0;

// FSR calibration (captured at startup, assumes no-load / unweighted at boot)
int fsrZero1 = 0, fsrZero2 = 0;

// Simple moving-average smoothing for the FSR channels to cut ADC noise
// (this is most of what makes raw FSR readings look "random"/jittery).
const int FSR_SMOOTH_N = 6;
int fsr1Buf[FSR_SMOOTH_N] = {0};
int fsr2Buf[FSR_SMOOTH_N] = {0};
int fsrBufIdx = 0;

unsigned long lastTime = 0;

void initMPU(uint8_t addr) {
  Wire.beginTransmission(addr);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // Wake up MPU6050
  Wire.endTransmission(true);
}

bool readMPUAccelGyro(uint8_t addr, float &ax, float &ay, float &az, float &gx, float &gy, float &gz) {
  Wire.beginTransmission(addr);
  Wire.write(0x3B); // Start at ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false; // sensor not responding

  uint8_t received = Wire.requestFrom((int)addr, 14, (int)true);
  if (received < 14) return false;

  int16_t rawAx = Wire.read() << 8 | Wire.read();
  int16_t rawAy = Wire.read() << 8 | Wire.read();
  int16_t rawAz = Wire.read() << 8 | Wire.read();
  Wire.read(); Wire.read(); // discard temperature
  int16_t rawGx = Wire.read() << 8 | Wire.read();
  int16_t rawGy = Wire.read() << 8 | Wire.read();
  int16_t rawGz = Wire.read() << 8 | Wire.read();

  ax = rawAx / 16384.0;
  ay = rawAy / 16384.0;
  az = rawAz / 16384.0;
  gx = rawGx / 131.0;
  gy = rawGy / 131.0;
  gz = rawGz / 131.0;
  return true;
}

int smoothedRead(int pin, int *buf) {
  buf[fsrBufIdx] = analogRead(pin);
  long sum = 0;
  for (int i = 0; i < FSR_SMOOTH_N; i++) sum += buf[i];
  return sum / FSR_SMOOTH_N;
}

void calibrateFSRZero() {
  long sum1 = 0, sum2 = 0;
  const int samples = 40;
  for (int i = 0; i < samples; i++) {
    sum1 += analogRead(PIN_FSR_1);
    sum2 += analogRead(PIN_FSR_2);
    delay(5);
  }
  fsrZero1 = sum1 / samples;
  fsrZero2 = sum2 / samples;
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // SDA = Pin 21, SCL = Pin 22
  Wire.setClock(400000);

  pinMode(PIN_FSR_1, INPUT);
  pinMode(PIN_FSR_2, INPUT);

  initMPU(MPU_THIGH_ADDR);
  initMPU(MPU_SHANK_ADDR);

  // Let the FSRs settle, then record the unloaded (zero) baseline so the
  // reported Newton values start from a real 0N instead of raw ADC offset.
  delay(300);
  calibrateFSRZero();

  lastTime = millis();
}

void loop() {
  unsigned long currentTime = millis();
  float dt = (currentTime - lastTime) / 1000.0;
  if (dt <= 0 || dt > 0.5) dt = 0.02;
  lastTime = currentTime;

  float ax1, ay1, az1, gx1, gy1, gz1;
  float ax2, ay2, az2, gx2, gy2, gz2;
  bool mpu1Ok = readMPUAccelGyro(MPU_THIGH_ADDR, ax1, ay1, az1, gx1, gy1, gz1);
  bool mpu2Ok = readMPUAccelGyro(MPU_SHANK_ADDR, ax2, ay2, az2, gx2, gy2, gz2);

  float kneeAngle = 0, kneeSpeed = 0;
  if (mpu1Ok && mpu2Ok) {
    float accelPitch1 = atan2(ay1, sqrt(ax1 * ax1 + az1 * az1)) * 180.0 / PI;
    pitch_thigh = ALPHA * (pitch_thigh + gx1 * dt) + (1.0 - ALPHA) * accelPitch1;

    float accelPitch2 = atan2(ay2, sqrt(ax2 * ax2 + az2 * az2)) * 180.0 / PI;
    pitch_shank = ALPHA * (pitch_shank + gx2 * dt) + (1.0 - ALPHA) * accelPitch2;

    kneeAngle = fabs(pitch_thigh - pitch_shank);
    kneeSpeed = fabs(gx1 - gx2);
  }

  // Read + smooth FSR channels, subtract zero-load calibration offset,
  // clamp negative noise to 0, and map to an approximate 0-100N scale.
  int smooth1 = smoothedRead(PIN_FSR_1, fsr1Buf);
  int smooth2 = smoothedRead(PIN_FSR_2, fsr2Buf);
  fsrBufIdx = (fsrBufIdx + 1) % FSR_SMOOTH_N;

  int adj1 = max(0, smooth1 - fsrZero1);
  int adj2 = max(0, smooth2 - fsrZero2);
  int newtons1 = map(adj1, 0, 4095 - fsrZero1, 0, 100);
  int newtons2 = map(adj2, 0, 4095 - fsrZero2, 0, 100);
  newtons1 = constrain(newtons1, 0, 100);
  newtons2 = constrain(newtons2, 0, 100);

  StaticJsonDocument<256> doc;
  doc["type"] = "leg_data";
  doc["side"] = LEG_SIDE;
  doc["timestamp"] = currentTime;
  doc["sensors_ok"] = (mpu1Ok && mpu2Ok);
  doc["knee_angle"] = round(kneeAngle * 10) / 10.0;
  doc["angular_velocity"] = round(kneeSpeed * 10) / 10.0;
  JsonArray fsr = doc.createNestedArray("fsr");
  fsr.add(newtons1); // Medial (1st Metatarsal)
  fsr.add(newtons2); // Lateral (5th Metatarsal)

  serializeJson(doc, Serial);
  Serial.println();

  delay(20); // ~50 Hz streaming rate
}
