import { useAuthNavigation } from '../../../hooks/useAppNavigation';

export interface HealthConditionCategory {
  id: string;
  name: string;
  query: string;
  description: string;
  itemCount: number;
  type: 'PAIN' | 'DIABETES' | 'VITAMINS' | 'HEART' | 'SKIN' | 'DIGESTION' | 'BABY' | 'FIRSTAID';
  bgColor: string;
  borderColor: string;
}

export const ALL_HEALTH_CATEGORIES: HealthConditionCategory[] = [
  {
    id: 'cat-1',
    name: 'Pain Relief & Fever',
    query: 'Paracetamol',
    description: 'Headache, muscle ache, fever reducers & analgesics',
    itemCount: 42,
    type: 'PAIN',
    bgColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  {
    id: 'cat-2',
    name: 'Diabetes Care',
    query: 'Metformin',
    description: 'Blood glucose management, strips & insulin care',
    itemCount: 38,
    type: 'DIABETES',
    bgColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  {
    id: 'cat-3',
    name: 'Vitamins & Supplements',
    query: 'Vitamin',
    description: 'Immunity boosters, daily multivitamins, calcium & zinc',
    itemCount: 65,
    type: 'VITAMINS',
    bgColor: '#FFFBEB',
    borderColor: '#FEF3C7',
  },
  {
    id: 'cat-4',
    name: 'Cardiac & Blood Pressure',
    query: 'Amlodipine',
    description: 'Cardiovascular health, BP control & cholesterol',
    itemCount: 29,
    type: 'HEART',
    bgColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  {
    id: 'cat-5',
    name: 'Skin & Hair Care',
    query: 'Skin',
    description: 'Antifungal, moisturizers, acne treatment & eczema',
    itemCount: 54,
    type: 'SKIN',
    bgColor: '#FAF5FF',
    borderColor: '#F3E8FF',
  },
  {
    id: 'cat-6',
    name: 'Stomach & Digestion',
    query: 'Pantoprazole',
    description: 'Antacids, gas relief, probiotics & liver care',
    itemCount: 47,
    type: 'DIGESTION',
    bgColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  {
    id: 'cat-7',
    name: 'Baby & Mother Care',
    query: 'Baby',
    description: 'Diaper creams, paediatric drops & mother essentials',
    itemCount: 31,
    type: 'BABY',
    bgColor: '#FDF2F8',
    borderColor: '#FCE7F3',
  },
  {
    id: 'cat-8',
    name: 'First Aid & Wound Care',
    query: 'Bandage',
    description: 'Antiseptics, bandages, gauze & emergency supplies',
    itemCount: 24,
    type: 'FIRSTAID',
    bgColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
];

export const useCategories = () => {
  const navigation = useAuthNavigation();

  const onCategoryPress = (category: HealthConditionCategory) => {
    navigation.navigate('productSearch', { initialQuery: category.query });
  };

  const goBack = () => {
    navigation.goBack();
  };

  return {
    categories: ALL_HEALTH_CATEGORIES,
    onCategoryPress,
    goBack,
  };
};

export default useCategories;
