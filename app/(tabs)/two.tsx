import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';

// Import your existing services
import { databaseService, PatientProfile, Treatment, GlucoseReading, DEFAULT_PATIENT } from '../../services/DatabaseService';
import { SimulationService } from '../../services/SimulationService';

const { width: screenWidth } = Dimensions.get('window');

type TimeScale = '2h' | '4h' | '6h' | '12h' | '24h';
type GlucoseUnit = 'mg/dl' | 'mmol/l';

// Data point interface for react-native-gifted-charts
interface ChartDataPoint {
  value: number;
  label?: string;
  dataPointText?: string;
  textColor?: string;
  textShiftY?: number;
  textShiftX?: number;
  dataPointColor?: string;
  dataPointRadius?: number;
  hideDataPoint?: boolean;
  stripHeight?: number;
  stripColor?: string;
  stripOpacity?: number;
  // Custom properties for our CGM data
  timestamp?: string;
  isPredicted?: boolean;
  glucoseValue?: number;
}

// Get glucose color based on target ranges
const getGlucoseColor = (glucose: number, glucoseUnit: GlucoseUnit = 'mg/dl'): string => {
  const targetLow = glucoseUnit === 'mmol/l' ? 3.9 : 70;
  const targetHigh = glucoseUnit === 'mmol/l' ? 10.0 : 180;
  
  if (glucose < targetLow) return '#FF4444'; // Red - Low
  if (glucose > targetHigh) return '#FF8800'; // Orange - High
  return '#4CAF50'; // Green - In range
};

