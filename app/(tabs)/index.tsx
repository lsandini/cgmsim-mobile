import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-elements';

import { databaseService, PatientProfile, Treatment, GlucoseReading, DEFAULT_PATIENT } from '../../services/DatabaseService';
import { SimulationService } from '../../services/SimulationService';
import { TreatmentInputModal } from '../../components/TreatmentInputModal';

export default function HomeScreen() {
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentGlucose, setCurrentGlucose] = useState(120);
  const [trend, setTrend] = useState('→');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<Treatment['type']>('meal');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      
      // Initialize database
      await databaseService.initializeDatabase();
      
      // Load default patient
      const loadedPatient = await databaseService.getPatient(DEFAULT_PATIENT.id);
      setPatient(loadedPatient);

      if (loadedPatient) {
        // Load recent treatments (only last 4 hours for simulation)
        const simulationTreatments = await databaseService.getTreatments(loadedPatient.id, 10, 4);
        
        // Load more treatments for display (last 12 hours)
        const displayTreatments = await databaseService.getTreatments(loadedPatient.id, 8, 12);
        setTreatments(displayTreatments);

        // Load or generate glucose readings
        let existingReadings = await databaseService.getGlucoseReadings(loadedPatient.id, 288);
        
        if (existingReadings.length === 0) {
          // No glucose data yet - run initial simulation
          console.log('No glucose data found, running initial simulation...');
          await runSimulation(loadedPatient, simulationTreatments);
        } else {
          // Load existing glucose data
          setGlucoseReadings(existingReadings);
          updateCurrentGlucose(existingReadings);
        }
      }
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      Alert.alert('Error', 'Failed to initialize the app');
    } finally {
      setLoading(false);
    }
  };

  // Run glucose simulation
  const runSimulation = async (patientData: PatientProfile, treatmentData: Treatment[]) => {
    try {
      console.log('\n🔬 STARTING GLUCOSE SIMULATION...');
      console.log(`Patient: ${patientData.name} (ISF: ${patientData.insulinSensitivityFactor}, CR: ${patientData.carbRatio})`);
      console.log(`Treatments to process: ${treatmentData.length}`);
      
      // Log treatments with better timestamp formatting
      treatmentData.forEach((treatment, index) => {
        const treatmentDate = new Date(treatment.timestamp);
        const now = new Date();
        const isToday = treatmentDate.toDateString() === now.toDateString();
        const timeStr = isToday 
          ? treatmentDate.toLocaleTimeString() 
          : treatmentDate.toLocaleString();
        const ageMinutes = Math.round((now.getTime() - treatmentDate.getTime()) / (1000 * 60));
        
        let details = '';
        switch (treatment.type) {
          case 'meal':
            details = `${treatment.carbohydrates}g carbs`;
            break;
          case 'rapid_insulin':
          case 'correction':
            details = `${treatment.rapidInsulin}U rapid insulin`;
            break;
          case 'long_insulin':
            details = `${treatment.longInsulin}U long insulin`;
            break;
          case 'exercise':
            details = `${treatment.exerciseDuration}min ${treatment.exerciseType} exercise`;
            break;
        }
        console.log(`  ${index + 1}. ${timeStr} (${ageMinutes}min ago) - ${treatment.type}: ${details}`);
      });
      
      // Calculate 24-hour glucose curve
      const newReadings = await SimulationService.calculateGlucoseCurve(patientData, treatmentData);
      
      // Save to database
      await databaseService.saveGlucoseReadings(newReadings);
      
      // Update state
      setGlucoseReadings(newReadings);
      updateCurrentGlucose(newReadings);
      
      console.log('✅ Simulation completed and saved to database');
    } catch (error) {
      console.error('❌ Simulation failed:', error);
      Alert.alert('Simulation Error', 'Failed to calculate glucose curve');
    }
  };

  // Update current glucose and trend from readings
  const updateCurrentGlucose = (readings: GlucoseReading[]) => {
    if (readings.length === 0) return;
    
    const current = SimulationService.getCurrentGlucoseValue(readings);
    const currentTrend = SimulationService.calculateTrend(readings);
    
    const roundedCurrent = Math.round(current);
    
    // Log glucose update
    console.log(`📊 GLUCOSE UPDATE: ${roundedCurrent} mg/dL ${currentTrend} (${new Date().toLocaleTimeString()})`);
    
    setCurrentGlucose(roundedCurrent);
    setTrend(currentTrend);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initializeApp();
    setRefreshing(false);
  };

  const handleTreatmentSave = async (treatmentData: Omit<Treatment, 'id' | 'patientId'>): Promise<boolean> => {
    if (!patient) return false;

    try {
      const treatment: Treatment = {
        ...treatmentData,
        id: `${patient.id}_treatment_${Date.now()}`,
        patientId: patient.id
      };

      // Save treatment to database
      await databaseService.saveTreatment(treatment);
      
      // Reload treatments for simulation (4 hours) and display (12 hours)
      const simulationTreatments = await databaseService.getTreatments(patient.id, 10, 4);
      const displayTreatments = await databaseService.getTreatments(patient.id, 8, 12);
      setTreatments(displayTreatments);

      // Recalculate glucose curve with new treatment
      console.log(`\n💉 NEW TREATMENT ADDED: ${treatment.type}`);
      await runSimulation(patient, simulationTreatments);

      return true;
    } catch (error) {
      console.error('Failed to save treatment:', error);
      return false;
    }
  };

  // Auto-update glucose display every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (glucoseReadings.length > 0) {
        updateCurrentGlucose(glucoseReadings);
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [glucoseReadings]);

  const openTreatmentModal = (type: 'meal' | 'insulin' | 'exercise') => {
    let treatmentType: Treatment['type'];
    
    switch (type) {
      case 'meal':
        treatmentType = 'meal';
        break;
      case 'insulin':
        treatmentType = 'rapid_insulin';
        break;
      case 'exercise':
        treatmentType = 'exercise';
        break;
      default:
        treatmentType = 'meal';
    }
    
    setModalInitialType(treatmentType);
    setModalVisible(true);
  };

  const formatTreatmentDetails = (treatment: Treatment): string => {
    switch (treatment.type) {
      case 'meal':
        return `${treatment.carbohydrates}g carbs`;
      case 'rapid_insulin':
      case 'correction':
        return `${treatment.rapidInsulin}U rapid`;
      case 'long_insulin':
        return `${treatment.longInsulin}U long`;
      case 'exercise':
        return `${treatment.exerciseDuration}min ${treatment.exerciseType}`;
      default:
        return 'Treatment';
    }
  };

  const formatTime = (timestamp: string): string => {
    const treatmentDate = new Date(timestamp);
    const now = new Date();
    const ageMinutes = Math.round((now.getTime() - treatmentDate.getTime()) / (1000 * 60));
    const isToday = treatmentDate.toDateString() === now.toDateString();
    
    const timeStr = isToday 
      ? treatmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : treatmentDate.toLocaleDateString() + ' ' + treatmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (ageMinutes < 60) {
      return `${timeStr} (${ageMinutes}m ago)`;
    } else {
      const ageHours = Math.round(ageMinutes / 60);
      return `${timeStr} (${ageHours}h ago)`;
    }
  };

  const getGlucoseColor = (glucose: number): string => {
    if (!patient) return '#333';
    
    if (glucose < patient.targetGlucoseLow) {
      return '#FF4444'; // Red - Low
    } else if (glucose > patient.targetGlucoseHigh) {
      return '#FF8800'; // Orange - High
    }
    return '#00C851'; // Green - In Range
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Initializing CGM Simulator...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Failed to load patient data</Text>
          <Button title="Retry" onPress={initializeApp} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>CGM Simulator</Text>
          <Text style={styles.patientName}>{patient.name}</Text>
        </View>

        {/* Current Glucose Display */}
        <View style={styles.glucoseContainer}>
          <Text style={styles.glucoseLabel}>Current Glucose</Text>
          <View style={styles.glucoseValueContainer}>
            <Text style={[styles.glucoseValue, { color: getGlucoseColor(currentGlucose) }]}>
              {currentGlucose}
            </Text>
            <Text style={styles.glucoseUnit}>mg/dL</Text>
            <Text style={styles.trendArrow}>{trend}</Text>
          </View>
          <Text style={styles.lastUpdate}>
            Last updated: {new Date().toLocaleTimeString()}
            {glucoseReadings.length > 0 && ` • ${glucoseReadings.length} readings`}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Add Meal"
              buttonStyle={[styles.actionButton, { backgroundColor: '#FF9800' }]}
              onPress={() => openTreatmentModal('meal')}
            />
            <Button
              title="Add Insulin"
              buttonStyle={[styles.actionButton, { backgroundColor: '#2196F3' }]}
              onPress={() => openTreatmentModal('insulin')}
            />
          </View>
          <View style={styles.buttonRow}>
            <Button
              title="Add Exercise"
              buttonStyle={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => openTreatmentModal('exercise')}
            />
            <Button
              title="View Chart"
              buttonStyle={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
              onPress={() => Alert.alert('Coming Soon', 'Glucose chart will be available soon')}
            />
          </View>
        </View>

        {/* Recent Treatments */}
        <View style={styles.treatmentsContainer}>
          <Text style={styles.cardTitle}>Recent Treatments</Text>
          {treatments.length === 0 ? (
            <Text style={styles.emptyText}>No treatments logged yet</Text>
          ) : (
            treatments.map((treatment) => (
              <View key={treatment.id} style={styles.treatmentItem}>
                <View style={styles.treatmentInfo}>
                  <Text style={styles.treatmentType}>
                    {treatment.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                  <Text style={styles.treatmentDetails}>
                    {formatTreatmentDetails(treatment)}
                  </Text>
                  {treatment.notes && (
                    <Text style={styles.treatmentNotes}>{treatment.notes}</Text>
                  )}
                </View>
                <Text style={styles.treatmentTime}>
                  {formatTime(treatment.timestamp)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Patient Info Card */}
        <View style={styles.patientCard}>
          <Text style={styles.cardTitle}>Patient Profile</Text>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Age:</Text>
            <Text style={styles.patientValue}>{patient.age} years</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Weight:</Text>
            <Text style={styles.patientValue}>{patient.weight} kg</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Height:</Text>
            <Text style={styles.patientValue}>{patient.height} cm</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>ISF:</Text>
            <Text style={styles.patientValue}>{patient.insulinSensitivityFactor} mg/dL per unit</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Carb Ratio:</Text>
            <Text style={styles.patientValue}>{patient.carbRatio} g per unit</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Target Range:</Text>
            <Text style={styles.patientValue}>
              {patient.targetGlucoseLow}-{patient.targetGlucoseHigh} mg/dL
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            ✅ Database initialized
          </Text>
          <Text style={styles.statusText}>
            ✅ Patient profile loaded
          </Text>
          <Text style={styles.statusText}>
            ✅ Treatment logging active
          </Text>
          <Text style={styles.statusText}>
            {glucoseReadings.length > 0 ? '✅' : '🔄'} Glucose simulation {glucoseReadings.length > 0 ? 'active' : 'ready'}
          </Text>
          {glucoseReadings.length > 0 && (
            <Text style={styles.statusText}>
              📊 {glucoseReadings.length} glucose points generated
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Treatment Input Modal */}
      <TreatmentInputModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleTreatmentSave}
        patientId={patient?.id || ''}
        initialType={modalInitialType}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  patientName: {
    fontSize: 18,
    color: '#666',
  },
  glucoseContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  glucoseLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  glucoseValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  glucoseValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginRight: 8,
  },
  glucoseUnit: {
    fontSize: 16,
    color: '#666',
    marginRight: 10,
  },
  trendArrow: {
    fontSize: 24,
    color: '#666',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
  },
  patientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  patientLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  patientValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  actionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  actionButton: {
    flex: 0.48,
    borderRadius: 8,
    paddingVertical: 12,
  },
  treatmentsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  treatmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  treatmentInfo: {
    flex: 1,
    marginRight: 10,
  },
  treatmentType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  treatmentDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  treatmentNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  treatmentTime: {
    fontSize: 12,
    color: '#999',
    minWidth: 50,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  statusContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    marginBottom: 20,
    textAlign: 'center',
  },
});