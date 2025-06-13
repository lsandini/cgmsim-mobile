interface GlucoseReading {
  id: string;
  patientId: string;
  timestamp: string; // ISO date
  glucoseValue: number; // mg/dL
  isPredicted: boolean;
  calculationTimestamp: string; // ISO date
}import * as SQLite from 'expo-sqlite';

interface PatientProfile {
  id: string;
  name: string;
  age: number;
  weight: number; // kg
  height: number; // cm  
  insulinSensitivityFactor: number; // mg/dL per unit
  carbRatio: number; // grams per unit
  basalRate: number; // units/hour
  targetGlucoseLow: number; // mg/dL
  targetGlucoseHigh: number; // mg/dL
  isPumpUser: boolean;
  createdAt: string; // ISO date
}

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

const DEFAULT_PATIENT: PatientProfile = {
  id: 'default-patient-001',
  name: 'Test Patient',
  age: 35,
  weight: 70,
  height: 170,
  insulinSensitivityFactor: 50,
  carbRatio: 15,
  basalRate: 1.0,
  targetGlucoseLow: 70,
  targetGlucoseHigh: 180,
  isPumpUser: false,
  createdAt: new Date().toISOString()
};

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  async initializeDatabase(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.db = await SQLite.openDatabaseAsync('cgmsim.db');
      
      // Create basic patients table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS patients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER NOT NULL,
          weight REAL NOT NULL,
          height REAL NOT NULL,
          insulin_sensitivity_factor REAL NOT NULL,
          carb_ratio REAL NOT NULL,
          basal_rate REAL NOT NULL,
          target_glucose_low INTEGER DEFAULT 70,
          target_glucose_high INTEGER DEFAULT 180,
          is_pump_user BOOLEAN DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);

      // Create treatments table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS treatments (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('meal', 'rapid_insulin', 'long_insulin', 'exercise', 'correction')),
          carbohydrates REAL,
          rapid_insulin REAL,
          long_insulin REAL,
          exercise_type TEXT CHECK (exercise_type IN ('light', 'moderate', 'intense')),
          exercise_duration INTEGER,
          notes TEXT,
          FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
        );
      `);

      // Create glucose readings table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS glucose_readings (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          glucose_value REAL NOT NULL CHECK (glucose_value >= 20 AND glucose_value <= 600),
          is_predicted BOOLEAN DEFAULT 1,
          calculation_timestamp TEXT NOT NULL,
          FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
        );
      `);

      // Create indexes for better performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_glucose_patient_time ON glucose_readings (patient_id, timestamp);
      `);
      
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_treatments_patient_time ON treatments (patient_id, timestamp);
      `);

      // Insert default patient if doesn't exist
      const existing = await this.getPatient(DEFAULT_PATIENT.id);
      if (!existing) {
        await this.savePatient(DEFAULT_PATIENT);
      }

      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async getPatient(id: string): Promise<PatientProfile | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync(`
        SELECT * FROM patients WHERE id = ?
      `, [id]);

      if (!result) return null;

      const row = result as any;
      return {
        id: row.id,
        name: row.name,
        age: row.age,
        weight: row.weight,
        height: row.height,
        insulinSensitivityFactor: row.insulin_sensitivity_factor,
        carbRatio: row.carb_ratio,
        basalRate: row.basal_rate,
        targetGlucoseLow: row.target_glucose_low,
        targetGlucoseHigh: row.target_glucose_high,
        isPumpUser: row.is_pump_user === 1,
        createdAt: row.created_at
      };
    } catch (error) {
      console.error('Error getting patient:', error);
      return null;
    }
  }

  async savePatient(patient: PatientProfile): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(`
        INSERT OR REPLACE INTO patients (
          id, name, age, weight, height, insulin_sensitivity_factor,
          carb_ratio, basal_rate, target_glucose_low, target_glucose_high,
          is_pump_user, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        patient.id,
        patient.name,
        patient.age,
        patient.weight,
        patient.height,
        patient.insulinSensitivityFactor,
        patient.carbRatio,
        patient.basalRate,
        patient.targetGlucoseLow,
        patient.targetGlucoseHigh,
        patient.isPumpUser ? 1 : 0,
        patient.createdAt
      ]);
      
      console.log('Patient saved successfully');
    } catch (error) {
      console.error('Error saving patient:', error);
      throw error;
    }
  }

  async saveTreatment(treatment: Treatment): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(`
        INSERT INTO treatments (
          id, patient_id, timestamp, type, carbohydrates,
          rapid_insulin, long_insulin, exercise_type,
          exercise_duration, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        treatment.id,
        treatment.patientId,
        treatment.timestamp,
        treatment.type,
        treatment.carbohydrates || null,
        treatment.rapidInsulin || null,
        treatment.longInsulin || null,
        treatment.exerciseType || null,
        treatment.exerciseDuration || null,
        treatment.notes || null
      ]);
      
      console.log('Treatment saved successfully:', treatment.type);
    } catch (error) {
      console.error('Error saving treatment:', error);
      throw error;
    }
  }

  async getTreatments(patientId: string, limit: number = 10, hoursBack: number = 6): Promise<Treatment[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Only get treatments from the last X hours
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      
      const results = await this.db.getAllAsync(`
        SELECT * FROM treatments 
        WHERE patient_id = ? AND timestamp >= ?
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [patientId, cutoffTime, limit]);

      console.log(`Loading treatments since ${new Date(cutoffTime).toLocaleString()} (${hoursBack}h ago)`);

      return results.map((row: any) => ({
        id: row.id,
        patientId: row.patient_id,
        timestamp: row.timestamp,
        type: row.type,
        carbohydrates: row.carbohydrates,
        rapidInsulin: row.rapid_insulin,
        longInsulin: row.long_insulin,
        exerciseType: row.exercise_type,
        exerciseDuration: row.exercise_duration,
        notes: row.notes
      }));
    } catch (error) {
      console.error('Error getting treatments:', error);
      return [];
    }
  }

  async saveGlucoseReadings(readings: GlucoseReading[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Clear existing predicted readings for this patient
      if (readings.length > 0) {
        await this.db.runAsync(
          'DELETE FROM glucose_readings WHERE patient_id = ? AND is_predicted = 1',
          [readings[0].patientId]
        );
      }

      // Insert new readings
      for (const reading of readings) {
        await this.db.runAsync(`
          INSERT INTO glucose_readings (
            id, patient_id, timestamp, glucose_value,
            is_predicted, calculation_timestamp
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          reading.id,
          reading.patientId,
          reading.timestamp,
          reading.glucoseValue,
          reading.isPredicted ? 1 : 0,
          reading.calculationTimestamp
        ]);
      }
      
      console.log(`Saved ${readings.length} glucose readings`);
    } catch (error) {
      console.error('Error saving glucose readings:', error);
      throw error;
    }
  }

  async getGlucoseReadings(patientId: string, limit: number = 288): Promise<GlucoseReading[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const results = await this.db.getAllAsync(`
        SELECT * FROM glucose_readings 
        WHERE patient_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [patientId, limit]);

      return results.map((row: any) => ({
        id: row.id,
        patientId: row.patient_id,
        timestamp: row.timestamp,
        glucoseValue: row.glucose_value,
        isPredicted: row.is_predicted === 1,
        calculationTimestamp: row.calculation_timestamp
      }));
    } catch (error) {
      console.error('Error getting glucose readings:', error);
      return [];
    }
  }

  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export const databaseService = new DatabaseService();
export { DEFAULT_PATIENT };
export type { PatientProfile, Treatment, GlucoseReading };