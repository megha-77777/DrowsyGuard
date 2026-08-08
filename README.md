# Drowsy Guard 🚗🛡️

**Zero Hardware. One Phone. Full Autonomy.**

Drowsy Guard is a **smartphone-only autonomous driver safety system** designed to detect, predict, and respond to driver drowsiness and fatigue using sensors already available on a standard smartphone.

No wearables. No dashboard cameras. No OBD-II dongles. No custom sensors.

Just **one Android smartphone + an existing phone mount**.

Drowsy Guard combines on-device computer vision, voice analysis, motion sensing, GPS, personalized risk modeling, and autonomous AI agents to provide safety **before, during, and after a potentially dangerous driving event**.

## ✨ What It Does

* 👁️ **Detects drowsiness** using eye closure, yawning, and head-pose analysis
* 🎙️ **Analyzes voice** for energy, pitch, and deviations from the driver's baseline
* 📱 **Uses the phone as an IMU** to identify motion patterns associated with fatigue
* 🧠 **Predicts fatigue risk before a trip** using sleep duration, trip length, time of day, and historical data
* ⚠️ **Calculates an explainable Composite Risk Index** continuously during driving
* 🔊 **Escalates alerts autonomously** from warnings to emergency response
* 📍 **Suggests nearby rest stops** when fatigue risk increases
* 🆘 **Sends emergency SMS with live GPS location** to a trusted contact
* 🌙 **Automatically adapts to low-light conditions**
* 🔐 **Keeps sensitive data on-device**, including a local encrypted pre-crash signal buffer
* 👥 **Supports optional Guardian Mode** for trusted-contact trip status
* 🚗 **Enables peer-to-peer hazard consensus** between nearby Drowsy Guard devices
* 📊 **Learns across trips** to identify recurring fatigue patterns and improve prevention

## 🤖 Autonomous AI Agents

Drowsy Guard is built around three autonomous agents operating above a deterministic safety core:

### Driver Copilot Agent

Operates before and during the trip.

* Forecasts fatigue risk before departure
* Plans recommended breaks
* Monitors real-time risk trends
* Provides proactive coaching
* Executes the emergency-response workflow

### Responder Triage Agent

Operates during an emergency.

* Assembles relevant pre-crash context
* Combines risk trends, location, weather, and nearby emergency resources
* Produces an actionable emergency brief

### Fleet Analyst Agent

Operates after trips and across multiple journeys.

* Identifies recurring risk patterns
* Analyzes aggregated trip behavior
* Uses hazard-consensus information for broader risk mapping
* Generates evidence-backed safety reports

## 🛡️ Deterministic Safety Core

AI agents do not replace the core safety mechanisms.

The underlying detection and escalation pipeline remains deterministic and explainable:

**Sensors → Signal Processing → Risk Fusion → Risk Tier → Alert/Response**

The system continuously evaluates:

* Eye closure
* Yawning
* Head orientation
* Voice characteristics
* Phone motion
* Time of day
* Self-reported sleep duration
* Historical driver risk

A unified escalation pipeline provides:

**5-second warning → 10-second emergency response**

The emergency response can simultaneously trigger:

1. Loud looping alarm
2. Spoken warning in the driver's selected language
3. Nearby rest-stop recommendations
4. Emergency SMS containing GPS location

## 🔒 Privacy by Design

Drowsy Guard is designed around **local-first processing**.

The pre-crash black box stores **derived numerical signals rather than raw camera footage**. The rolling buffer is automatically discarded when no crash occurs.

> **Your phone detects the risk. Your phone keeps the evidence.**

No continuous video upload is required.

## 🌍 Why Zero Hardware Matters

Traditional driver-monitoring systems often depend on dedicated cameras, vehicle interfaces, or additional sensors.

Drowsy Guard takes a different approach:

> **The hardware is already in the driver's pocket.**

By using the smartphone's existing camera, microphone, IMU, and GPS, the system can be deployed without vehicle modification or specialized hardware.

This makes Drowsy Guard suitable for **ordinary drivers, commercial fleets, emerging markets, and large-scale deployment**.

## 🧩 Core Architecture

```text
                 ┌──────────────────────┐
                 │    Smartphone        │
                 │                      │
                 │ Camera ──┐           │
                 │ Mic ─────┤           │
                 │ IMU ─────┤           │
                 │ GPS ─────┘           │
                 └──────────┬───────────┘
                            │
                    Signal Processing
                            │
                            ▼
                  ┌───────────────────┐
                  │  Risk Fusion Core │
                  │                   │
                  │ Vision + Voice    │
                  │ Motion + Context  │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Composite Risk    │
                  │      Index         │
                  └─────────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        Driver Copilot  Responder     Fleet Analyst
           Agent         Triage Agent      Agent
              │             │             │
              ▼             ▼             ▼
        Alerts / Rest    Emergency      Reports /
        Recommendations   Response       Prevention
```

## 🎯 Vision

Drowsy Guard aims to move driver-safety technology from **hardware-dependent monitoring** toward **accessible, autonomous, smartphone-based prevention**.

**One phone. Zero custom hardware. Continuous intelligence. Autonomous response.**

---

**Drowsy Guard — Detect earlier. Act faster. Drive safer.**
