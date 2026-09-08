/**
 * Dual-Leg Hardware Streamer Module (WebSerial + Bio-Simulator)
 * Connects TWO separate ESP32 boards over TWO separate USB serial ports --
 * one board per leg (2 MPU6050 IMUs + 2 FSR sensors each). Each port is
 * opened and read independently, then merged into a single live state.
 *
 * Falls back to a bio-simulator for any leg that isn't connected to real
 * hardware, so the app is still usable/demo-able without physical sensors.
 */

window.OAHardwareStreamer = {
  // Per-leg WebSerial connection state
  ports: { left: null, right: null },
  readers: { left: null, right: null },
  connected: { left: false, right: false },

  // Per-leg simulation state (runs only while that leg isn't hardware-connected)
  simIntervals: { left: null, right: null },
  simMode: { left: 'gait', right: 'gait' },

  listeners: [],

  // Current Live Sensor Data State
  // fsr = [medial (1st metatarsal), lateral (5th metatarsal)] in Newtons
  latestData: {
    timestamp: 0,
    left_leg: { knee_angle: 0, angular_velocity: 0, fsr: [0, 0], source: 'none' },
    right_leg: { knee_angle: 0, angular_velocity: 0, fsr: [0, 0], source: 'none' }
  },

  init: function() {
    console.log("Hardware Streamer initialized (dual USB-port mode).");
  },

  subscribe: function(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  },

  notify: function() {
    this.latestData.timestamp = Date.now();
    this.listeners.forEach(fn => fn(this.latestData));
  },

  isLegConnected: function(side) {
    return !!this.connected[side];
  },

  // ---------------------------------------------------------------------
  // Connect ONE leg's ESP32 over its own USB serial port. Call this twice
  // (once with 'left', once with 'right') to wire up both boards -- each
  // call opens its own native browser "select a serial port" picker.
  // ---------------------------------------------------------------------
  connectLeg: async function(side) {
    if (side !== 'left' && side !== 'right') {
      console.error("connectLeg: side must be 'left' or 'right'");
      return false;
    }
    if (!('serial' in navigator)) {
      alert("WebSerial API is not supported in this browser. Please use Chrome/Edge/Chromium, or use the Bio-Simulator instead.");
      return false;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      this.ports[side] = port;
      this.connected[side] = true;
      this.stopSimulation(side); // real hardware takes over for this leg

      this.readSerialLoop(side);
      this.updateConnectionUI(side, true);
      return true;
    } catch (err) {
      console.error(`Error connecting ${side} leg ESP32:`, err);
      if (err.name !== 'NotFoundError') { // user just cancelled the picker
        alert(`Failed to connect ${side} leg ESP32: ` + err.message);
      }
      return false;
    }
  },

  readSerialLoop: async function(side) {
    const port = this.ports[side];
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.readers[side] = reader;

    let buffer = "";
    while (this.connected[side]) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) continue;
          try {
            const json = JSON.parse(trimmed);
            if (json.type === "leg_data") {
              this.applyLegData(side, json);
            }
          } catch (e) {
            console.warn(`Malformed JSON line from ${side} leg ESP32:`, trimmed);
          }
        }
      } catch (err) {
        console.error(`Serial read error (${side} leg):`, err);
        break;
      }
    }
  },

  applyLegData: function(side, json) {
    const legKey = side === 'left' ? 'left_leg' : 'right_leg';
    const fsr = Array.isArray(json.fsr) && json.fsr.length >= 2 ? json.fsr : [0, 0];

    this.latestData[legKey] = {
      knee_angle: typeof json.knee_angle === 'number' ? json.knee_angle : 0,
      angular_velocity: typeof json.angular_velocity === 'number' ? json.angular_velocity : 0,
      fsr: [fsr[0] || 0, fsr[1] || 0],
      source: 'hardware',
      sensorsOk: json.sensors_ok !== false
    };
    this.notify();
  },

  disconnectLeg: async function(side) {
    this.connected[side] = false;
    const reader = this.readers[side];
    if (reader) {
      try { await reader.cancel(); } catch (e) { /* ignore */ }
      this.readers[side] = null;
    }
    const port = this.ports[side];
    if (port) {
      try { await port.close(); } catch (e) { /* ignore */ }
      this.ports[side] = null;
    }
    this.updateConnectionUI(side, false);
    // Resume simulator for this leg so the UI keeps showing something sensible
    this.startSimulation(this.simMode[side], side);
  },

  updateConnectionUI: function(side, isConnected) {
    const badge = document.getElementById(`legStatusBadge_${side}`);
    if (badge) {
      badge.textContent = isConnected ? "LIVE (USB)" : "SIMULATED";
      badge.className = isConnected
        ? "px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300"
        : "px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-500 border border-slate-300";
    }
    const btn = document.getElementById(`btnConnect_${side}`);
    if (btn) {
      btn.textContent = isConnected ? `Disconnect ${side === 'left' ? 'Left' : 'Right'} Leg` : `Connect ${side === 'left' ? 'Left' : 'Right'} Leg USB`;
      btn.onclick = isConnected
        ? () => OAHardwareStreamer.disconnectLeg(side)
        : () => OAHardwareStreamer.connectLeg(side);
    }
  },

  // ---------------------------------------------------------------------
  // Bio-Simulator (per leg). Only ever writes into a leg's data if that
  // leg does NOT currently have a real hardware connection, so plugging
  // in one real ESP32 won't get overwritten by simulated noise, while the
  // other (unconnected) leg keeps showing realistic demo data.
  // ---------------------------------------------------------------------
  startSimulation: function(mode = 'gait', side = 'both') {
    const sides = side === 'both' ? ['left', 'right'] : [side];
    sides.forEach(s => {
      this.simMode[s] = mode;
      if (this.connected[s]) return; // hardware owns this leg, don't simulate it
      if (this.simIntervals[s]) clearInterval(this.simIntervals[s]);

      let step = Math.random() * 10;
      this.simIntervals[s] = setInterval(() => {
        step += 0.1;
        const legKey = s === 'left' ? 'left_leg' : 'right_leg';
        const packet = this.generateSimSample(mode, step, s);
        this.latestData[legKey] = { ...packet, source: 'simulated' };
        this.notify();
      }, 40); // 25 Hz
    });
  },

  generateSimSample: function(mode, step, side) {
    const flip = side === 'right' ? Math.PI : 0; // right leg out of phase with left
    let angle = 10, vel = 5, fsr = [10, 8]; // [medial, lateral]

    switch (mode) {
      case 'sit_to_stand': {
        const sts = (Math.sin(step) + 1) / 2;
        angle = 15 + sts * 75;
        vel = Math.abs(Math.cos(step)) * 60;
        fsr = [20 + sts * 35, 15 + sts * 25];
        break;
      }
      case 'squat': {
        const squat = (Math.sin(step * 0.8) + 1) / 2;
        angle = 10 + squat * 95;
        vel = Math.abs(Math.cos(step * 0.8)) * 80;
        fsr = [25 + squat * 45, 18 + squat * 30];
        break;
      }
      case 'balance': {
        const isStance = side === 'left'; // left leg on ground, right lifted (demo)
        angle = isStance ? 12 + Math.sin(step * 4) * 2 : 45 + Math.sin(step * 2) * 5;
        vel = isStance ? 8 : 15;
        fsr = isStance ? [55 + Math.sin(step * 3) * 10, 40 + Math.cos(step * 3) * 8] : [2, 1];
        break;
      }
      case 'stairs': {
        const stair = (Math.sin(step * 1.5 + flip) + 1) / 2;
        angle = 10 + stair * 70;
        vel = Math.abs(Math.cos(step * 1.5 + flip)) * 95;
        fsr = [70 * (1 - stair), 45 * stair];
        break;
      }
      case 'rom': {
        const rom = (Math.sin(step * 0.5) + 1) / 2;
        angle = rom * 125;
        vel = 45;
        fsr = [12, 9];
        break;
      }
      case 'gait':
      default: {
        const gait = Math.sin(step * 2 + flip);
        angle = 15 + Math.max(0, gait) * 50;
        vel = Math.abs(gait) * 110;
        const strike = (gait + 1) / 2;
        fsr = [Math.max(5, 55 * strike), Math.max(5, 40 * strike)];
        break;
      }
    }

    return {
      knee_angle: Math.round(angle * 10) / 10,
      angular_velocity: Math.round(vel * 10) / 10,
      fsr: [Math.round(fsr[0]), Math.round(fsr[1])]
    };
  },

  stopSimulation: function(side = 'both') {
    const sides = side === 'both' ? ['left', 'right'] : [side];
    sides.forEach(s => {
      if (this.simIntervals[s]) {
        clearInterval(this.simIntervals[s]);
        this.simIntervals[s] = null;
      }
    });
  },

  setSimulationMode: function(mode) {
    this.startSimulation(mode, 'left');
    this.startSimulation(mode, 'right');
  }
};
