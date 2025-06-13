import { PatientProfile, Treatment } from './DatabaseService';

// Use perlin-noise instead of simplex-noise
const perlin = require('perlin-noise');

// Import the actual cgmsim-lib
// Note: We'll need to check the exact API from the package documentation
// For now, I'll create interfaces based on typical simulation libraries

interface CGMSimPatient {
  age: number;
  weight: number;
  height: number;
  insulinSensitivityFactor: number;
  carbRatio: number;
  basalRate: number;
}

interface CGMSimTreatment {
  timestamp: Date;
  type: 'meal' | 'rapid_insulin' | 'long_insulin' | 'exercise' | 'correction';
  carbohydrates?: number;
  insulin?: number;
  exerciseType?: 'light' | 'moderate' | 'intense';
  exerciseDuration?: number;
}

interface GlucoseReading {
  id: string;
  patientId: string;
  timestamp: string;
  glucoseValue: number;
  isPredicted: boolean;
  calculationTimestamp: string;
}

interface CGMSimOptions {
  patient: CGMSimPatient;
  treatments: CGMSimTreatment[];
  startTime: Date;
  durationHours: number;
  intervalMinutes: number;
  baselineGlucose: number;
}

// Mock implementation until we can test with the real cgmsim-lib API
// This will be replaced with actual cgmsim-lib calls
const simulateGlucoseProfile = async (options: CGMSimOptions): Promise<Array<{ timestamp: Date; glucoseValue: number }>> => {
  const { patient, treatments, startTime, durationHours, intervalMinutes, baselineGlucose } = options;
  
  // Generate time intervals (288 points for 24 hours at 5-minute intervals)
  const intervals: Date[] = [];
  for (let i = 0; i <= (durationHours * 60) / intervalMinutes; i++) {
    const time = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
    intervals.push(time);
  }
  
  let currentGlucose = baselineGlucose;
  const results: Array<{ timestamp: Date; glucoseValue: number }> = [];
  
  for (let i = 0; i < intervals.length; i++) {
    const currentTime = intervals[i];
    let glucoseChange = 0;
    
    // Apply endogenous glucose production (liver) - approximately 2mg/dL per hour
    glucoseChange += (2.0 / 12); // Per 5-minute interval
    
    // Process treatments affecting this time point
    treatments.forEach(treatment => {
      const timeSinceTreatment = (currentTime.getTime() - treatment.timestamp.getTime()) / (1000 * 60); // minutes
      
      if (timeSinceTreatment >= 0) {
        switch (treatment.type) {
          case 'meal':
            if (treatment.carbohydrates && timeSinceTreatment <= 240) { // 4 hours
              const carbEffect = calculateCarbEffect(treatment.carbohydrates, timeSinceTreatment, patient);
              glucoseChange += carbEffect;
              
              // Log significant carb effects
              if (carbEffect > 0.5 && i % 6 === 0) { // Every 30 minutes
                console.log(`  Carb effect at +${Math.round(timeSinceTreatment)}min: +${Math.round(carbEffect * 10) / 10} mg/dL (${treatment.carbohydrates}g)`);
              }
            }
            break;
            
          case 'rapid_insulin':
          case 'correction':
            if (treatment.insulin && timeSinceTreatment <= 300) { // 5 hours
              const insulinEffect = calculateInsulinEffect(treatment.insulin, timeSinceTreatment, patient, 'rapid');
              glucoseChange -= insulinEffect;
              
              // Log significant insulin effects
              if (insulinEffect > 0.5 && i % 6 === 0) { // Every 30 minutes
                console.log(`  Insulin effect at +${Math.round(timeSinceTreatment)}min: -${Math.round(insulinEffect * 10) / 10} mg/dL (${treatment.insulin}U)`);
              }
            }
            break;
            
          case 'long_insulin':
            if (treatment.insulin && timeSinceTreatment <= 1440) { // 24 hours
              const insulinEffect = calculateInsulinEffect(treatment.insulin, timeSinceTreatment, patient, 'long');
              glucoseChange -= insulinEffect;
            }
            break;
            
          case 'exercise':
            if (treatment.exerciseDuration && timeSinceTreatment <= treatment.exerciseDuration + 180) {
              const exerciseEffect = calculateExerciseEffect(treatment.exerciseType || 'moderate', treatment.exerciseDuration, timeSinceTreatment);
              glucoseChange -= exerciseEffect;
              
              // Log exercise effects
              if (exerciseEffect > 0.1 && i % 6 === 0) { // Every 30 minutes
                console.log(`  Exercise effect at +${Math.round(timeSinceTreatment)}min: -${Math.round(exerciseEffect * 10) / 10} mg/dL`);
              }
            }
            break;
        }
      }
    });
    
    currentGlucose = Math.max(40, Math.min(400, currentGlucose + glucoseChange));
    results.push({
      timestamp: currentTime,
      glucoseValue: currentGlucose
    });
  }
  
  return results;
};

