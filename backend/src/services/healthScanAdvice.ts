/**
 * Simple rule-based advice generator for health scans
 * This is a basic MVP implementation - can be enhanced with ML/AI later
 */
export function generateHealthScanAdvice(
  warningLights: boolean,
  newNoises: boolean,
  odometerReading: number,
  odometerUnit: 'miles' | 'km'
): string {
  const advice: string[] = []
  const warnings: string[] = []

  // Convert odometer to miles for consistency
  const odometerMiles = odometerUnit === 'miles' ? odometerReading : odometerReading / 1.60934

  // Warning lights
  if (warningLights) {
    warnings.push(
      '⚠️ Warning lights detected. Please consult a qualified mechanic as soon as possible. Do not ignore warning lights as they indicate potential issues that need attention.'
    )
  }

  // New noises
  if (newNoises) {
    warnings.push(
      '🔊 New or unusual noises detected. It is recommended to have your vehicle inspected by a mechanic. Unusual sounds can indicate wear or potential problems.'
    )
  }

  // Mileage-based advice
  if (odometerMiles > 100000) {
    advice.push(
      'Your vehicle has high mileage. Regular maintenance is crucial. Consider more frequent service intervals.'
    )
  } else if (odometerMiles > 50000) {
    advice.push('Your vehicle is approaching higher mileage. Stay on top of regular maintenance.')
  }

  // General advice
  if (!warningLights && !newNoises) {
    advice.push(
      '✅ No immediate concerns reported. Continue with regular maintenance and monthly health scans.'
    )
  }

  // Combine warnings and advice
  const allMessages = [...warnings, ...advice]

  if (allMessages.length === 0) {
    return 'Continue regular maintenance and monitoring.'
  }

  return allMessages.join('\n\n')
}
