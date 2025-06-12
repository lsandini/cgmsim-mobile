const treatmentTypes = [
    { value: 'meal', label: 'Meal' },
    { value: 'rapid_insulin', label: 'Rapid Insulin' },
    { value: 'long_insulin', label: 'Long Insulin' },
    { value: 'exercise', label: 'Exercise' },
    { value: 'correction', label: 'Correction' },
  ];

  const exerciseTypes = [
    { value: 'light', label: 'Light' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'intense', label: 'Intense' },
  ];import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Button } from 'react-native-elements';

interface Treatment {
  id: string;
  patientId: string;
  timestamp: string;
  type: 'meal' | 'rapid_insulin' | 'long_insulin' | 'exercise' | 'correction';
  carbohydrates?: number;
  rapidInsulin?: number;
  longInsulin?: number;
  exerciseType?: 'light' | 'moderate' | 'intense';
  exerciseDuration?: number;
  notes?: string;
}

interface TreatmentInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (treatment: Omit<Treatment, 'id' | 'patientId'>) => Promise<boolean>;
  patientId: string;
  initialType?: Treatment['type'];
}

export const TreatmentInputModal: React.FC<TreatmentInputModalProps> = ({
  visible,
  onClose,
  onSave,
  patientId,
  initialType = 'meal'
}) => {
  const [treatmentType, setTreatmentType] = useState<Treatment['type']>(initialType);
  const [carbohydrates, setCarbohydrates] = useState('');
  const [rapidInsulin, setRapidInsulin] = useState('');
  const [longInsulin, setLongInsulin] = useState('');
  const [exerciseType, setExerciseType] = useState<'light' | 'moderate' | 'intense'>('moderate');
  const [exerciseDuration, setExerciseDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setTreatmentType(initialType);
    setCarbohydrates('');
    setRapidInsulin('');
    setLongInsulin('');
    setExerciseType('moderate');
    setExerciseDuration('');
    setNotes('');
  };

  // Reset form when modal opens with new type
  React.useEffect(() => {
    if (visible) {
      setTreatmentType(initialType);
    }
  }, [visible, initialType]);

  const handleSave = async () => {
    try {
      setLoading(true);

      // Basic validation
      if (treatmentType === 'meal' && (!carbohydrates || parseFloat(carbohydrates) <= 0)) {
        Alert.alert('Validation Error', 'Please enter carbohydrates for meals');
        return;
      }

      if ((treatmentType === 'rapid_insulin' || treatmentType === 'correction') && 
          (!rapidInsulin || parseFloat(rapidInsulin) <= 0)) {
        Alert.alert('Validation Error', 'Please enter insulin amount');
        return;
      }

      if (treatmentType === 'long_insulin' && (!longInsulin || parseFloat(longInsulin) <= 0)) {
        Alert.alert('Validation Error', 'Please enter long insulin amount');
        return;
      }

      if (treatmentType === 'exercise' && (!exerciseDuration || parseInt(exerciseDuration) <= 0)) {
        Alert.alert('Validation Error', 'Please enter exercise duration');
        return;
      }

      // Build treatment object
      const treatment: Omit<Treatment, 'id' | 'patientId'> = {
        timestamp: new Date().toISOString(),
        type: treatmentType,
        notes: notes.trim() || undefined,
      };

      // Add type-specific fields
      if (treatmentType === 'meal') {
        treatment.carbohydrates = parseFloat(carbohydrates);
      } else if (treatmentType === 'rapid_insulin' || treatmentType === 'correction') {
        treatment.rapidInsulin = parseFloat(rapidInsulin);
      } else if (treatmentType === 'long_insulin') {
        treatment.longInsulin = parseFloat(longInsulin);
      } else if (treatmentType === 'exercise') {
        treatment.exerciseType = exerciseType;
        treatment.exerciseDuration = parseInt(exerciseDuration);
      }

      // Save treatment
      const success = await onSave(treatment);
      
      if (success) {
        resetForm();
        onClose();
        Alert.alert('Success', 'Treatment logged successfully');
      }

    } catch (error) {
      console.error('Error saving treatment:', error);
      Alert.alert('Error', 'Failed to save treatment');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const renderMealForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.label}>Carbohydrates (grams)</Text>
      <TextInput
        style={styles.input}
        value={carbohydrates}
        onChangeText={setCarbohydrates}
        placeholder="Enter carbs (e.g., 45)"
        keyboardType="numeric"
      />
    </View>
  );

  const renderRapidInsulinForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.label}>Rapid Insulin (units)</Text>
      <TextInput
        style={styles.input}
        value={rapidInsulin}
        onChangeText={setRapidInsulin}
        placeholder="Enter insulin units (e.g., 4.5)"
        keyboardType="numeric"
      />
    </View>
  );

  const renderLongInsulinForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.label}>Long-Acting Insulin (units)</Text>
      <TextInput
        style={styles.input}
        value={longInsulin}
        onChangeText={setLongInsulin}
        placeholder="Enter insulin units (e.g., 20)"
        keyboardType="numeric"
      />
    </View>
  );

  const renderExerciseForm = () => (
    <>
      <View style={styles.formSection}>
        <Text style={styles.label}>Exercise Type</Text>
        <View style={styles.selectorContainer}>
          {exerciseTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.selectorOption,
                exerciseType === type.value && styles.selectorOptionActive
              ]}
              onPress={() => setExerciseType(type.value as 'light' | 'moderate' | 'intense')}
            >
              <Text style={[
                styles.selectorText,
                exerciseType === type.value && styles.selectorTextActive
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.formSection}>
        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput
          style={styles.input}
          value={exerciseDuration}
          onChangeText={setExerciseDuration}
          placeholder="Enter duration (e.g., 30)"
          keyboardType="numeric"
        />
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Log Treatment</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {/* Treatment Type Selector */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Treatment Type</Text>
            <View style={styles.selectorContainer}>
              {treatmentTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.selectorOption,
                    treatmentType === type.value && styles.selectorOptionActive
                  ]}
                  onPress={() => setTreatmentType(type.value as Treatment['type'])}
                >
                  <Text style={[
                    styles.selectorText,
                    treatmentType === type.value && styles.selectorTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Dynamic Form Based on Type */}
          {treatmentType === 'meal' && renderMealForm()}
          {(treatmentType === 'rapid_insulin' || treatmentType === 'correction') && renderRapidInsulinForm()}
          {treatmentType === 'long_insulin' && renderLongInsulinForm()}
          {treatmentType === 'exercise' && renderExerciseForm()}

          {/* Notes */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes..."
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Log Treatment"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            buttonStyle={styles.saveButton}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#2196F3',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorOption: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  selectorOptionActive: {
    backgroundColor: '#2196F3',
  },
  selectorText: {
    fontSize: 14,
    color: '#666',
  },
  selectorTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 15,
  },
});