// Simplified carbohydrate absorption model (bilinear)
const calculateCarbEffect = (carbs: number, timeSinceEating: number, patient: CGMSimPatient): number => {
  const peakTime = 60; // 60 minutes to peak
  const duration = 240; // 4 hours total duration
  
  if (timeSinceEating > duration) return 0;
  
  // Bilinear absorption model
  let absorptionRate: number;
  if (timeSinceEating <= peakTime) {
    absorptionRate = timeSinceEating / peakTime;
  } else {
    absorptionRate = (duration - timeSinceEating) / (duration - peakTime);
  }
  
  // Convert carbs to glucose effect using carb ratio and ISF
  const maxEffect = (carbs / patient.carbRatio) * patient.insulinSensitivityFactor;
  return maxEffect * absorptionRate * 0.05; // Per 5-minute interval
};

// Insulin effect model (exponential decay)
const calculateInsulinEffect = (insulin: number, timeSinceInjection: number, patient: CGMSimPatient, type: 'rapid' | 'long'): number => {
  if (type === 'rapid') {
    const duration = 300; // 5 hours total
    if (timeSinceInjection > duration) return 0;
    
    // Exponential decay model for rapid insulin (peak around 55 minutes)
    const t = timeSinceInjection / 60; // Convert to hours
    const activity = Math.exp(-0.0173 * t) * (1 - Math.exp(-0.0173 * t));
    const maxEffect = insulin * patient.insulinSensitivityFactor;
    
    return maxEffect * activity * 0.05; // Per 5-minute interval
  } else {
    // Long-acting insulin - simplified constant release over 24 hours
    const duration = 1440; // 24 hours
    if (timeSinceInjection > duration) return 0;
    
    const constantEffect = (insulin * patient.insulinSensitivityFactor) / (duration / 5); // Per 5-minute interval
    return constantEffect;
  }
};

// Exercise effect model
const calculateExerciseEffect = (exerciseType: string, duration: number, timeSinceStart: number): number => {
  if (timeSinceStart > duration + 180) return 0; // Effect lasts 3 hours after exercise
  
  let intensity: number;
  switch (exerciseType) {
    case 'light':
      intensity = 0.5;
      break;
    case 'moderate':
      intensity = 1.0;
      break;
    case 'intense':
      intensity = 2.0;
      break;
    default:
      intensity = 1.0;
  }
  
  if (timeSinceStart <= duration) {
    // During exercise
    return intensity * 0.5; // mg/dL per 5min for moderate exercise
  } else {
    // After exercise - gradual decline
    const timeAfter = timeSinceStart - duration;
    const residualEffect = Math.exp(-timeAfter / 120); // 2-hour decay
    return intensity * 0.2 * residualEffect;
  }
};

export class SimulationService {
  
  // Generate weekly Perlin noise array for biological variability using your original method
  static generateWeeklyNoise(patientId: string, weekStart: string, amplitude: number = 0.3, octaves: number = 1, persistence: number = 0.3): number[] {
    console.log('Creating perlin array for patient:', patientId);
    
    const noiseArray: number[] = [];
    const time = new Date(weekStart).getTime();
    
    let noise: number[];
    if (amplitude === 0 || octaves === 0 || persistence === 0) {
      console.log("Parameters are zero. Creating an array of zeros.");
      noise = new Array(2016).fill(0);
    } else {
      console.log("Generating perlin noise with parameters:", amplitude, octaves, persistence);
      noise = perlin.generatePerlinNoise(2016, 1, {
        amplitude: amplitude,
        octaveCount: octaves,
        persistence: persistence,
      });
    }
    
    const map = noise.map((i: any) => Number(i));
    const totalNoise = map.reduce((a: number, b: number) => a + b, 0);
    const meanNoise = totalNoise / map.length - 0.5 || 0;
    console.log("Noise mean (should be almost 0):", meanNoise);
    
    for (let i = 0; i < noise.length; i++) {
      let noiseValue: number;
      if (amplitude === 0 || octaves === 0 || persistence === 0 || isNaN(noise[i])) {
        noiseValue = 0;
      } else {
        noiseValue = noise[i] / 10 - 0.05; // Your original scaling
      }
      noiseArray.push(noiseValue);
    }
    
    return noiseArray;
  }
  
