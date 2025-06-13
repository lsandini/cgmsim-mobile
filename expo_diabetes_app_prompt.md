# Elaborate Expo Diabetes Simulation App Generation Prompt

You are an expert React Native/Expo developer. Create a complete, production-ready diabetes simulation mobile application using the exact specifications below. Generate ALL necessary files, components, and configurations for a fully functional app.

## CRITICAL REQUIREMENTS - MUST IMPLEMENT EXACTLY

### Technology Stack (MANDATORY)
```bash
# Initialize with these exact commands:
npx create-expo-app@latest DiabetesSimulator --template tabs --typescript
cd DiabetesSimulator
npx expo install expo-sqlite expo-notifications victory-native react-native-elements react-native-vector-icons expo-router cgmsim-lib simplex-noise
```

### Architecture Constraints (NON-NEGOTIABLE)
1. **Device-Only:** Zero cloud integration, no user accounts, no sync functionality
2. **Offline-First:** Must work 100% offline after initial app installation  
3. **24-Hour Prediction:** Calculate glucose curves for next 24 hours, reveal chronologically
4. **Recalculation Trigger:** Every treatment input must recalculate entire 24h curve
5. **TypeScript:** All files must be .tsx/.ts with proper typing
6. **Medical-Grade UI:** Professional appearance suitable for healthcare education

### Core Simulation Logic (ESSENTIAL)
```typescript
// MUST use this exact npm package
import { simulateGlucoseProfile, PatientProfile, Treatment } from 'cgmsim-lib';

// MUST implement this exact workflow
const handleTreatmentInput = async (treatment: Treatment) => {
  // 1. Save treatment to SQLite
  // 2. Fetch all patient treatments  
  // 3. Run cgmsim-lib simulation for 24 hours
  // 4. Store 288 glucose points (5-min intervals)
  // 5. Cancel all notifications, reschedule new ones
  // 6. Update UI to show only "past" values up to now
};
```

## Core Features

### Patient Profile Structure (EXACT INTERFACE)
```typescript
interface PatientProfile {
  id: string;
  name: string;
  age: number;
  weight: number; // kg
  height: number; // cm  
  insulinSensitivityFactor: number; // mg/dL per unit
  carbRatio: number; // grams per unit
  basalRate: number; // units/hour
  targetGlucoseLow: number; // mg/dL (default: 70)
  targetGlucoseHigh: number; // mg/dL (default: 180)
  isPumpUser: boolean;
  createdAt: string; // ISO date
}
```

### Treatment Input Structure (EXACT INTERFACE)
```typescript
interface Treatment {
  id: string;
  patientId: string;
  timestamp: string; // ISO date
  type: 'meal' | 'rapid_insulin' | 'long_insulin' | 'exercise' | 'correction';
  carbohydrates?: number; // grams
  rapidInsulin?: number; // units
  longInsulin?: number; // units
  exerciseType?: 'light' | 'moderate' | 'intense';
  exerciseDuration?: number; // minutes
  notes?: string;
}
```

