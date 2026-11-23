import React from 'react';
import { View, Text } from 'react-native';
import { SafetyBannerProps } from './safetyBannerProps';
import { styles } from './safetyBanner.style';
import { AlertTriangleIcon } from '../../../assets/svg/AlertTriangleIcon';
import color from '../../../theme/color';

export const SafetyBanner: React.FC<SafetyBannerProps> = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  const hasSevere = warnings.some((w) => w.severity === 'SEVERE');
  const iconColor = hasSevere ? color.error : color.warning;

  return (
    <View
      style={[
        styles.container,
        hasSevere ? styles.severeContainer : styles.moderateContainer,
      ]}
    >
      <View style={styles.headerRow}>
        <AlertTriangleIcon width={18} height={18} color={iconColor} />
        <Text
          style={[
            styles.title,
            hasSevere ? styles.severeTitle : styles.moderateTitle,
          ]}
        >
          {hasSevere
            ? '⚠️ High-Risk Drug Interaction Detected'
            : 'ℹ️ Moderate Drug Interaction Warning'}
        </Text>
      </View>

      {warnings.map((w, index) => (
        <View key={`${w.compositionA}-${w.compositionB}-${index}`} style={styles.warningItem}>
          <Text style={styles.warningPair}>
            {w.compositionA} + {w.compositionB}
          </Text>
          <Text style={styles.warningDesc}>{w.description}</Text>
        </View>
      ))}

      {hasSevere && (
        <Text style={styles.mandatoryNote}>
          * A doctor's prescription is required before ordering these conflicting medicines.
        </Text>
      )}
    </View>
  );
};

export default SafetyBanner;
