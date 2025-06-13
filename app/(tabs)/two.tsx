// Get glucose color
  const getGlucoseColor = (glucose: number): string => {
    const targetLow = 70;
    const targetHigh = 180;
    
    if (glucose < targetLow) {
      return '#FF4444'; // Red
    } else if (glucose > targetHigh) {
      return '#FF8800'; // Orange
    }
    return '#4CAF50'; // Green
  };import React, { useState, useEffect } from 'react';
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

// Test Victory Native imports one by one
let CartesianChart, Line, CartesianAxis, Area, Scatter;
try {
  const Victory = require('victory-native');
  console.log('Victory native available components:', Object.keys(Victory));
  CartesianChart = Victory.CartesianChart;
  Line = Victory.Line;
  CartesianAxis = Victory.CartesianAxis;
  Area = Victory.Area;
  Scatter = Victory.Scatter;
} catch (error) {
  console.log('Victory native import error:', error);
}

import { databaseService, PatientProfile, Treatment, GlucoseReading, DEFAULT_PATIENT } from '../../services/DatabaseService';
import { SimulationService } from '../../services/SimulationService';

type TimeScale = '2h' | '4h' | '6h' | '12h' | '24h';
type GlucoseUnit = 'mg/dl' | 'mmol/l';

export default function ChartScreen() {
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeScale, setTimeScale] = useState<TimeScale>('6h');
  const [glucoseUnit, setGlucoseUnit] = useState<GlucoseUnit>('mg/dl');

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
        
        console.log(`Chart loaded: ${readings.length} glucose readings, ${chartTreatments.length} treatments`);
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
    return Math.round((mgdl / 18.0) * 10) / 10; // Round to 1 decimal
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

  // Simple glucose data table
  const GlucoseDataTable = () => {
    const sampleData = chartData.filter((_, index) => index % 12 === 0); // Every hour
    
    return (
      <View style={styles.dataTable}>
        <Text style={styles.dataTableTitle}>Glucose Data ({timeScale} view)</Text>
        <View style={styles.dataTableHeader}>
          <Text style={styles.dataTableHeaderText}>Time</Text>
          <Text style={styles.dataTableHeaderText}>Glucose</Text>
          <Text style={styles.dataTableHeaderText}>Type</Text>
        </View>
        {sampleData.slice(0, 12).map((reading, index) => {
          const time = new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const glucose = formatGlucose(reading.glucoseValue);
          const isPast = new Date(reading.timestamp) <= new Date();
          
          return (
            <View key={reading.id} style={styles.dataTableRow}>
              <Text style={styles.dataTableCell}>{time}</Text>
              <Text style={[
                styles.dataTableCell,
                { color: getGlucoseColor(reading.glucoseValue) }
              ]}>
                {glucose} {glucoseUnit}
              </Text>
              <Text style={styles.dataTableCell}>
                {isPast ? 'Past' : 'Predicted'}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Victory Native 41.x Chart with Axes
  const VictoryGlucoseChart = () => {
    if (!CartesianChart || !Line) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartError}>Victory Native components not available</Text>
        </View>
      );
    }

    // CGM display: 3 hours past + 6 hours future = 9 hours total
    const hoursBack = 3;
    const hoursFuture = 6;
    const totalPoints = (hoursBack + hoursFuture) * 12; // 12 points per hour (5-min intervals)
    
    const now = new Date();
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000); // 3 hours ago
    
    const chartPoints = chartData
      .filter(reading => {
        const readingTime = new Date(reading.timestamp);
        return readingTime >= startTime;
      })
      .slice(0, totalPoints) // Limit to 9 hours total
      .map((reading, index) => {
        const time = new Date(reading.timestamp);
        const isPast = time <= now;
        
        return {
          x: index,
          y: Math.round(reading.glucoseValue),
          time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: reading.timestamp,
          isPast: isPast
        };
      });

    // Split into past and future points
    const pastPoints = chartPoints.filter(point => point.isPast);
    const futurePoints = chartPoints.filter(point => !point.isPast);

    console.log(`CGM data: ${chartPoints.length} total points (${pastPoints.length} past, ${futurePoints.length} future)`);
    console.log(`Duration: ${hoursBack}h past + ${hoursFuture}h future = ${hoursBack + hoursFuture}h total`);
    console.log('Time range:', chartPoints[0]?.time, 'to', chartPoints[chartPoints.length - 1]?.time);

    if (chartPoints.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>No Data</Text>
        </View>
      );
    }

    // Calculate domains - fixed Y scale like real CGM
    const yMin = 40;  // Fixed minimum like real CGM
    const yMax = 300; // Fixed maximum like real CGM
    const yPadding = 0; // No padding needed with fixed scale

    try {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>CGM Display • 3h Past + 6h Predicted</Text>
          <Text style={styles.chartDebug}>
            {pastPoints.length} past readings (blue) • {futurePoints.length} predictions (green) • Y-scale: 40-300 mg/dL
          </Text>
          
          <View style={styles.chartWrapper}>
            {/* Y-axis labels positioned absolutely */}
            <View style={styles.yAxisContainer}>
              {(() => {
                // Calculate Y-axis tick positions for 40-300 range
                const tickValues = [50, 100, 150, 200, 250]; // Major ticks
                const chartHeight = 250;
                const yRange = 300 - 40; // 260 mg/dL range
                const ticks = [];
                
                tickValues.forEach(value => {
                  const position = chartHeight - (chartHeight * (value - 40) / yRange) - 10;
                  ticks.push({ value, position });
                });
                
                return ticks.map((tick, index) => (
                  <View
                    key={index}
                    style={[
                      styles.yAxisTick,
                      { top: tick.position }
                    ]}
                  >
                    <Text style={styles.yAxisLabel}>{tick.value}</Text>
                    <View style={styles.yAxisLine} />
                  </View>
                ));
              })()}
            </View>
            
            <CartesianChart
              data={chartPoints}
              xKey="x"
              yKeys={["y"]}
              height={250}
              width={350}
              domain={{
                y: [yMin, yMax] // Fixed 40-300 range
              }}
            >
              {({ points, chartBounds }) => {
                console.log('Chart render - Fixed Y domain: 40-300 mg/dL');
                console.log('Total points for display:', points.y?.length || 0);
                
                // Split points into past and future based on original data
                const pastPointsData = points.y?.filter((point, index) => chartPoints[index]?.isPast) || [];
                const futurePointsData = points.y?.filter((point, index) => !chartPoints[index]?.isPast) || [];
                
                console.log(`Rendering: ${pastPointsData.length} past (blue), ${futurePointsData.length} future (green)`);
                
                return (
                  <>
                    {/* Past CGM dots (blue) - no connecting lines */}
                    {Scatter && pastPointsData.length > 0 && (
                      <Scatter 
                        points={pastPointsData}
                        radius={2.5}
                        color="#2196F3"
                        opacity={1}
                      />
                    )}
                    
                    {/* Future prediction dots (green) - no connecting lines */}
                    {Scatter && futurePointsData.length > 0 && (
                      <Scatter 
                        points={futurePointsData}
                        radius={2.5}
                        color="#4CAF50"
                        opacity={0.8}
                      />
                    )}
                  </>
                );
              }}
            </CartesianChart>
          </View>
          
          {/* Manual axis labels below chart */}
          <View style={styles.axisLabels}>
            <View style={styles.xAxisLabels}>
              <Text style={styles.axisLabel}>3h ago: {chartPoints[0]?.time}</Text>
              <Text style={styles.axisLabel}>Now ← → Future</Text>
              <Text style={styles.axisLabel}>+6h: {chartPoints[chartPoints.length - 1]?.time}</Text>
            </View>
            <View style={styles.yAxisLabels}>
              <Text style={styles.axisLabel}>🔵 Past readings • 🟢 Predictions</Text>
            </View>
          </View>
          
          <Text style={styles.chartSubtitle}>
            🔵 Past 3 hours (actual CGM) • 🟢 Next 6 hours (predicted) • Dots only, no lines
          </Text>
        </View>
      );
    } catch (error) {
      console.error('Chart error:', error);
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartError}>Chart Error</Text>
          <Text style={styles.chartErrorSub}>{error.toString()}</Text>
        </View>
      );
    }
  };

  // Treatment list
  const TreatmentsList = () => (
    <View style={styles.treatmentsContainer}>
      <Text style={styles.treatmentsTitle}>Treatments in {timeScale}</Text>
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
          <Text style={styles.title}>Glucose Chart</Text>
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
            {/* Current stats */}
            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>Current Status</Text>
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
            </View>

            <GlucoseDataTable />
            <VictoryGlucoseChart />
            <TreatmentsList />

            {/* Chart placeholder */}
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderTitle}>📊 Victory Native Chart Coming Soon</Text>
              <Text style={styles.chartPlaceholderText}>
                Chart will show glucose curve with:
              </Text>
              <Text style={styles.chartPlaceholderText}>• Past glucose (solid line)</Text>
              <Text style={styles.chartPlaceholderText}>• Predicted glucose (dashed line)</Text>
              <Text style={styles.chartPlaceholderText}>• Target range (70-180 {glucoseUnit})</Text>
              <Text style={styles.chartPlaceholderText}>• Treatment markers</Text>
              <Text style={styles.chartPlaceholderText}>• Time scale: {timeScale}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  selectorContainer: {
    marginBottom: 15,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  selectorButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  selectorButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: '#2196F3',
  },
  selectorButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectorButtonTextActive: {
    color: '#fff',
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dataTable: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dataTableTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  dataTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  dataTableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  dataTableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  dataTableCell: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 300, // Ensure minimum height
  },
  chartWrapper: {
    backgroundColor: '#f9f9f9',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 10,
    marginVertical: 10,
    height: 270, // Fixed height
    position: 'relative', // Enable absolute positioning for Y-axis
  },
  yAxisContainer: {
    position: 'absolute',
    left: 0,
    top: 10,
    width: 50,
    height: 250,
    zIndex: 10, // Above chart
  },
  yAxisTick: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    width: 50,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    width: 35,
    marginRight: 3,
  },
  yAxisLine: {
    width: 5,
    height: 1,
    backgroundColor: '#ccc',
  },
  axisLabels: {
    marginTop: 5,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  yAxisLabels: {
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  chartDebug: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  targetRangeInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  targetRangeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 3,
  },
  chartError: {
    fontSize: 14,
    color: '#FF4444',
    textAlign: 'center',
    marginBottom: 5,
  },
  chartErrorSub: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  treatmentsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  treatmentsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  treatmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
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
  },
  treatmentTime: {
    fontSize: 10,
    color: '#999',
  },
  chartPlaceholder: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartPlaceholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
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
    marginTop: 5,
  },
});