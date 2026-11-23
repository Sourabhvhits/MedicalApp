import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './categories.style';
import useCategories, { HealthConditionCategory } from './useCategories';
import { Header } from '../../../components/componentsIndex';
import { PillCapsuleIcon } from '../../../assets/svg/PillCapsuleIcon';
import { BloodDropIcon } from '../../../assets/svg/BloodDropIcon';
import { VitaminsIcon } from '../../../assets/svg/VitaminsIcon';
import { HeartPulseIcon } from '../../../assets/svg/HeartPulseIcon';
import { DropperIcon } from '../../../assets/svg/DropperIcon';
import { StethoscopeIcon } from '../../../assets/svg/StethoscopeIcon';
import { color } from '@theme';

export const Categories: React.FC = () => {
  const { categories, onCategoryPress, goBack } = useCategories();

  const renderIcon = (type: HealthConditionCategory['type']) => {
    switch (type) {
      case 'PAIN':
        return <PillCapsuleIcon width={24} height={24} color="#EF4444" />;
      case 'DIABETES':
        return <BloodDropIcon width={24} height={24} color="#0284C7" />;
      case 'VITAMINS':
        return <VitaminsIcon width={24} height={24} color="#D97706" />;
      case 'HEART':
        return <HeartPulseIcon width={24} height={24} color="#059669" />;
      case 'SKIN':
        return <DropperIcon width={24} height={24} color="#7C3AED" />;
      default:
        return <StethoscopeIcon width={24} height={24} color={color.primary} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header title="All Health Conditions" showBack onBackPress={goBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageSubtitle}>
          Select a clinical category to view licensed medicines and therapeutic treatments.
        </Text>

        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() => onCategoryPress(cat)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: cat.bgColor, borderColor: cat.borderColor },
              ]}
            >
              {renderIcon(cat.type)}
            </View>

            <View style={styles.infoCol}>
              <View style={styles.titleRow}>
                <Text style={styles.categoryTitle}>{cat.name}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{cat.itemCount} items</Text>
                </View>
              </View>
              <Text style={styles.categoryDesc} numberOfLines={2}>
                {cat.description}
              </Text>
            </View>

            <Text style={styles.arrowChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Categories;
