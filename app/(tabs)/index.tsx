import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-elements';

import { databaseService, PatientProfile, Treatment, DEFAULT_PATIENT } from '../../services/DatabaseService';
import { TreatmentInputModal } from '../../components/TreatmentInputModal';

export default function HomeScreen() {
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentGlucose] = useState(120); // Mock glucose value for now
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

      // Load recent treatments
      if (loadedPatient) {
        const recentTreatments = await databaseService.getTreatments(loadedPatient.id, 5);
        setTreatments(recentTreatments);
      }
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      Alert.alert('Error', 'Failed to initialize the app');
    } finally {
      setLoading(false);
    }
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

      await databaseService.saveTreatment(treatment);
      
      // Reload treatments
      const recentTreatments = await databaseService.getTreatments(patient.id, 5);
      setTreatments(recentTreatments);

      return true;
    } catch (error) {
      console.error('Failed to save treatment:', error);
      return false;
    }
  };

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
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            <Text style={styles.trendArrow}>→</Text>
          </View>
          <Text style={styles.lastUpdate}>Last updated: {new Date().toLocaleTimeString()}</Text>
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
            🔄 Simulation ready
          </Text>
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