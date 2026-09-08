import { StockService, IncreaseStockParams, DecreaseStockParams, BatchDecreaseItem, BatchDecreaseMeta } from './stock.service.js';
import { StockQueryInput, MovementQueryInput, AdjustStockInput } from './inventory.validation.js';

export { StockService, IncreaseStockParams, DecreaseStockParams, BatchDecreaseItem, BatchDecreaseMeta };

/**
 * InventoryService delegates to centralized StockService to preserve backward compatibility.
 */
export class InventoryService {
  static async getStockStatus(query: StockQueryInput) {
    return StockService.listStock(query);
  }

  static async getMovements(query: MovementQueryInput) {
    return StockService.getStockMovementHistory(query);
  }

  static async adjustStock(
    userId: string,
    userRoleOrInput: string | AdjustStockInput,
    inputOrIp?: AdjustStockInput | string | null,
    ipAddress?: string | null
  ) {
    let userRole = 'ADMIN';
    let input: AdjustStockInput;
    let ip: string | null = null;

    if (typeof userRoleOrInput === 'string') {
      userRole = userRoleOrInput;
      input = inputOrIp as AdjustStockInput;
      ip = ipAddress || null;
    } else {
      input = userRoleOrInput;
      ip = (inputOrIp as string) || null;
    }

    return StockService.adjustStock(userId, userRole, input, ip);
  }

  static async reconcileStock(productId: string) {
    return StockService.reconcileStock(productId);
  }

  static async getSummary() {
    return StockService.getStockSummary();
  }

  static async getProductStock(productId: string) {
    return StockService.getCurrentStock(productId);
  }
}