### 3. Glucose Simulation Engine
- Import cgmsim-lib npm package (https://github.com/lsandini/cgmsim-lib)
- Generate 24-hour glucose curves (288 data points, 5-minute intervals)
- Apply Perlin noise for biological variability
- Recalculate entire curve on each treatment input
- Display only "historical" values up to current time

### 4. CGM Visualization
- Real-time glucose chart using Victory Native
- Target range highlighting (70-180 mg/dL default)
- Treatment markers on timeline
- Time-based filtering (3h, 6h, 12h, 24h views)
- Current glucose display with trend arrows

## Screen Structure

### Main Navigation (Tab-based)
1. **Home/Dashboard** - Current glucose + 24h chart
2. **Treatments** - Log meals, insulin, exercise
3. **Patient** - Virtual patient profile management
4. **History** - Past glucose data and patterns
5. **Settings** - App preferences and alerts

## MANDATORY SCREEN IMPLEMENTATIONS

### Screen 1: HomeScreen.tsx (PRIMARY SCREEN)
**Requirements:**
- Large glucose value display (current reading + trend arrow)
- Victory Native line chart showing 24h glucose data
- Target range shading (70-180 mg/dL in green zone)
- Time filter buttons: 3h, 6h, 12h, 24h
- Treatment markers on timeline (meals=triangle, insulin=circle, exercise=square)
- Quick action buttons: "Add Meal", "Add Insulin", "Add Exercise"
- Alert indicators for predicted highs/lows in next 4 hours

### Screen 2: TreatmentsScreen.tsx (INPUT SCREEN)  
**Requirements:**
- Modal-based treatment entry forms
- Carbohydrate input: NumberPicker (0-200g, step=5g)
- Insulin input: NumberPicker (0-50 units, step=0.5 units)
- Exercise input: Type dropdown + duration picker
- Time selector for retroactive entries (up to 6 hours back)
- Input validation with medical safety limits
- "Save Treatment" button that triggers full simulation recalculation

### Screen 3: PatientScreen.tsx (PROFILE MANAGEMENT)
**Requirements:**  
- Editable patient parameters with medical input validation
- ISF range: 15-100 mg/dL per unit
- Carb ratio range: 5-50 grams per unit  
- Basal rate range: 0.1-5.0 units/hour
- Age validation: 1-120 years
- Weight validation: 10-300 kg
- "Save Changes" triggers new patient profile and clears glucose history

### Screen 4: HistoryScreen.tsx (DATA REVIEW)
**Requirements:**
- Scrollable list of past treatments with timestamps
- Daily glucose statistics (average, time in range, highs/lows)
- Export functionality for glucose/treatment data
- Clear history option with confirmation dialog

## MANDATORY TECHNICAL IMPLEMENTATIONS

### Required Project Structure (GENERATE ALL FILES)
```
app/
├── (tabs)/
│   ├── index.tsx                 # HomeScreen
│   ├── treatments.tsx            # TreatmentsScreen  
│   ├── patient.tsx              # PatientScreen
│   └── history.tsx              # HistoryScreen
├── _layout.tsx                  # Root layout with tabs
└── +not-found.tsx              # 404 screen

components/
├── GlucoseChart.tsx            # Victory Native chart component
├── TreatmentInputModal.tsx     # Modal for treatment entry
├── PatientProfileCard.tsx      # Patient info display
├── GlucoseDisplay.tsx          # Large current glucose number
└── TreatmentMarker.tsx         # Chart annotations

services/
├── DatabaseService.ts          # SQLite operations
├── SimulationService.ts        # cgmsim-lib wrapper
├── NotificationService.ts      # Expo notifications
└── PerlinNoiseService.ts       # Weekly noise generation

hooks/
├── usePatient.ts              # Patient profile management
├── useGlucoseData.ts          # Glucose curve state
├── useTreatments.ts           # Treatment CRUD operations
└── useNotifications.ts        # Alert scheduling

types/
├── Patient.ts                 # PatientProfile interface
├── Treatment.ts               # Treatment interface
└── Glucose.ts                 # GlucoseReading interface

utils/
├── validation.ts              # Input validation functions
├── dateHelpers.ts             # Date/time utilities
└── glucoseCalculations.ts     # Helper math functions
```

### Critical SQLite Schema (IMPLEMENT EXACTLY)
```sql
-- Execute these exact CREATE TABLE statements
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age > 0 AND age <= 120),
  weight REAL NOT NULL CHECK (weight > 0 AND weight <= 300),
  height REAL NOT NULL CHECK (height > 0 AND height <= 250),
  insulin_sensitivity_factor REAL NOT NULL CHECK (insulin_sensitivity_factor >= 15 AND insulin_sensitivity_factor <= 100),
  carb_ratio REAL NOT NULL CHECK (carb_ratio >= 5 AND carb_ratio <= 50),
  basal_rate REAL NOT NULL CHECK (basal_rate >= 0.1 AND basal_rate <= 5.0),
  target_glucose_low INTEGER DEFAULT 70 CHECK (target_glucose_low >= 60 AND target_glucose_low <= 90),
  target_glucose_high INTEGER DEFAULT 180 CHECK (target_glucose_high >= 140 AND target_glucose_high <= 250),
  is_pump_user BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS treatments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('meal', 'rapid_insulin', 'long_insulin', 'exercise', 'correction')),
  carbohydrates REAL CHECK (carbohydrates >= 0 AND carbohydrates <= 200),
  rapid_insulin REAL CHECK (rapid_insulin >= 0 AND rapid_insulin <= 50),
  long_insulin REAL CHECK (long_insulin >= 0 AND long_insulin <= 100),
  exercise_type TEXT CHECK (exercise_type IN ('light', 'moderate', 'intense')),
  exercise_duration INTEGER CHECK (exercise_duration >= 0 AND exercise_duration <= 480),
  notes TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS glucose_readings (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  glucose_value REAL NOT NULL CHECK (glucose_value >= 20 AND glucose_value <= 600),
  is_predicted BOOLEAN DEFAULT 1,
  calculation_timestamp TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_glucose_patient_time ON glucose_readings (patient_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_time ON treatments (patient_id, timestamp);
```

### Notification System
- Schedule glucose alerts based on predicted values
- Configurable thresholds (low <70, high >250)
- Trend-based alerts (rapid rise/fall)
- Treatment reminders
- Handle iOS notification limits (64 max scheduled)

### Simulation Service Implementation (CRITICAL LOGIC)
```typescript
// services/SimulationService.ts - MUST implement this exact class
import { simulateGlucoseProfile } from 'cgmsim-lib';
import { createNoise1D } from 'simplex-noise';

export class SimulationService {
  
  // MUST generate weekly Perlin noise array
  static generateWeeklyNoise(patientId: string, weekStart: string): number[] {
    const noise1D = createNoise1D(() => `${patientId}_${weekStart}`);
    const noiseArray: number[] = [];
    
    for (let i = 0; i < 2016; i++) { // 7 days * 24 hours * 12 (5-min intervals)
      noiseArray.push(noise1D(i * 0.01) * 0.15); // ±15% variability
    }
    
    return noiseArray;
  }
  
  // MUST recalculate full 24h glucose curve
  static async calculateGlucoseCurve(
    patient: PatientProfile, 
    treatments: Treatment[]
  ): Promise<GlucoseReading[]> {
    
    // Get current week's noise
    const weekStart = getWeekStart(new Date());
    const noiseArray = this.generateWeeklyNoise(patient.id, weekStart);
    
    // Run cgmsim-lib simulation
    const simulationResult = simulateGlucoseProfile({
      patient: {
        age: patient.age,
        weight: patient.weight,
        height: patient.height,
        insulinSensitivityFactor: patient.insulinSensitivityFactor,
        carbRatio: patient.carbRatio,
        basalRate: patient.basalRate
      },
      treatments: treatments.map(t => ({
        timestamp: new Date(t.timestamp),
        type: t.type,
        carbohydrates: t.carbohydrates || 0,
        insulin: (t.rapidInsulin || 0) + (t.longInsulin || 0),
        exerciseType: t.exerciseType,
        exerciseDuration: t.exerciseDuration || 0
      })),
      startTime: new Date(),
      durationHours: 24,
      intervalMinutes: 5,
      baselineGlucose: 120 // mg/dL
    });
    
    // Apply biological noise
    const glucoseReadings: GlucoseReading[] = simulationResult.map((point, index) => ({
      id: `${patient.id}_${point.timestamp.toISOString()}`,
      patientId: patient.id,
      timestamp: point.timestamp.toISOString(),
      glucoseValue: Math.max(40, Math.min(400, point.glucoseValue * (1 + noiseArray[index % noiseArray.length]))),
      isPredicted: true,
      calculationTimestamp: new Date().toISOString()
    }));
    
    return glucoseReadings;
  }
}

// MUST implement this helper function
function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday start
  return d.toISOString().split('T')[0];
}
```

## UI/UX Requirements

### Design Principles
- Clean, medical-grade interface
- High contrast for glucose values
- Intuitive treatment input
- Clear visual hierarchy
- Accessibility compliance (screen readers, large text)

## SPECIFIC UI REQUIREMENTS (NON-NEGOTIABLE)

### Color Scheme (EXACT HEX VALUES)
```typescript
export const GLUCOSE_COLORS = {
  LOW: '#FF4444',           // Red for <70 mg/dL
  IN_RANGE: '#00C851',      // Green for 70-180 mg/dL  
  HIGH: '#FF8800',          // Orange for >180 mg/dL
  CRITICAL_HIGH: '#CC0000', // Dark red for >300 mg/dL
  TARGET_ZONE: '#E8F5E8',   // Light green background
  BACKGROUND: '#FFFFFF',    // White background
  TEXT_PRIMARY: '#212121',  // Dark gray text
  TEXT_SECONDARY: '#757575', // Medium gray text
  ACCENT: '#2196F3'         // Blue for buttons/accents
};
```

### GlucoseChart Component Requirements
```typescript
// components/GlucoseChart.tsx - MUST implement these exact features
interface GlucoseChartProps {
  glucoseData: GlucoseReading[];
  treatments: Treatment[];
  targetLow: number;
  targetHigh: number;
  timeRange: '3h' | '6h' | '12h' | '24h';
  currentTime: Date;
}

// MUST include these Victory Native components:
// - VictoryChart with responsive container
// - VictoryArea for target range shading (70-180 mg/dL)
// - VictoryLine for glucose curve with color-coded segments
// - VictoryScatter for treatment markers
// - VictoryAxis for time labels
// - VictoryTooltip for glucose value on tap
```

### Notification Requirements (IMPLEMENT EXACTLY)
```typescript
// services/NotificationService.ts - MUST handle these scenarios
interface NotificationConfig {
  lowGlucoseThreshold: 70;    // mg/dL
  highGlucoseThreshold: 250;  // mg/dL
  rapidRiseThreshold: 50;     // mg/dL in 30 min
  rapidFallThreshold: -50;    // mg/dL in 30 min
  maxScheduledNotifications: 60; // iOS limit consideration
}

// MUST schedule these notification types:
// 1. Low glucose alert (immediate)
// 2. High glucose alert (immediate)  
// 3. Rapid rise/fall trend alerts
// 4. Predicted low in next 30 minutes
// 5. Treatment reminder (if enabled)
```

## Dependencies to Include
```json
{
  "expo": "^52.0.0",
  "react-native": "0.76.x",
  "react-native-elements": "latest",
  "victory-native": "latest",
  "react-native-vector-icons": "latest",
  "expo-sqlite": "latest",
  "expo-notifications": "latest",
  "expo-router": "latest",
  "cgmsim-lib": "latest",
  "simplex-noise": "latest",
  "@types/react": "latest",
  "@types/react-native": "latest",
  "typescript": "latest"
}
```

## Simulation Features
- Use cgmsim-lib for accurate physiological modeling
- Generate weekly Perlin noise arrays for biological variability
- Support multiple insulin types (rapid-acting, long-acting)
- Model carbohydrate absorption curves
- Exercise impact on glucose
- Pump therapy simulation (basal rates, boluses)

## Safety Features
- Input validation for all treatment entries
- Reasonable limits on insulin doses
- Warning messages for extreme values
- Educational tooltips for diabetes management
- Clear indication this is simulation, not medical advice

## Performance Considerations
- Efficient chart rendering for 288 data points
- Lazy loading for historical data
- Optimized re-calculations
- Memory management for large datasets
- Smooth animations and transitions

## TESTING & VALIDATION REQUIREMENTS

### Default Test Patient (MUST CREATE ON FIRST LAUNCH)
```typescript
const DEFAULT_PATIENT: PatientProfile = {
  id: 'default-patient-001',
  name: 'Test Patient',
  age: 35,
  weight: 70, // kg
  height: 170, // cm
  insulinSensitivityFactor: 50, // mg/dL per unit
  carbRatio: 15, // grams per unit
  basalRate: 1.0, // units/hour
  targetGlucoseLow: 70, // mg/dL
  targetGlucoseHigh: 180, // mg/dL
  isPumpUser: false,
  createdAt: new Date().toISOString()
};
```

### Required Test Scenarios (MUST DEMONSTRATE)
1. **Meal Response:** Input 60g carbs, show glucose rise over 2 hours
2. **Insulin Effect:** Input 4 units rapid insulin, show glucose decline
3. **Exercise Impact:** Input 30min moderate exercise, show glucose drop
4. **Low Glucose Alert:** Trigger notification when predicted <70 mg/dL
5. **High Glucose Alert:** Trigger notification when predicted >250 mg/dL
6. **Time Revelation:** Glucose curve only shows values up to current time

### Input Validation Rules (ENFORCE STRICTLY)
```typescript
// MUST implement these exact validation functions
export const ValidationRules = {
  carbohydrates: { min: 0, max: 200, step: 1 },
  rapidInsulin: { min: 0, max: 50, step: 0.5 },
  longInsulin: { min: 0, max: 100, step: 1 },
  exerciseDuration: { min: 0, max: 480, step: 5 }, // 8 hours max
  age: { min: 1, max: 120 },
  weight: { min: 10, max: 300 },
  height: { min: 50, max: 250 },
  insulinSensitivityFactor: { min: 15, max: 100 },
  carbRatio: { min: 5, max: 50 },
  basalRate: { min: 0.1, max: 5.0, step: 0.1 }
};
```

## MODEL RECOMMENDATION

**For generating this app, I recommend using:**

**Claude Sonnet 4** (what you're using now) - Best choice because:
- Excellent at following detailed specifications
- Strong TypeScript/React Native knowledge
- Good at medical domain understanding
- Handles complex multi-file projects well
- Can implement all technical requirements accurately

**Alternative options:**
- **GPT-4** - Good alternative, slightly less detailed in medical contexts
- **Claude Opus 4** - Overkill for this project, more expensive
- **Avoid:** GPT-3.5, Claude Haiku (insufficient for this complexity)

**Recommended approach:**
1. Use this exact prompt with Claude Sonnet 4
2. Ask for specific files one at a time if output gets truncated
3. Test each component as it's generated
4. Iterate on UI/UX after core functionality works

Generate a complete, working Expo application with all files, proper error handling, TypeScript typing, and medical-grade quality standards. The app must run successfully with `npx expo start` after following the installation commands.