// CGM Chart Component using react-native-gifted-charts
const CGMGiftedChart: React.FC<{
  data: ChartDataPoint[];
  glucoseUnit: GlucoseUnit;
  onPointSelected?: (point: ChartDataPoint) => void;
  timeScale: TimeScale;
}> = ({ data, glucoseUnit, onPointSelected, timeScale }) => {
  const [selectedPoint, setSelectedPoint] = useState<ChartDataPoint | null>(null);

  // Split data into past and predicted
  const { pastData, futureData } = useMemo(() => {
    const past = data.filter(point => !point.isPredicted);
    const future = data.filter(point => point.isPredicted);
    return { pastData: past, futureData: future };
  }, [data]);

  // Calculate chart parameters
  const chartParams = useMemo(() => {
    if (data.length === 0) return { maxValue: 300, minValue: 40, stepValue: 50 };
    
    const values = data.map(point => point.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    // Add padding to min/max
    const padding = (maxVal - minVal) * 0.1;
    const chartMin = Math.max(40, minVal - padding);
    const chartMax = Math.min(400, maxVal + padding);
    
    return {
      maxValue: chartMax,
      minValue: chartMin,
      stepValue: Math.ceil((chartMax - chartMin) / 6),
    };
  }, [data]);

  // Format glucose value
  const formatGlucose = (value: number): string => {
    if (glucoseUnit === 'mmol/l') {
      return value.toFixed(1);
    }
    return Math.round(value).toString();
  };

  // Handle point press
  const handlePointPress = (item: ChartDataPoint, index: number) => {
    setSelectedPoint(item);
    onPointSelected?.(item);
  };

  // Target range configuration
  const targetLow = glucoseUnit === 'mmol/l' ? 3.9 : 70;
  const targetHigh = glucoseUnit === 'mmol/l' ? 10.0 : 180;

  if (data.length === 0) {
    return (
      <View style={chartStyles.emptyContainer}>
        <Text style={chartStyles.emptyText}>No glucose data available</Text>
      </View>
    );
  }

  return (
    <View style={chartStyles.container}>
      {/* Chart Title */}
      <Text style={chartStyles.title}>
        📊 CGM Glucose Trend ({timeScale})
      </Text>
      <Text style={chartStyles.subtitle}>
        {pastData.length} past readings • {futureData.length} predictions
      </Text>

      {/* Selected Point Info */}
      {selectedPoint && (
        <View style={chartStyles.selectedInfo}>
          <Text style={chartStyles.selectedText}>
            📍 {selectedPoint.timestamp ? new Date(selectedPoint.timestamp).toLocaleTimeString() : 'Unknown time'} • 
            {formatGlucose(selectedPoint.value)} {glucoseUnit} • 
            {selectedPoint.isPredicted ? '🔮 Predicted' : '📊 Actual'}
          </Text>
        </View>
      )}

      {/* Target Range Info */}
      <View style={chartStyles.targetRangeInfo}>
        <Text style={chartStyles.targetRangeText}>
          🎯 Target Range: {formatGlucose(targetLow)}-{formatGlucose(targetHigh)} {glucoseUnit}
        </Text>
      </View>

      {/* Main Chart */}
      <View style={chartStyles.chartWrapper}>
        <LineChart
          data={data}
          width={screenWidth - 80}
          height={280}
          spacing={Math.max(30, (screenWidth - 120) / Math.max(1, data.length - 1))}
          
          // Styling
          color="#2196F3"
          thickness={3}
          curved={true}
          
          // Y-axis configuration
          maxValue={chartParams.maxValue}
          minValue={chartParams.minValue}
          stepValue={chartParams.stepValue}
          noOfSections={6}
          
          // Grid and axes
          showVerticalLines={true}
          verticalLinesColor="#f0f0f0"
          showHorizontalLines={true}
          horizontalLinesColor="#e0e0e0"
          
          // Y-axis labels
          yAxisColor="#666"
          yAxisThickness={1}
          yAxisTextStyle={{
            color: '#666',
            fontSize: 10,
          }}
          formatYLabel={(value) => formatGlucose(parseFloat(value))}
          
          // X-axis labels
          xAxisColor="#666"
          xAxisThickness={1}
          xAxisTextStyle={{
            color: '#666',
            fontSize: 9,
            rotation: -45,
          }}
          
          // Data points
          showDataPointsForMissingData={false}
          dataPointsColor1="#2196F3"
          dataPointsRadius={4}
          textShiftY={-8}
          textColor1="#333"
          
          // Interactions
          pressEnabled={true}
          onPress={handlePointPress}
          
          // Animation
          animateOnDataChange={true}
          animationDuration={1000}
          
          // Target range highlighting
          showYAxisIndices={true}
          yAxisIndicesColor="#ddd"
          
          // Background
          backgroundColor="#fafafa"
          
          // Predicted data styling (if supported)
          color2="#4CAF50"
          thickness2={2}
          
          // Additional styling
          initialSpacing={10}
          endSpacing={10}
        />
        
        {/* Target range overlay */}
        <View style={[
          chartStyles.targetRangeOverlay,
          {
            top: ((chartParams.maxValue - targetHigh) / (chartParams.maxValue - chartParams.minValue)) * 240 + 20,
            height: ((targetHigh - targetLow) / (chartParams.maxValue - chartParams.minValue)) * 240,
          }
        ]} />
      </View>

      {/* Legend */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#2196F3' }]} />
          <Text style={chartStyles.legendText}>Past (Actual)</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#4CAF50', borderWidth: 1, borderColor: '#fff' }]} />
          <Text style={chartStyles.legendText}>Future (Predicted)</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={chartStyles.legendText}>In Range</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#FF8800' }]} />
          <Text style={chartStyles.legendText}>High</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#FF4444' }]} />
          <Text style={chartStyles.legendText}>Low</Text>
        </View>
      </View>

      {/* Chart Info */}
      <View style={chartStyles.chartInfo}>
        <Text style={chartStyles.infoText}>
          📱 Tap points for details • Smooth curves for trend analysis
        </Text>
        <Text style={chartStyles.infoSubText}>
          Showing {data.length} glucose readings over {timeScale}
        </Text>
      </View>
    </View>
  );
};

// Main ChartScreen Component
export default function ChartScreen() {
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeScale, setTimeScale] = useState<TimeScale>('6h');
  const [glucoseUnit, setGlucoseUnit] = useState<GlucoseUnit>('mg/dl');
  const [selectedDataPoint, setSelectedDataPoint] = useState<ChartDataPoint | null>(null);

  useEffect(() => {
    initializeChart();
  }, []);

  const initializeChart = async () => {
    try {
      setLoading(true);
      
      // Load patient
      const loadedPatient = await databaseService.getPatient(DEFAULT_PATIENT.id);
      setPatient(loadedPatient);

      if (loadedPatient) {
        // Load treatments for chart markers
        const chartTreatments = await databaseService.getTreatments(loadedPatient.id, 20, 8);
        setTreatments(chartTreatments);

        // Load glucose readings
        const readings = await databaseService.getGlucoseReadings(loadedPatient.id, 288);
        setGlucoseReadings(readings);
        
        console.log(`📊 Chart loaded: ${readings.length} glucose readings, ${chartTreatments.length} treatments`);
      }
      
    } catch (error) {
      console.error('Failed to initialize chart:', error);
      Alert.alert('Error', 'Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initializeChart();
    setRefreshing(false);
  };

  // Convert mg/dL to mmol/L
  const convertToMmol = (mgdl: number): number => {
    return Math.round((mgdl / 18.0) * 10) / 10;
  };

  // Format glucose value based on unit
  const formatGlucose = (value: number): string => {
    if (glucoseUnit === 'mmol/l') {
      return convertToMmol(value).toFixed(1);
    }
    return Math.round(value).toString();
  };

  // Get time range in hours
  const getTimeRangeHours = (scale: TimeScale): number => {
    switch (scale) {
      case '2h': return 2;
      case '4h': return 4;
      case '6h': return 6;
      case '12h': return 12;
      case '24h': return 24;
      default: return 6;
    }
  };

  // Filter glucose readings based on time scale
  const getFilteredReadings = () => {
    const now = new Date();
    const hoursBack = getTimeRangeHours(timeScale);
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    // Include 24 hours of future predictions
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const filtered = glucoseReadings
      .filter(reading => {
        const readingTime = new Date(reading.timestamp);
        return readingTime >= startTime && readingTime <= endTime;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const now_ms = now.getTime();
    const pastReadings = filtered.filter(r => new Date(r.timestamp).getTime() <= now_ms);
    const futureReadings = filtered.filter(r => new Date(r.timestamp).getTime() > now_ms);

    return { all: filtered, past: pastReadings, future: futureReadings };
  };

  // Get treatment markers
  const getFilteredTreatments = () => {
    const now = new Date();
    const hoursBack = getTimeRangeHours(timeScale);
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    return treatments.filter(treatment => {
      const treatmentTime = new Date(treatment.timestamp);
      return treatmentTime >= startTime && treatmentTime <= now;
    });
  };

  const { all: chartData, past: pastData, future: futureData } = getFilteredReadings();
  const chartTreatments = getFilteredTreatments();

  // Convert glucose readings to chart format
  const chartPoints: ChartDataPoint[] = useMemo(() => {
    return chartData.map((reading, index) => {
      const isPredicted = new Date(reading.timestamp) > new Date();
      const convertedValue = glucoseUnit === 'mmol/l' ? convertToMmol(reading.glucoseValue) : reading.glucoseValue;
      const time = new Date(reading.timestamp);
      
      return {
        value: convertedValue,
        label: index % 12 === 0 ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        dataPointColor: getGlucoseColor(reading.glucoseValue, glucoseUnit),
        dataPointRadius: isPredicted ? 3 : 4,
        hideDataPoint: false,
        timestamp: reading.timestamp,
        isPredicted,
        glucoseValue: reading.glucoseValue,
        textColor: '#333',
        textShiftY: -10,
      };
    });
  }, [chartData, glucoseUnit]);

  // Handle data point selection
  const handleDataPointPress = (point: ChartDataPoint) => {
    setSelectedDataPoint(point);
  };

  // Time scale selector
  const TimeScaleSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Time Scale:</Text>
      <View style={styles.selectorButtons}>
        {(['2h', '4h', '6h', '12h', '24h'] as TimeScale[]).map((scale) => (
          <TouchableOpacity
            key={scale}
            style={[
              styles.selectorButton,
              timeScale === scale && styles.selectorButtonActive
            ]}
            onPress={() => setTimeScale(scale)}
          >
            <Text style={[
              styles.selectorButtonText,
              timeScale === scale && styles.selectorButtonTextActive
            ]}>
              {scale}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Unit selector
  const UnitSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Units:</Text>
      <View style={styles.selectorButtons}>
        {(['mg/dl', 'mmol/l'] as GlucoseUnit[]).map((unit) => (
          <TouchableOpacity
            key={unit}
            style={[
              styles.selectorButton,
              glucoseUnit === unit && styles.selectorButtonActive
            ]}
            onPress={() => setGlucoseUnit(unit)}
          >
            <Text style={[
              styles.selectorButtonText,
              glucoseUnit === unit && styles.selectorButtonTextActive
            ]}>
              {unit}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Current stats component
  const CurrentStats = () => (
    <View style={styles.statsContainer}>
      <Text style={styles.statsTitle}>📊 Current Status</Text>
      <Text style={styles.statsText}>
        Current: {formatGlucose(SimulationService.getCurrentGlucoseValue(glucoseReadings))} {glucoseUnit}
      </Text>
      <Text style={styles.statsText}>
        Trend: {SimulationService.calculateTrend(glucoseReadings)}
      </Text>
      <Text style={styles.statsText}>
        Time Scale: {timeScale} • Total Points: {chartData.length}
      </Text>
      <Text style={styles.statsText}>
        Target Range: {formatGlucose(70)}-{formatGlucose(180)} {glucoseUnit}
      </Text>
      {selectedDataPoint && (
        <View style={styles.selectedPointInfo}>
          <Text style={styles.selectedPointTitle}>📍 Selected Point:</Text>
          <Text style={styles.selectedPointText}>
            Time: {selectedDataPoint.timestamp ? new Date(selectedDataPoint.timestamp).toLocaleString() : 'Unknown'}
          </Text>
          <Text style={styles.selectedPointText}>
            Glucose: {formatGlucose(selectedDataPoint.glucoseValue || selectedDataPoint.value)} {glucoseUnit}
          </Text>
          <Text style={styles.selectedPointText}>
            Type: {selectedDataPoint.isPredicted ? '🔮 Predicted' : '📊 Actual'}
          </Text>
        </View>
      )}
    </View>
  );

  // Treatment list
  const TreatmentsList = () => (
    <View style={styles.treatmentsContainer}>
      <Text style={styles.treatmentsTitle}>💊 Treatments in {timeScale}</Text>
      {chartTreatments.length === 0 ? (
        <Text style={styles.emptyText}>No treatments in this time range</Text>
      ) : (
        chartTreatments.map((treatment) => {
          const time = new Date(treatment.timestamp).toLocaleTimeString();
          const ageMinutes = Math.round((Date.now() - new Date(treatment.timestamp).getTime()) / (1000 * 60));
          
          return (
            <View key={treatment.id} style={styles.treatmentItem}>
              <View style={styles.treatmentInfo}>
                <Text style={styles.treatmentType}>
                  {treatment.type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.treatmentDetails}>
                  {getTreatmentDetails(treatment)}
                </Text>
              </View>
              <Text style={styles.treatmentTime}>
                {time} ({ageMinutes}m ago)
              </Text>
            </View>
          );
        })
      )}
    </View>
  );

  const getTreatmentDetails = (treatment: Treatment): string => {
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading glucose chart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>🩺 CGM Chart (High Performance)</Text>
          <Text style={styles.subtitle}>
            {chartData.length} readings • {pastData.length} past • {futureData.length} predicted
          </Text>
        </View>

        <TimeScaleSelector />
        <UnitSelector />

        {chartData.length === 0 ? (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>No glucose data available</Text>
            <Text style={styles.emptySubtext}>Add some treatments to generate glucose predictions</Text>
          </View>
        ) : (
          <>
            <CurrentStats />
            
            {/* High-Performance CGM Chart */}
            <CGMGiftedChart
              data={chartPoints}
              glucoseUnit={glucoseUnit}
              onPointSelected={handleDataPointPress}
              timeScale={timeScale}
            />
            
            <TreatmentsList />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Chart-specific styles
const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  selectedInfo: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  selectedText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  targetRangeInfo: {
    backgroundColor: '#f3e5f5',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  targetRangeText: {
    fontSize: 12,
    color: '#7b1fa2',
    fontWeight: '500',
  },
  chartWrapper: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
  },
  targetRangeOverlay: {
    position: 'absolute',
    left: 60,
    right: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    pointerEvents: 'none',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 2,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  chartInfo: {
    alignItems: 'center',
  },
  infoText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoSubText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

// Main screen styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  selectorContainer: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectorButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  selectorButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 55,
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: '#2196F3',
  },
  selectorButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  selectorButtonTextActive: {
    color: '#fff',
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  selectedPointInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  selectedPointTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  selectedPointText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  treatmentsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  treatmentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  treatmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  treatmentInfo: {
    flex: 1,
  },
  treatmentType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  treatmentDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  treatmentTime: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});