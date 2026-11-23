import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { CartItemCard } from '../src/components/card/cartItemCard/CartItemCard';
import { SafetyBanner } from '../src/components/common/safetyBanner/SafetyBanner';
import { CartItemModel } from '../src/components/card/cartItemCard/cartItemCardProps';

describe('Cart Components & Safety Validation', () => {
  it('renders CartItemCard cleanly with backend summarized item format (no crash)', () => {
    // Backend format without nested product object
    const backendItem: CartItemModel = {
      id: 'cart-item-123',
      productId: 'prod-456',
      retailerProductId: 'rp-789',
      name: 'Amoxicillin 500mg Capsule',
      packSize: '10 Capsules',
      prescriptionRequired: true,
      quantity: 2,
      unitPrice: 120.5,
      lineTotal: 241.0,
      availableQty: 50,
    };

    let tree: any;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <CartItemCard
          item={backendItem}
          onIncrement={jest.fn()}
          onDecrement={jest.fn()}
          onRemove={jest.fn()}
        />,
      );
    });

    expect(tree).toBeDefined();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Amoxicillin 500mg Capsule');
    expect(json).toContain('Rx Required');
    expect(json).toContain('241.00');
  });

  it('renders CartItemCard cleanly with nested product format (backward compatibility)', () => {
    const legacyItem: CartItemModel = {
      id: 'cart-item-legacy',
      retailerProductId: 'rp-legacy',
      quantity: 1,
      unitPrice: 50.0,
      product: {
        id: 'prod-legacy',
        name: 'Paracetamol 650mg',
        brandName: 'Dolo 650',
        composition: 'Paracetamol (650mg)',
        prescriptionRequired: false,
      },
    };

    let tree: any;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <CartItemCard
          item={legacyItem}
          onIncrement={jest.fn()}
          onDecrement={jest.fn()}
          onRemove={jest.fn()}
        />,
      );
    });

    expect(tree).toBeDefined();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Dolo 650');
  });

  it('renders SafetyBanner cleanly with interactions', () => {
    let tree: any;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <SafetyBanner
          warnings={[
            {
              compositionA: 'Warfarin',
              compositionB: 'Aspirin',
              severity: 'SEVERE',
              description: 'Increased bleeding risk',
            },
          ]}
        />,
      );
    });

    expect(tree).toBeDefined();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Warfarin');
    expect(json).toContain('Aspirin');
  });
});
