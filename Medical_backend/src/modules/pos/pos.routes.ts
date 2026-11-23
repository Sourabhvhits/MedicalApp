import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { requirePermission, retailerScope } from '../../middleware/rbac';
import { auditFromRequest } from '../../lib/audit';
import { AUDIT_MODULES } from '../../config/constants';
import { PERMISSIONS } from '../../config/permissions';
import { doc } from '../../lib/openapi';
import * as service from './pos.service';
import { posSaleSchema } from './pos.validation';

const productSearchQuery = z.object({ search: z.string().trim().max(120).optional() });

/** Walk-in counter sales for a medical shop. Mounted at /retailer/pos. */
export const retailerPosRouter = Router();

retailerPosRouter.get(
  '/products',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ query: productSearchQuery }),
  asyncHandler(async (req, res) => {
    const products = await service.searchSellableProducts(retailerScope(req), (req.query.search as string) ?? '');
    return ok(res, products);
  }),
);

retailerPosRouter.post(
  '/sales',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate({ body: posSaleSchema }),
  asyncHandler(async (req, res) => {
    const sale = await service.createPosSale(retailerScope(req), req.body, req.user!.id);

    await auditFromRequest(req, {
      action: 'pos.sale',
      module: AUDIT_MODULES.ORDER,
      recordId: sale.id,
      newValue: sale,
    });
    return created(res, sale, 'Sale recorded');
  }),
);

doc('get', '/retailer/pos/products', { tags: ['Retailer'], summary: 'Search this store\'s sellable catalogue for the POS screen', query: productSearchQuery });
doc('post', '/retailer/pos/sales', { tags: ['Retailer'], summary: 'Record a walk-in counter sale', body: posSaleSchema, status: 201 });
