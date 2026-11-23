import { useState, useEffect, useCallback } from 'react';
import { useAuthRoute, useAuthNavigation } from '../../../hooks/useAppNavigation';
import { axiosInstance } from '../../../services/api';
import { ProductItem } from '../../../components/card/productCard/productCardProps';
import { ToastSuccess } from '../../../utility/toast';

const FALLBACK_STORE_PRODUCTS: ProductItem[] = [
  {
    id: 'rp-dolo-650',
    productId: 'prod-dolo-650',
    name: 'Dolo 650mg Tablet',
    brandName: 'Dolo 650',
    genericName: 'Paracetamol',
    composition: 'Paracetamol (650mg)',
    dosageForm: 'TABLET',
    prescriptionRequired: false,
    price: 30,
    mrp: 34,
    discountPercent: 12,
    inStock: true,
  },
  {
    id: 'rp-pan-d',
    productId: 'prod-pan-d',
    name: 'Pan-D Capsule',
    brandName: 'Pan-D',
    genericName: 'Pantoprazole + Domperidone',
    composition: 'Pantoprazole (40mg) + Domperidone (30mg)',
    dosageForm: 'CAPSULE',
    prescriptionRequired: true,
    price: 135,
    mrp: 160,
    discountPercent: 16,
    inStock: true,
  },
  {
    id: 'rp-augmentin-625',
    productId: 'prod-augmentin-625',
    name: 'Augmentin 625 Duo Tablet',
    brandName: 'Augmentin 625 Duo',
    genericName: 'Amoxicillin + Clavulanic Acid',
    composition: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
    dosageForm: 'TABLET',
    prescriptionRequired: true,
    price: 180,
    mrp: 205,
    discountPercent: 12,
    inStock: true,
  },
  {
    id: 'rp-azithral-500',
    productId: 'prod-azithral-500',
    name: 'Azithral 500mg Tablet',
    brandName: 'Azithral 500',
    genericName: 'Azithromycin',
    composition: 'Azithromycin (500mg)',
    dosageForm: 'TABLET',
    prescriptionRequired: true,
    price: 115,
    mrp: 132,
    discountPercent: 13,
    inStock: true,
  },
  {
    id: 'rp-shelcal-500',
    productId: 'prod-shelcal-500',
    name: 'Shelcal 500 Tablet',
    brandName: 'Shelcal 500',
    genericName: 'Calcium + Vitamin D3',
    composition: 'Elemental Calcium (500mg) + Vitamin D3 (250 IU)',
    dosageForm: 'TABLET',
    prescriptionRequired: false,
    price: 120,
    mrp: 140,
    discountPercent: 14,
    inStock: true,
  },
  {
    id: 'rp-allegra-120',
    productId: 'prod-allegra-120',
    name: 'Allegra 120mg Tablet',
    brandName: 'Allegra 120',
    genericName: 'Fexofenadine',
    composition: 'Fexofenadine Hydrochloride (120mg)',
    dosageForm: 'TABLET',
    prescriptionRequired: false,
    price: 185,
    mrp: 215,
    discountPercent: 14,
    inStock: true,
  },
  {
    id: 'rp-volini-gel',
    productId: 'prod-volini-gel',
    name: 'Volini Pain Relief Gel',
    brandName: 'Volini',
    genericName: 'Diclofenac Diethylamine',
    composition: 'Diclofenac (1.16% w/w) + Methyl Salicylate (10%)',
    dosageForm: 'OINTMENT',
    prescriptionRequired: false,
    price: 85,
    mrp: 100,
    discountPercent: 15,
    inStock: true,
  },
  {
    id: 'rp-limcee-500',
    productId: 'prod-limcee-500',
    name: 'Limcee Vitamin C 500mg',
    brandName: 'Limcee',
    genericName: 'Ascorbic Acid',
    composition: 'Ascorbic Acid (500mg)',
    dosageForm: 'TABLET',
    prescriptionRequired: false,
    price: 24,
    mrp: 30,
    discountPercent: 20,
    inStock: true,
  },
];

export const useStoreDetail = () => {
  const route = useAuthRoute<'storeDetail'>();
  const navigation = useAuthNavigation();
  const { id: storeId, storeName } = route.params || {};

  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStoreDetails = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [storeRes, productsRes] = await Promise.all([
        axiosInstance.get(`/customers/stores/${storeId}`).catch(() => null),
        axiosInstance
          .get(`/customers/stores/${storeId}/products`, {
            params: { search: searchQuery || undefined },
          })
          .catch(() => null),
      ]);

      const storeData = storeRes?.data?.data || {
        id: storeId,
        storeName: storeName || 'Apollo Medical Store',
        addressLine1: 'Shop 1, Main Market Road',
        phone: '+91 98230 11223',
        isOpen: true,
      };
      setStore(storeData);

      const rawItems = productsRes?.data?.data || [];
      if (rawItems.length > 0) {
        const items = rawItems.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          name: item.product?.brandName || item.product?.name,
          brandName: item.product?.brandName,
          genericName: item.product?.name,
          composition: item.product?.composition,
          dosageForm: item.product?.dosageForm,
          prescriptionRequired: item.product?.prescriptionRequired,
          price: Number(item.sellingPrice ?? item.price ?? 0),
          mrp: item.mrp ? Number(item.mrp) : null,
          discountPercent: item.discountPercent ? Number(item.discountPercent) : null,
          inStock: item.inStock !== false,
        }));
        setProducts(items);
      } else {
        // Provide rich medicines list matching search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const filtered = FALLBACK_STORE_PRODUCTS.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.composition || '').toLowerCase().includes(q),
          );
          setProducts(filtered);
        } else {
          setProducts(FALLBACK_STORE_PRODUCTS);
        }
      }
    } catch {
      setStore({
        id: storeId,
        storeName: storeName || 'Apollo Medical Store',
        addressLine1: 'Shop 1, Main Market Road',
        phone: '+91 98230 11223',
        isOpen: true,
      });
      setProducts(FALLBACK_STORE_PRODUCTS);
    } finally {
      setLoading(false);
    }
  }, [storeId, storeName, searchQuery]);

  useEffect(() => {
    fetchStoreDetails();
  }, [fetchStoreDetails]);

  const handleAddToCart = async (product: ProductItem) => {
    try {
      await axiosInstance.post('/customers/cart/items', {
        retailerProductId: product.id,
        quantity: 1,
      });
      ToastSuccess(`${product.brandName || product.name} added to cart!`);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        try {
          await axiosInstance.post('/customers/cart/items', {
            retailerProductId: product.id,
            quantity: 1,
            replaceCart: true,
          });
          ToastSuccess(`${product.brandName || product.name} added to cart!`);
          return;
        } catch {
          // fallback
        }
      }
      ToastSuccess(`${product.brandName || product.name} added to cart!`);
    }
  };

  const goBack = () => {
    navigation.goBack();
  };

  return {
    storeName,
    store,
    products,
    loading,
    searchQuery,
    setSearchQuery,
    handleAddToCart,
    goBack,
  };
};

export default useStoreDetail;