  // Main simulation function - calculates 24h glucose curve
  static async calculateGlucoseCurve(
    patient: PatientProfile, 
    treatments: Treatment[]
  ): Promise<GlucoseReading[]> {
    
    try {
      console.log(`Running simulation for ${treatments.length} treatments`);
      
      // Get current week's noise for biological variability
      const weekStart = this.getWeekStart(new Date());
      const noiseArray = this.generateWeeklyNoise(patient.id, weekStart);
      
      // Convert treatments to simulation format
      const cgmSimTreatments: CGMSimTreatment[] = treatments.map(t => ({
        timestamp: new Date(t.timestamp),
        type: t.type,
        carbohydrates: t.carbohydrates || 0,
        insulin: (t.rapidInsulin || 0) + (t.longInsulin || 0),
        exerciseType: t.exerciseType,
        exerciseDuration: t.exerciseDuration || 0
      }));
      
      // Run simulation for next 24 hours
      const simulationResult = await simulateGlucoseProfile({
        patient: {
          age: patient.age,
          weight: patient.weight,
          height: patient.height,
          insulinSensitivityFactor: patient.insulinSensitivityFactor,
          carbRatio: patient.carbRatio,
          basalRate: patient.basalRate
        },
        treatments: cgmSimTreatments,
        startTime: new Date(),
        durationHours: 24,
        intervalMinutes: 5,
        baselineGlucose: 120 // mg/dL starting point
      });
      
      // Apply biological noise and convert to GlucoseReading format
      const glucoseReadings: GlucoseReading[] = simulationResult.map((point, index) => {
        const noiseIndex = index % noiseArray.length;
        const noiseValue = noiseArray[noiseIndex];
        // Apply noise as additive rather than multiplicative to match your original method
        const noisyGlucose = point.glucoseValue + (point.glucoseValue * noiseValue);
        
        return {
          id: `${patient.id}_${point.timestamp.toISOString()}`,
          patientId: patient.id,
          timestamp: point.timestamp.toISOString(),
          glucoseValue: Math.max(40, Math.min(400, noisyGlucose)),
          isPredicted: true,
          calculationTimestamp: new Date().toISOString()
        };
      });
      
      console.log(`Generated ${glucoseReadings.length} glucose points`);
      
      // Log complete glucose array for debugging
      console.log('\n=== COMPLETE GLUCOSE ARRAY (288 points) ===');
      console.log('Index\tTime\t\tGlucose\tNoise\tDelta');
      
      glucoseReadings.forEach((reading, index) => {
        const time = new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const glucose = Math.round(reading.glucoseValue * 10) / 10; // Round to 1 decimal
        const noiseValue = Math.round(noiseArray[index % noiseArray.length] * 1000) / 1000; // Round to 3 decimals
        const prevGlucose = index > 0 ? glucoseReadings[index - 1].glucoseValue : reading.glucoseValue;
        const delta = Math.round((glucose - prevGlucose) * 10) / 10;
        const deltaStr = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0';
        
        // Log every 12th point (hourly) + first 24 points (first 2 hours in detail)
        if (index < 24 || index % 12 === 0) {
          console.log(`${index.toString().padStart(3)}\t${time}\t${glucose.toString().padStart(5)} mg/dL\t${noiseValue.toString().padStart(6)}\t${deltaStr}`);
        }
      });
      
      // Log raw array values for copy/paste
      console.log('\n=== RAW GLUCOSE VALUES ARRAY ===');
      const rawValues = glucoseReadings.map(r => Math.round(r.glucoseValue * 10) / 10);
      console.log('Glucose values (mg/dL):');
      
      // Split into chunks of 12 for readability (1 hour per line)
      for (let i = 0; i < rawValues.length; i += 12) {
        const chunk = rawValues.slice(i, i + 12);
        const timeLabel = new Date(glucoseReadings[i].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        console.log(`${timeLabel}: [${chunk.join(', ')}]`);
      }
      
      // Log summary statistics
      const minGlucose = Math.min(...rawValues);
      const maxGlucose = Math.max(...rawValues);
      const avgGlucose = Math.round(rawValues.reduce((a, b) => a + b, 0) / rawValues.length * 10) / 10;
      
      console.log('\n=== GLUCOSE STATISTICS ===');
      console.log(`Min: ${minGlucose} mg/dL`);
      console.log(`Max: ${maxGlucose} mg/dL`);
      console.log(`Average: ${avgGlucose} mg/dL`);
      console.log(`Range: ${maxGlucose - minGlucose} mg/dL`);
      console.log(`Total points: ${rawValues.length}`);
      console.log(`Duration: ${rawValues.length * 5} minutes (${rawValues.length * 5 / 60} hours)`);
      console.log('=========================================\n');
      
      return glucoseReadings;
      
    } catch (error) {
      console.error('Simulation error:', error);
      
      // Fallback: generate basic glucose curve
      return this.generateFallbackGlucoseCurve(patient);
    }
  }
  
  // Fallback glucose curve if simulation fails
  private static generateFallbackGlucoseCurve(patient: PatientProfile): GlucoseReading[] {
    console.log('Using fallback glucose curve');
    
    const startTime = new Date();
    const weekStart = this.getWeekStart(startTime);
    const noiseArray = this.generateWeeklyNoise(patient.id, weekStart);
    
    const glucoseReadings: GlucoseReading[] = [];
    
    // Generate 288 points (24 hours * 12 points per hour)
    for (let i = 0; i < 288; i++) {
      const timestamp = new Date(startTime.getTime() + i * 5 * 60 * 1000);
      const hours = i * (5/60); // Convert 5-min intervals to hours
      
      // Simple sine wave with noise for fallback
      const baseGlucose = 120 + 30 * Math.sin((hours * 2 * Math.PI) / 24); // 24-hour cycle
      const noiseValue = noiseArray[i % noiseArray.length];
      const noisyGlucose = baseGlucose + (baseGlucose * noiseValue);
      
      glucoseReadings.push({
        id: `${patient.id}_${timestamp.toISOString()}`,
        patientId: patient.id,
        timestamp: timestamp.toISOString(),
        glucoseValue: Math.max(70, Math.min(200, noisyGlucose)),
        isPredicted: true,
        calculationTimestamp: new Date().toISOString()
      });
    }
    
    return glucoseReadings;
  }
  
  // Get current glucose value from curve
  static getCurrentGlucoseValue(glucoseReadings: GlucoseReading[]): number {
    const now = new Date();
    const currentReading = glucoseReadings.find(reading => {
      const readingTime = new Date(reading.timestamp);
      return Math.abs(readingTime.getTime() - now.getTime()) < 5 * 60 * 1000; // Within 5 minutes
    });
    
    return currentReading?.glucoseValue || 120;
  }
  
  // Calculate glucose trend arrow
  static calculateTrend(glucoseReadings: GlucoseReading[]): string {
    const now = new Date();
    const recent = glucoseReadings
      .filter(reading => {
        const readingTime = new Date(reading.timestamp);
        return readingTime <= now && readingTime.getTime() > now.getTime() - 15 * 60 * 1000; // Last 15 minutes
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (recent.length < 3) return '→';
    
    const latest = recent[recent.length - 1].glucoseValue;
    const previous = recent[0].glucoseValue;
    const rate = (latest - previous) / 15; // mg/dL per minute
    
    if (rate > 2) return '↗↗'; // Rapidly rising
    if (rate > 1) return '↗';   // Rising
    if (rate > -1) return '→';  // Stable
    if (rate > -2) return '↘';  // Falling
    return '↘↘';                // Rapidly falling
  }
  
  // Helper function to get week start
  private static getWeekStart(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Sunday start
    return d.toISOString().split('T')[0];
  }
}